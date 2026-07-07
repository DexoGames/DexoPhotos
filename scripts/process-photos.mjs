/**
 * Photo pipeline for DexoPhotos.
 *
 * Gallery originals go in:
 *   photos/live-music/  photos/street/  photos/abstract/  photos/other/
 * Hero "drift" images (the melting panel next to the name) go in their own:
 *   photos/featured/
 * then run `npm run photos`.
 *
 * For every source image this produces (in public/photos/<group>/):
 *   <name>_l.webp  — max 2000px, quality 82 (lightbox)
 *   <name>_t.webp  — max 800px,  quality 72 (grid / hero)
 * plus a tiny inline blur placeholder. Gallery images are written to
 * src/photos.json and the featured set to src/featured.json, both sorted by
 * the EXIF "date taken" (falls back to the file's modified time).
 *
 * Re-runs are incremental: unchanged sources are skipped, outputs for
 * deleted sources are cleaned up.
 */
import { readdir, stat, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'photos');
const OUT = path.join(ROOT, 'public', 'photos');
const CATEGORIES = ['live-music', 'street', 'abstract', 'other'];
const FEATURED = 'featured';
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.avif']);
const LARGE = 2000;
const THUMB = 800;

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'photo';

async function loadManifest(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Processes every image in one source group (a category or "featured") and
 * returns its manifest entries. Reuses unchanged outputs from prevById.
 */
async function processGroup(group, prevById, expectedOutputs, counters) {
  const dir = path.join(SRC, group);
  const outDir = path.join(OUT, group);
  await mkdir(dir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const entries = [];
  const files = (await readdir(dir)).filter((f) => EXTS.has(path.extname(f).toLowerCase()));
  for (const file of files) {
    const full = path.join(dir, file);
    const st = await stat(full);
    const base = slugify(path.basename(file, path.extname(file)));
    const id = `${group}/${base}`;
    const largePath = path.join(outDir, `${base}_l.webp`);
    const thumbPath = path.join(outDir, `${base}_t.webp`);
    expectedOutputs.add(largePath);
    expectedOutputs.add(thumbPath);

    const prev = prevById.get(id);
    if (prev && prev.srcMtimeMs === st.mtimeMs && existsSync(largePath) && existsSync(thumbPath)) {
      entries.push(prev);
      counters.skipped++;
      continue;
    }

    process.stdout.write(`  ${id} ... `);
    const img = sharp(full, { failOn: 'none' }).rotate();
    const meta = await sharp(full).metadata();
    let { width, height } = meta;
    if ((meta.orientation || 1) >= 5) [width, height] = [height, width];

    let takenAt = null;
    try {
      // xmp:true matters here: PNGs exported from Lightroom/etc often carry
      // their date ONLY in embedded XMP, not a TIFF/EXIF chunk. `pick` can't
      // be used together with xmp — it filters out xmp-only tags even when
      // their name matches (pick only knows the static TIFF/EXIF/IPTC dicts),
      // so it silently returned undefined for those files and we fell back to
      // the file's mtime (today, i.e. whenever it was copied to disk) instead
      // of the real date taken.
      const ex = await exifr.parse(full, { xmp: true, gps: false, icc: false });
      takenAt = ex?.DateTimeOriginal || ex?.CreateDate || ex?.DateCreated || ex?.ModifyDate || null;
    } catch {
      /* no exif — fall back to mtime */
    }
    if (!takenAt) takenAt = st.mtime;

    await img
      .clone()
      .resize({ width: LARGE, height: LARGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(largePath);
    await img
      .clone()
      .resize({ width: THUMB, height: THUMB, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(thumbPath);
    const tiny = await img.clone().resize(24).blur(1).webp({ quality: 40 }).toBuffer();

    entries.push({
      id,
      category: group,
      takenAt: new Date(takenAt).toISOString(),
      width,
      height,
      large: `/photos/${group}/${base}_l.webp`,
      thumb: `/photos/${group}/${base}_t.webp`,
      placeholder: `data:image/webp;base64,${tiny.toString('base64')}`,
      srcMtimeMs: st.mtimeMs,
    });
    counters.processed++;
    console.log('ok');
  }
  return entries;
}

const byDateDesc = (a, b) => new Date(b.takenAt) - new Date(a.takenAt);

const expectedOutputs = new Set();
const counters = { processed: 0, skipped: 0 };

// --- gallery ---------------------------------------------------------------
const galleryFile = path.join(ROOT, 'src', 'photos.json');
const galleryPrev = new Map((await loadManifest(galleryFile)).map((p) => [p.id, p]));
let gallery = [];
for (const cat of CATEGORIES) {
  gallery = gallery.concat(await processGroup(cat, galleryPrev, expectedOutputs, counters));
}
gallery.sort(byDateDesc);
await writeFile(galleryFile, JSON.stringify(gallery, null, 2));

// --- featured (hero drift) -------------------------------------------------
const featuredFile = path.join(ROOT, 'src', 'featured.json');
const featuredPrev = new Map((await loadManifest(featuredFile)).map((p) => [p.id, p]));
const featured = await processGroup(FEATURED, featuredPrev, expectedOutputs, counters);
featured.sort(byDateDesc);
await writeFile(featuredFile, JSON.stringify(featured, null, 2));

// --- clean up orphaned outputs --------------------------------------------
for (const group of [...CATEGORIES, FEATURED]) {
  const outDir = path.join(OUT, group);
  if (!existsSync(outDir)) continue;
  for (const f of await readdir(outDir)) {
    const p = path.join(outDir, f);
    if (!expectedOutputs.has(p)) await rm(p);
  }
}

console.log(
  `\n${gallery.length} gallery + ${featured.length} featured photos ` +
    `(${counters.processed} processed, ${counters.skipped} unchanged) -> src/photos.json, src/featured.json`
);
