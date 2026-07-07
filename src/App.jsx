import { useMemo, useState } from 'react';
import photosData from './photos.json';
import { SITE } from './config.js';
import Hero from './components/Hero.jsx';
import Marquee from './components/Marquee.jsx';
import Gallery from './components/Gallery.jsx';
import Lightbox from './components/Lightbox.jsx';
import Contact from './components/Contact.jsx';
import useScrollFx from './hooks/useScrollFx.js';

/**
 * Hidden SVG filters used for the RGB-split hover effect:
 * one keeps only the red channel, the other only green+blue (cyan),
 * layered over the base image with screen blending.
 */
function ChromaDefs() {
  return (
    <svg className="svg-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="chan-r" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
          />
        </filter>
        <filter id="chan-c" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

export default function App() {
  useScrollFx();
  const [cat, setCat] = useState('all');
  const [lbIndex, setLbIndex] = useState(null);

  // Manifest is already sorted newest-first by the photo pipeline.
  const photos = useMemo(
    () => (cat === 'all' ? photosData : photosData.filter((p) => p.category === cat)),
    [cat]
  );

  return (
    <>
      <ChromaDefs />

      <header className="nav">
        <a className="nav-brand ca" href="#top">
          {SITE.name.toUpperCase()}
        </a>
        <nav className="nav-links">
          <a href="#work">PHOTOS</a>
          <a className="nav-insta" href={SITE.instagramUrl} target="_blank" rel="noreferrer">
            INSTAGRAM ↗
          </a>
          <a className="nav-book cut" href="#booking">
            BOOKING
          </a>
        </nav>
      </header>
      <div className="rainbow-line nav-line" aria-hidden="true" />

      <main>
        <Hero />
        <Marquee />
        <Gallery
          photos={photos}
          allPhotos={photosData}
          cat={cat}
          setCat={setCat}
          onOpen={setLbIndex}
        />
        <Marquee reverse />
        <Contact />
      </main>

      <footer className="footer">
        <span className="mono">© {new Date().getFullYear()} {SITE.name.toUpperCase()}</span>
        <a className="mono" href={SITE.instagramUrl} target="_blank" rel="noreferrer">@{SITE.instagram}</a>
        <a className="mono" href="#top">BACK TO TOP ↑</a>
      </footer>

      {lbIndex !== null && (
        <Lightbox
          photos={photos}
          index={lbIndex}
          setIndex={setLbIndex}
          onClose={() => setLbIndex(null)}
        />
      )}
    </>
  );
}
