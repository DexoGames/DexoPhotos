import { SITE } from '../config.js';
import HeroDrift from './HeroDrift.jsx';

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-frame" aria-hidden="true">
        <span className="hero-corner tl" />
        <span className="hero-corner br" />
      </div>

      <HeroDrift />

      <p className="hero-kicker mono">
        PHOTOGRAPHY —{' '}
        <a href={SITE.instagramUrl} target="_blank" rel="noreferrer">
          @{SITE.instagram.toUpperCase()} ↗
        </a>
      </p>

      <h1 className="hero-title ca">
        DEXTER
        <br />
        SMITH
      </h1>

      <div className="hero-strip rainbow-line" aria-hidden="true" />

      <ul className="hero-cats">
        <li>LIVE MUSIC</li>
        <li>STREET</li>
        <li>ABSTRACT</li>
        <li>MORE</li>
      </ul>

      <div className="hero-foot">
        <a className="hero-cta cut" href="#work">
          SEE THE PHOTOS <span aria-hidden="true">↓</span>
        </a>
        <a className="hero-cta hero-cta--ghost cut" href="#booking">
          BOOK ME
        </a>
      </div>
    </section>
  );
}
