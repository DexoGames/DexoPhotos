import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Curtains, Plane } from 'curtainsjs';

/**
 * Realistic lens-style chromatic aberration via curtains.js (WebGL).
 * Unlike the CSS RGB-split (a hard channel offset), this fringes radially —
 * zero in the centre, growing toward the edges — and multi-taps each channel
 * so the colour *bleeds* like real glass. Strength spikes when a photo loads,
 * then settles to a subtle constant. Falls back to a plain <img> if WebGL
 * is unavailable.
 */

const VERTEX = `
precision mediump float;
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uTexMatrix;
varying vec2 vTextureCoord;
void main() {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  vTextureCoord = (uTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
}
`;

const FRAGMENT = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uTex;
uniform float uStrength;

const int TAPS = 8;

void main() {
  vec2 toCenter = vTextureCoord - vec2(0.5);
  float dist = length(toCenter);
  // quadratic falloff: clean centre, fringing at the edges like a real lens
  float amt = uStrength * 0.05 * dist * dist;

  float r = 0.0;
  float b = 0.0;
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float t = float(i) / float(TAPS - 1);
    float w = 1.0 - t * 0.6;
    r += texture2D(uTex, vTextureCoord + toCenter * amt * t).r * w;
    b += texture2D(uTex, vTextureCoord - toCenter * amt * t).b * w;
    wsum += w;
  }
  float g = texture2D(uTex, vTextureCoord).g;
  gl_FragColor = vec4(r / wsum, g, b / wsum, 1.0);
}
`;

export default function CAImage({ photo }) {
  const stageRef = useRef(null);
  const planeElRef = useRef(null);
  const curtainsRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [box, setBox] = useState(null);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Size the plane to the photo's "contain" box inside the stage. Runs in a
  // layout effect so `box` is up to date for the current photo *before* the
  // plane is (re)built below — otherwise switching to a photo with a different
  // aspect ratio would keep the previous photo's dimensions.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const s = Math.min(r.width / photo.width, r.height / photo.height, 1e9);
      setBox({ w: Math.round(photo.width * s), h: Math.round(photo.height * s) });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, [photo.width, photo.height]);

  // One WebGL context for the lightbox's lifetime.
  useEffect(() => {
    if (failed) return;
    const curtains = new Curtains({
      container: stageRef.current,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      watchScroll: false,
    });
    curtains.onError(() => setFailed(true));
    curtains.onContextLost(() => setFailed(true));
    curtainsRef.current = curtains;
    return () => {
      curtainsRef.current = null;
      curtains.dispose();
    };
  }, [failed]);

  // One plane per photo.
  useEffect(() => {
    const curtains = curtainsRef.current;
    const el = planeElRef.current;
    if (!curtains || !el || failed || !box) return;

    const plane = new Plane(curtains, el, {
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        strength: { name: 'uStrength', type: '1f', value: reducedMotion ? 0.6 : 2.6 },
      },
    });
    plane.onError(() => setFailed(true));
    plane.onRender(() => {
      const u = plane.uniforms.strength;
      u.value += (0.6 - u.value) * 0.05; // settle from the load spike to subtle
    });
    curtains.resize();
    return () => plane.remove();
    // Rebuild the plane whenever the photo OR its fitted size changes, so a new
    // photo with a different aspect ratio (and window resizes) size correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id, failed, box && box.w, box && box.h]);

  if (failed) {
    return (
      <img
        className="lb-img glitch-in"
        src={photo.large}
        alt=""
        style={{ backgroundImage: `url(${photo.placeholder})` }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div className="lb-gl" ref={stageRef} onClick={(e) => e.stopPropagation()}>
      {box && (
        <div
          key={photo.id}
          ref={planeElRef}
          className="ca-plane"
          style={{ width: box.w, height: box.h, backgroundImage: `url(${photo.placeholder})` }}
        >
          <img src={photo.large} alt="" data-sampler="uTex" crossOrigin="anonymous" />
        </div>
      )}
    </div>
  );
}
