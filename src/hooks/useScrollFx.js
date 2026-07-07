import { useEffect } from 'react';

/**
 * Drives the site-wide chromatic aberration from scroll velocity.
 * Sets one CSS custom property on <html>:
 *   --ca   aberration strength in px (rests at 1 for a subtle constant fringe)
 */
export default function useScrollFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let vel = 0;
    let target = 0;
    let raf;

    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dt = Math.max(now - lastT, 1);
      target = Math.min((Math.abs(y - lastY) / dt) * 16, 9);
      lastY = y;
      lastT = now;
    };

    const loop = () => {
      vel += (target - vel) * 0.14;
      target *= 0.86; // decay back to rest when scrolling stops
      root.style.setProperty('--ca', (1 + vel).toFixed(2));
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
}
