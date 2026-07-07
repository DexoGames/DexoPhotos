const LINE = 'LIVE MUSIC ✦ STREET ✦ ABSTRACT ✦ MORE ✦ @DEXO.PHOTOS ✦ ';

export default function Marquee({ reverse = false }) {
  const text = LINE.repeat(4);
  return (
    <div className={`marquee${reverse ? ' marquee--rev' : ''}`} aria-hidden="true">
      <div className="marquee-track ca">
        <span>{text}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}
