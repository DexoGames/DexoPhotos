/**
 * URL helpers for the renditions written by scripts/process-photos.mjs.
 *
 * The manifest stores only a path stem (`photo.base`); every rendition is
 * `<base>_<size>.<format>` where size is s (420px) / t (840px) / l (1600px)
 * and format is avif or webp. Keeping it out of the manifest keeps
 * src/photos.json — which is bundled into the JS — small.
 */

/** A single rendition URL, e.g. `src(p, 't', 'webp')`. */
export const src = (photo, size, fmt) => `${photo.base}_${size}.${fmt}`;

/** WebP fallback for <img src> inside a <picture>, safe on every browser. */
export const thumb = (photo) => src(photo, 't', 'webp');

/**
 * The grid rendition this browser actually downloaded for a photo, so the
 * lightbox's instant preview is a guaranteed cache hit rather than a second
 * fetch of a different width/format. Empty until that card has lazy-loaded,
 * in which case we fall back to the WebP thumb.
 */
export const gridSrc = (photo) => {
  if (typeof document === 'undefined') return thumb(photo);
  const img = document.querySelector(`img[data-photo="${photo.id}"]`);
  return img?.currentSrc || thumb(photo);
};

/** Candidate set for the grid, so the browser picks a width for the slot. */
export const thumbSrcSet = (photo, fmt) =>
  `${src(photo, 's', fmt)} 420w, ${src(photo, 't', fmt)} 840w`;

/**
 * Rendered card width. The gallery is 3 columns inside a 1440px container,
 * 2 columns from 640px and 1 below that.
 */
export const THUMB_SIZES =
  '(min-width: 1512px) 450px, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw';

/**
 * The lightbox feeds its image straight to a WebGL sampler, so it can't use
 * <picture> negotiation — it needs one URL up front. A 2×2 AVIF decoded once
 * at startup tells us which format to ask for; the probe settles long before
 * anyone opens the lightbox, so a plain mutable flag is enough (no re-render
 * needed) and the fallback while it's pending is WebP, which always works.
 */
const AVIF_PROBE =
  'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAOptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAEOAAEAAAAAAAAAFwAAACNpaW5mAAAAAAABAAAAFWluZmUCAAAAAAEAAGF2MDEAAAAAamlwcnAAAABLaXBjbwAAABNjb2xybmNseAABAA0ABoAAAAAMYXYxQ4EgAgAAAAAUaXNwZQAAAAAAAAACAAAAAgAAABBwaXhpAAAAAAMICAgAAAAXaXBtYQAAAAAAAAABAAEEAYIDBAAAAB9tZGF0EgAKBzgANhAQ0GkyCh+QP///xAAAr+4=';

let avifOk = false;
if (typeof Image !== 'undefined') {
  const probe = new Image();
  probe.onload = () => {
    avifOk = probe.width === 2;
  };
  probe.src = AVIF_PROBE;
}

/** Lightbox-size URL in the best format this browser decodes. */
export const large = (photo) => src(photo, 'l', avifOk ? 'avif' : 'webp');

/** Same, at grid size — for the hero's WebGL samplers. */
export const texture = (photo) => src(photo, 't', avifOk ? 'avif' : 'webp');
