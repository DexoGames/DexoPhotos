/**
 * Generates watermarked PLACEHOLDER images into photos/<category>/ so the
 * site has something to show before real photos are added.
 *
 * Delete the placeholder-*.jpg files (or the lot) once real photos are in,
 * then re-run `npm run photos` — outputs are cleaned up automatically.
 */
import { mkdir, writeFile, utimes } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'photos');

const PALETTES = {
  'live-music': [
    ['#0b0b0f', '#3d1d5e', '#e0245e'],
    ['#05060a', '#12355b', '#40c9ff'],
    ['#100a08', '#7a2c12', '#ffb347'],
    ['#0a0a0a', '#284b2f', '#b6ff5e'],
  ],
  street: [
    ['#e8e6e1', '#9a9a97', '#2b2b2b'],
    ['#d9d9d9', '#6f7a85', '#1c1e22'],
    ['#efece5', '#b5aca0', '#3a352f'],
    ['#dfe3e6', '#88919b', '#23272d'],
  ],
  abstract: [
    ['#ffffff', '#ff0f5e', '#0a0a0a'],
    ['#ffffff', '#00e5d0', '#111111'],
    ['#f5f5f5', '#3b2bff', '#000000'],
    ['#ffffff', '#ffd400', '#141414'],
  ],
  other: [
    ['#f0ead9', '#c96f3a', '#33261c'],
    ['#e3edf0', '#5f93a8', '#1e2f36'],
    ['#efe4ef', '#9c5f9e', '#2c1f2e'],
    ['#e9efe2', '#7ba05b', '#26301e'],
  ],
};

const NAMES = {
  'live-music': ['warehouse-set', 'union-ballroom', 'basement-show', 'encore-lights'],
  street: ['crossing-noon', 'market-lane', 'night-bus', 'shutter-alley'],
  abstract: ['signal-drift', 'grid-collapse', 'phase-two', 'raster-burn'],
  other: ['field-notes', 'studio-test', 'window-seat', 'off-day'],
};

const SIZES = [
  [1600, 1067],
  [1067, 1600],
  [1600, 1600],
  [1600, 900],
];

const rand = (seed) => {
  // deterministic-ish pseudo random per seed
  let x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
};

function svgFor(cat, i, w, h, label) {
  const [bg, mid, fg] = PALETTES[cat][i % 4];
  const shapes = [];
  for (let s = 0; s < 7; s++) {
    const r = rand(i * 13 + s * 7 + cat.length);
    const r2 = rand(i * 31 + s * 3);
    const x = r * w;
    const y = r2 * h;
    const size = (0.12 + r * 0.3) * Math.min(w, h);
    const color = s % 2 ? mid : fg;
    const op = 0.25 + r2 * 0.5;
    if (s % 3 === 0) {
      shapes.push(
        `<polygon points="${x},${y} ${x + size},${y + size * 0.4} ${x - size * 0.3},${y + size}" fill="${color}" opacity="${op}"/>`
      );
    } else if (s % 3 === 1) {
      shapes.push(
        `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size * 0.7}" fill="${color}" opacity="${op}" transform="rotate(${r * 60 - 30} ${x} ${y})"/>`
      );
    } else {
      shapes.push(`<circle cx="${x}" cy="${y}" r="${size / 2}" fill="${color}" opacity="${op}"/>`);
    }
  }
  const fontSize = Math.round(Math.min(w, h) * 0.07);
  const textColor = cat === 'street' || cat === 'abstract' || cat === 'other' ? '#00000055' : '#ffffff66';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="0.6" stop-color="${mid}"/>
      <stop offset="1" stop-color="${bg}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  ${shapes.join('\n  ')}
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-weight="bold" font-size="${fontSize}"
        letter-spacing="${fontSize * 0.2}" fill="${textColor}">PLACEHOLDER</text>
  <text x="${w / 2}" y="${h / 2 + fontSize * 1.4}" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 0.45)}"
        letter-spacing="4" fill="${textColor}">${label.toUpperCase()}</text>
</svg>`;
}

let count = 0;
const now = Date.now();
for (const cat of Object.keys(PALETTES)) {
  const dir = path.join(SRC, cat);
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < 4; i++) {
    const [w, h] = SIZES[(i + count) % SIZES.length];
    const name = `placeholder-${NAMES[cat][i]}`;
    const file = path.join(dir, `${name}.jpg`);
    const svg = svgFor(cat, i + count, w, h, NAMES[cat][i].replace(/-/g, ' '));
    const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
    await writeFile(file, buf);
    // Spread fake "taken" dates over the past year (pipeline falls back to mtime).
    const taken = new Date(now - (count * 11 + i * 3 + 2) * 24 * 3600 * 1000 - (i * 7 + 9) * 3600 * 1000);
    await utimes(file, taken, taken);
    count++;
  }
}
console.log(`${count} placeholder images written to photos/ — run \`npm run photos\` next.`);
