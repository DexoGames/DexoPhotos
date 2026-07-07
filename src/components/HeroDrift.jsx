import { useEffect, useRef, useState } from 'react';
import { Curtains, Plane } from 'curtainsjs';
import featured from '../featured.json';
import photosData from '../photos.json';

/**
 * Auto-cycling photo panel in the hero's empty right side (curtains.js).
 * The interior stays sharp; only the border dissolves into the page, the edge
 * silhouette waves gently, and the image→background gradient carries a rainbow
 * chromatic bleed that disperses outward.
 * Absolutely positioned + pointer-events:none, so it never affects layout.
 * Renders nothing when it can't fit beside the name, with <2 photos, or if
 * WebGL fails.
 *
 * Images come from photos/featured/ (src/featured.json). If that folder is
 * empty it falls back to the newest gallery photos so the hero still shows
 * something.
 */

const PICKS = (featured.length >= 2 ? featured : photosData).slice(0, 6);
const HOLD_S = 4.5; // seconds each photo holds before crossfading
const FADE_S = 1.6; // crossfade duration

function makeShaders(n) {
  const idx = Array.from({ length: n }, (_, i) => i);
  const vertex = `
precision mediump float;
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
${idx.map((i) => `uniform mat4 uTex${i}Matrix;`).join('\n')}
varying vec2 vUv;
${idx.map((i) => `varying vec2 vUv${i};`).join('\n')}
void main() {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  vUv = aTextureCoord;
  ${idx.map((i) => `vUv${i} = (uTex${i}Matrix * vec4(aTextureCoord, 0.0, 1.0)).xy;`).join('\n  ')}
}
`;

  const fragment = `
precision mediump float;
varying vec2 vUv;
${idx.map((i) => `varying vec2 vUv${i};`).join('\n')}
${idx.map((i) => `uniform sampler2D uTex${i};`).join('\n')}
uniform float uTime;
uniform float uMix;
uniform int uFrom;
uniform int uTo;
uniform float uAlpha;
uniform float uAspect; // plane width / height, so the fade band is even on all sides

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

vec3 sampleTex(int i, vec2 off) {
  ${idx
    .map((i) => `${i ? 'else ' : ''}if (i == ${i}) return texture2D(uTex${i}, vUv${i} + off).rgb;`)
    .join('\n  ')}
  return vec3(1.0);
}

void main() {
  vec2 p = vUv - 0.5;
  vec2 edgeUV = min(vUv, 1.0 - vUv);

  float n1 = fbm(vUv * 3.5 + uTime * 0.05);
  float n2 = fbm(vUv * 3.5 - uTime * 0.04 + 7.31);

  /* gently wave the edge silhouette: slow noise + a low, slow sine displacing
     the border in and out. This moves the BORDER only, so the interior is
     left sharp (not the sampling-wave style from before). */
  float ripple = (fbm(vUv * 2.0 + uTime * 0.13) - 0.5) * 0.8
               + sin((vUv.x * uAspect - vUv.y) * 4.0 + uTime * 0.7) * 0.2;
  float wob = ripple * 0.04;

  /* per-axis fades multiplied -> soft rounded corners (no diagonal seam),
     wide gentle band so the colour reaches well into the page */
  float fx = smoothstep(0.0, 0.48, edgeUV.x * uAspect + wob);
  float fy = smoothstep(0.0, 0.48, edgeUV.y + wob);
  float mask = fx * fy;                 // 0 at edge -> 1 interior
  float edgeAmt = 1.0 - mask;           // only non-zero in the border band

  /* melt the edge SHAPE into the fade; interior stays sharp */
  vec2 melt = (vec2(n1, n2) - 0.5) * edgeAmt * 0.13;
  melt.y += edgeAmt * 0.04 * n2; // slight downward drip

  /* spectral rainbow bleed, smeared OUTWARD so the colour disperses into the
     background as the image dissolves. Strength is edgeAmt^2 with no constant
     term, so the interior is barely touched. */
  vec2 dir = normalize(p + vec2(0.0001));
  float amt = edgeAmt * edgeAmt * 0.34;
  float m = smoothstep(0.0, 1.0, uMix);

  vec3 acc = vec3(0.0);
  vec3 wsum = vec3(0.0);
  const int TAPS = 16;
  for (int i = 0; i < TAPS; i++) {
    float t = float(i) / float(TAPS - 1);
    vec2 off = melt + dir * amt * t; // outward 0..1
    /* full spectrum across the smear -> a rainbow, not a hard R/B split */
    vec3 w = 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
    vec3 c = mix(sampleTex(uFrom, off), sampleTex(uTo, off), m);
    acc += c * w;
    wsum += w;
  }
  acc /= max(wsum, vec3(0.001));

  /* A B&W photo smeared by chromatic aberration stays grey in smooth areas
     (real dispersion only colours contrast edges) — that's the grey halo. So
     as the image dissolves at the border, reveal a synthesized rainbow that
     cycles around the edge and drifts in time, letting the colour reach out
     into the white background instead of going grey. */
  float ang = atan(p.y, p.x + 0.0001);
  vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (ang * 0.5 + length(p) * 0.7 + uTime * 0.08)
                                 + vec3(0.0, 2.094, 4.188));
  float reveal = smoothstep(0.60, 0.0, mask);   // 0 interior -> 1 at the edge
  vec3 col = mix(acc, rainbow, reveal * reveal * 0.9);

  /* give the rainbow a little extra coverage in the MIDDLE of the fade band so
     it reads further into the page — tapering back to 0 at the very edge keeps
     the boundary soft (no hard rectangle) */
  float glow = reveal * (1.0 - reveal) * 0.8;
  float a = max(mask, glow) * uAlpha;
  gl_FragColor = vec4(col, a);
}
`;

  return { vertex, fragment };
}

