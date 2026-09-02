import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_LABELS } from '../config.js';
import { fmtDate, fmtTime } from '../lib/format.js';
import { large, thumb, thumbSrcSet, THUMB_SIZES } from '../lib/img.js';

// The RGB-split layers only ever show on :hover / :focus-visible, so on touch
// devices they were two extra copies of every thumb being fetched, decoded and
// composited for nothing. Checked once at module load — a device doesn't
// sprout a mouse mid-session.
const CAN_HOVER =
  typeof window === 'undefined' ||
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Full-size images already warmed by a hover, so crossing the grid with the
// mouse doesn't re-request them and crowd out the thumbs still loading.
const warmed = new Set();
const warm = (url) => {
  if (warmed.has(url)) return;
  warmed.add(url);
  new Image().src = url;
};

const ROW_UNIT = 8; // grid-auto-rows px — cards span a whole number of these
const CAPTION_H = 78; // caption + card bottom spacing, must match CSS

/**
 * The <source> pair every layer of a card shares. Using the same candidate
 * list on the split layers as on the base image means they resolve to the
 * URL already in cache instead of pulling a second rendition.
 */
function ThumbSources({ photo }) {
  return (
    <>
      <source type="image/avif" srcSet={thumbSrcSet(photo, 'avif')} sizes={THUMB_SIZES} />
      <source type="image/webp" srcSet={thumbSrcSet(photo, 'webp')} sizes={THUMB_SIZES} />
    </>
  );
}

function PhotoCard({ photo, index, span, showCategory, onOpen }) {
  // The first row is above the fold on every breakpoint: load it eagerly and
  // at high priority so the largest contentful paint isn't waiting behind the
  // lazy-loading pass.
  const eager = index < 3;
  return (
    <figure
      className="card"
      style={{ gridRowEnd: `span ${span}`, transitionDelay: `${(index % 3) * 70}ms` }}
    >
      <button
        type="button"
        className="card-btn"
        onClick={() => onOpen(index)}
        // Warm the full-size image while the user hovers/tabs, so the lightbox
        // usually has it ready by the time they click.
        onPointerEnter={() => warm(large(photo))}
        onFocus={() => warm(large(photo))}
        aria-label={`Open ${CATEGORY_LABELS[photo.category]} photo, taken ${fmtDate(photo.takenAt)}`}
      >
        <div
          className="card-img cut-img"
          style={{
            aspectRatio: `${photo.width} / ${photo.height}`,
            backgroundImage: `url(${photo.placeholder})`,
          }}
        >
          <picture>
            <ThumbSources photo={photo} />
            <img
              className="card-base"
              data-photo={photo.id}
              src={thumb(photo)}
              alt=""
              loading={eager ? 'eager' : 'lazy'}
              fetchpriority={eager ? 'high' : 'auto'}
              decoding="async"
            />
          </picture>
          {CAN_HOVER && (
            <>
              <picture>
                <ThumbSources photo={photo} />
                <img
                  className="card-split card-split--r"
                  src={thumb(photo)}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <picture>
                <ThumbSources photo={photo} />
                <img
                  className="card-split card-split--c"
                  src={thumb(photo)}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </>
          )}
        </div>
      </button>
      <figcaption className="card-cap">
        <div className="card-line">
          <span className="card-idx mono">{String(index + 1).padStart(3, '0')}</span>
          <time className="card-date mono" dateTime={photo.takenAt}>
            {fmtDate(photo.takenAt)} — {fmtTime(photo.takenAt)}
          </time>
          {showCategory && (
            <span className="card-cat mono">{CATEGORY_LABELS[photo.category]}</span>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

export default function Gallery({ photos, allPhotos, cat, setCat, onOpen }) {
  const gridRef = useRef(null);
  const [layout, setLayout] = useState({ cols: 3, colW: 380, gap: 24 });

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const cols = w >= 1024 ? 3 : w >= 640 ? 2 : 1;
      const gap = w >= 640 ? 24 : 16;
      setLayout({ cols, gap, colW: (w - gap * (cols - 1)) / cols });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reveal-on-scroll for cards.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
    );
    el.querySelectorAll('.card').forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [photos, layout.cols]);

  const spanFor = (p) => {
    const imgH = layout.colW * (p.height / p.width);
    return Math.max(1, Math.ceil((imgH + CAPTION_H) / ROW_UNIT));
  };

  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [
      c.key,
      c.key === 'all' ? allPhotos.length : allPhotos.filter((p) => p.category === c.key).length,
    ])
  );

  return (
    <section className="gallery" id="work">
      <header className="gallery-head">
        <h2 className="section-title ca">PHOTOS</h2>
      </header>

      <nav className="tabs" aria-label="Photo categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`tab cut${cat === c.key ? ' tab--on' : ''}`}
            onClick={() => setCat(c.key)}
            aria-pressed={cat === c.key}
          >
            {c.label} <sup className="mono">{counts[c.key]}</sup>
          </button>
        ))}
      </nav>

      {photos.length === 0 ? (
        <p className="gallery-empty mono">
          NOTHING HERE YET — DROP PHOTOS INTO photos/{cat === 'all' ? '<category>' : cat}/ AND RUN
          `npm run photos`
        </p>
      ) : (
        <div
          ref={gridRef}
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
            gridAutoRows: `${ROW_UNIT}px`,
            columnGap: `${layout.gap}px`,
          }}
        >
          {photos.map((p, i) => (
            <PhotoCard
              key={p.id}
              photo={p}
              index={i}
              span={spanFor(p)}
              showCategory={cat === 'all'}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}
