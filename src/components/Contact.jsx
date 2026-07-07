import { SITE } from '../config.js';

export default function Contact() {
  return (
    <section className="contact" id="booking">
      <div className="contact-inner">
        <h2 className="contact-title ca">
          BOOK<span className="contact-title-break">ME</span>
        </h2>
        <p className="contact-blurb">
          I've recently started taking bookings, the easiest way to
          sort one is a DM on Instagram :)
        </p>

        <a className="contact-insta cut" href={SITE.instagramUrl} target="_blank" rel="noreferrer">
          DM @{SITE.instagram.toUpperCase()} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