export default function HeroDrift() {
  const wrapRef = useRef(null);
  const planeElRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  // Only show the panel when it actually fits to the right of the name with a
  // clear gap — otherwise disable it entirely (no overlap on smaller screens).
  // PANEL_VW / PANEL_MAX must match the .hero-drift width in index.css.
  useEffect(() => {
    const PANEL_VW = 0.5;
    const PANEL_MAX = 760;
    const GAP = -120;
    const check = () => {
      const w = window.innerWidth;
      if (w < 1000) {
        setEnabled(false);
        return;
      }
      const title = document.querySelector('.hero-title');
      const titleRight = title ? title.getBoundingClientRect().right : 0;
      const panelLeft = w - Math.min(PANEL_VW * w, PANEL_MAX);
      setEnabled(panelLeft > titleRight + GAP);
    };
    check();
    window.addEventListener('resize', check);
    // recheck once fonts load, since that changes the name's width
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!enabled || failed || PICKS.length < 2) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const curtains = new Curtains({
      container: wrapRef.current,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      watchScroll: false,
      premultipliedAlpha: false,
    });
    curtains.onError(() => setFailed(true));
    curtains.onContextLost(() => setFailed(true));

    const { vertex, fragment } = makeShaders(PICKS.length);
    const plane = new Plane(curtains, planeElRef.current, {
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        time: { name: 'uTime', type: '1f', value: 0 },
        mix: { name: 'uMix', type: '1f', value: 0 },
        from: { name: 'uFrom', type: '1i', value: 0 },
        to: { name: 'uTo', type: '1i', value: 1 },
        alpha: { name: 'uAlpha', type: '1f', value: 0 },
        aspect: { name: 'uAspect', type: '1f', value: 1 },
      },
    });
    plane.onError(() => setFailed(true));

    const setAspect = () => {
      const el = wrapRef.current;
      if (el && el.clientHeight) plane.uniforms.aspect.value = el.clientWidth / el.clientHeight;
    };
    setAspect();
    const ro = new ResizeObserver(setAspect);
    ro.observe(wrapRef.current);

    let loaded = 0;
    let ready = false;
    plane.onLoading(() => {
      loaded++;
      if (loaded >= PICKS.length) ready = true;
    });
    // safety net in case a texture stalls
    const readyTimer = setTimeout(() => {
      if (loaded >= 2) ready = true;
    }, 2500);

    let hold = 0;
    let fading = false;
    plane.onRender(() => {
      const u = plane.uniforms;
      if (ready && u.alpha.value < 1) u.alpha.value = Math.min(1, u.alpha.value + 0.02);
      if (reduced) return;
      u.time.value += 1 / 60;
      if (fading) {
        u.mix.value = Math.min(1, u.mix.value + 1 / (FADE_S * 60));
        if (u.mix.value >= 1) {
          u.from.value = u.to.value;
          u.to.value = (u.to.value + 1) % PICKS.length;
          u.mix.value = 0;
          fading = false;
          hold = 0;
        }
      } else {
        hold += 1 / 60;
        if (hold >= HOLD_S) fading = true;
      }
    });

    return () => {
      clearTimeout(readyTimer);
      ro.disconnect();
      curtains.dispose();
    };
  }, [enabled, failed]);

  if (!enabled || failed || PICKS.length < 2) return null;

  return (
    <div className="hero-drift" ref={wrapRef} aria-hidden="true">
      <div className="hero-drift-plane" ref={planeElRef}>
        {PICKS.map((p, i) => (
          <img key={p.id} src={p.thumb} data-sampler={`uTex${i}`} crossOrigin="anonymous" alt="" />
        ))}
      </div>
    </div>
  );
}
