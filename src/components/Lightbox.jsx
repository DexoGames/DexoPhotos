import { useCallback, useEffect } from 'react';
import { CATEGORY_LABELS } from '../config.js';
import { fmtDate, fmtTime } from '../lib/format.js';
import CAImage from './CAImage.jsx';

export default function Lightbox({ photos, index, setIndex, onClose }) {
  const photo = photos[index];

  const step = useCallback(
    (dir) => setIndex((i) => (i + dir + photos.length) % photos.length),
    [photos.length, setIndex]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, step]);

  // Preload neighbours for snappy arrows.
  useEffect(() => {
    [1, -1].forEach((d) => {
      const p = photos[(index + d + photos.length) % photos.length];
      if (p) new Image().src = p.large;
    });
  }, [index, photos]);

  if (!photo) return null;

  return (
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label={`${CATEGORY_LABELS[photo.category]} photo, taken ${fmtDate(photo.takenAt)}`}
    >
      <header className="lb-head">
        <span className="mono">
          {String(index + 1).padStart(3, '0')} / {String(photos.length).padStart(3, '0')}
        </span>
        <button type="button" className="lb-close cut" onClick={onClose} aria-label="Close">
          CLOSE ✕
        </button>
      </header>

      <div className="lb-stage" onClick={onClose}>
        <CAImage photo={photo} />
      </div>

      <footer className="lb-foot">
        <div className="lb-meta">
          <p className="lb-date mono">
            {fmtDate(photo.takenAt)} — {fmtTime(photo.takenAt)}
          </p>
          <p className="lb-cat mono">{CATEGORY_LABELS[photo.category]}</p>
        </div>
        <div className="lb-nav">
          <button type="button" className="lb-arrow cut" onClick={() => step(-1)} aria-label="Previous photo">
            ←
          </button>
          <button type="button" className="lb-arrow cut" onClick={() => step(1)} aria-label="Next photo">
            →
          </button>
        </div>
      </footer>
    </div>
  );
}
