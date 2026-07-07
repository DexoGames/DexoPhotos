import { useState } from 'react';
import { SITE } from '../config.js';

const EVENT_TYPES = ['LIVE SHOW / GIG', 'CLUB NIGHT', 'PORTRAIT', 'SOMETHING ELSE'];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', type: EVENT_TYPES[0], date: '', message: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const subject = `BOOKING — ${form.type}${form.name ? ` — ${form.name}` : ''}`;
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Event type: ${form.type}`,
      `Date: ${form.date || 'TBC'}`,
      '',
      form.message,
    ].join('\n');
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <section className="contact" id="booking">
      <div className="contact-inner">
        <h2 className="contact-title ca">
          BOOK<span className="contact-title-break">ME.</span>
        </h2>
        <p className="contact-blurb">
          I mostly shoot gigs — university bands, local acts, small loud rooms — plus whatever
          catches my eye in between. I've recently started taking bookings, and the easiest way to
          sort one is a DM on Instagram.
        </p>

        <a className="contact-insta cut" href={SITE.instagramUrl} target="_blank" rel="noreferrer">
          DM @{SITE.instagram.toUpperCase()} <span aria-hidden="true">↗</span>
        </a>

        <p className="contact-or mono">PREFER EMAIL? THIS OPENS ONE TO ME —</p>

        <form className="contact-form" onSubmit={submit}>
          <label className="field">
            <span className="mono">NAME</span>
            <input required value={form.name} onChange={set('name')} placeholder="Your name / band name" />
          </label>
          <label className="field">
            <span className="mono">EMAIL</span>
            <input required type="email" value={form.email} onChange={set('email')} placeholder="you@somewhere.com" />
          </label>
          <label className="field">
            <span className="mono">EVENT TYPE</span>
            <select value={form.type} onChange={set('type')}>
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="mono">DATE (IF KNOWN)</span>
            <input type="date" value={form.date} onChange={set('date')} />
          </label>
          <label className="field field--wide">
            <span className="mono">DETAILS</span>
            <textarea
              rows={5}
              value={form.message}
              onChange={set('message')}
              placeholder="Venue, set times, what you're after — whatever you've got."
            />
          </label>
          <button type="submit" className="contact-send cut ca">
            SEND IT →
          </button>
        </form>

        <p className="contact-alt mono">
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{' '}
          <a href={SITE.instagramUrl} target="_blank" rel="noreferrer">
            @{SITE.instagram}
          </a>
        </p>
      </div>
    </section>
  );
}
