/**
 * Photo pipeline for DexoPhotos.
 *
 * Gallery originals go in:
 *   photos/live-music/  photos/street/  photos/abstract/  photos/other/
 * Hero "drift" images (the melting panel next to the name) go in their own:
 *   photos/featured/
 * then run `npm run photos`.
 *
 * For every source image this produces (in public/photos/<group>/), in both
 * AVIF and WebP:
 *   <name>_l.*  — max 1600px (lightbox)
 *   <name>_t.*  — max 840px  (grid on retina / narrow screens, hero WebGL)
 *   <name>_s.*  — max 420px  (grid on ordinary-density screens)
 * AVIF runs ~30% smaller than WebP at matching quality, and the grid picks a
 * width via srcset, so a typical desktop visitor downloads a fraction of what
 * a single fixed-width WebP thumb used to cost.
 *
 * Each entry also carries a tiny inline blur placeholder, and a `base` path
 * that the app expands into the concrete URLs (see src/lib/img.js) — keeping
 * the manifest small even with six renditions per photo. Gallery images are
 * written to src/photos.json and the featured set to src/featured.json, both
 * sorted by the EXIF "date taken" (falls back to the file's modified time).
 *
 * Re-runs are incremental: sources whose CONTENT hash is unchanged are
 * skipped, outputs for deleted sources are cleaned up. Hashing rather than
 * comparing mtimes is what makes the CI cache (see .github/workflows) useful —
 * a git checkout gives every source a fresh mtime, so an mtime check always
 * missed on the build server and re-encoded the whole library every deploy.
 */
import { readdir, stat, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'photos');
const OUT = path.join(ROOT, 'public', 'photos');
const CATEGORIES = ['live-music', 'street', 'abstract', 'other'];
const FEATURED = 'featured';
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.avif']);

// [suffix, max edge, webp quality, avif quality]
const RENDITIONS = [
  ['l', 1600, 76, 50],
  ['t', 840, 72, 48],
  ['s', 420, 74, 50],
];
const FORMATS = ['webp', 'avif'];

// Bump when encode params (sizes/quality/formats) change so a re-run
// regenerates outputs for sources that are otherwise unchanged (the hash
// check alone wouldn't notice a params-only change).
const PIPELINE_VERSION = 3;

// Six encodes per photo is enough work that doing them one image at a time
// leaves most of the machine idle. Give each image a single libvips thread and
// run several images at once instead — that scales far better across ~150
// photos than libvips parallelising within one small resize.
const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length));
sharp.concurrency(1);

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'photo';

const sha = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 16);

async function loadManifest(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return [];
  }
}

/** Runs `fn` over `items` with at most CONCURRENCY in flight; keeps order. */
async function mapLimit(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return out;
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

  const files = (await readdir(dir)).filter((f) => EXTS.has(path.extname(f).toLowerCase()));

  return mapLimit(files, async (file) => {
    const full = path.join(dir, file);
    const st = await stat(full);
    const base = slugify(path.basename(file, path.extname(file)));
    const id = `${group}/${base}`;
    const outPaths = RENDITIONS.flatMap(([suffix]) =>
      FORMATS.map((fmt) => path.join(outDir, `${base}_${suffix}.${fmt}`))
    );
    outPaths.forEach((p) => expectedOutputs.add(p));

    const buf = await readFile(full);
    const srcHash = sha(buf);

    const prev = prevById.get(id);
    if (
      prev &&
      prev.srcHash === srcHash &&
      prev.pipelineVersion === PIPELINE_VERSION &&
      outPaths.every((p) => existsSync(p))
    ) {
      counters.skipped++;
      return prev;
    }

    const img = sharp(buf, { failOn: 'none' }).rotate();
    const meta = await sharp(buf).metadata();
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
      //
      // We hand exifr the WHOLE file as a Buffer, which disables its chunked
      // reader. That reader only pulls the first slice of a file and requests
      // more as needed — but for large PNGs whose XMP chunk sits deep in the
      // file it could stop early and miss the date. How much it read turned
      // out to be filesystem-dependent, so it worked locally yet silently fell
      // back to mtime on the CI build server (giving every such photo the
      // deploy date). The full buffer removes that variability entirely.
      const ex = await exifr.parse(buf, { xmp: true, gps: false, icc: false });
      takenAt = ex?.DateTimeOriginal || ex?.CreateDate || ex?.DateCreated || ex?.ModifyDate || null;
    } catch {
      /* no exif — fall back to mtime */
    }
    if (!takenAt) {
      // No embedded date at all: fall back to the file's mtime (i.e. whenever
      // it was copied to disk). Warn loudly — a silent fallback here is exactly
      // what once made freshly-copied files all show today's date.
      takenAt = st.mtime;
      counters.noDate++;
      console.warn(`  ⚠ ${id}: no EXIF/XMP date, using file mtime (${st.mtime.toISOString()})`);
    }

    for (const [suffix, edge, webpQ, avifQ] of RENDITIONS) {
      const sized = img
        .clone()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true });
      await sized
        .clone()
        .webp({ quality: webpQ, effort: 6 })
        .toFile(path.join(outDir, `${base}_${suffix}.webp`));
      await sized
        .clone()
        .avif({ quality: avifQ, effort: 3 })
        .toFile(path.join(outDir, `${base}_${suffix}.avif`));
    }
    const tiny = await img.clone().resize(24).blur(1).webp({ quality: 40 }).toBuffer();

    counters.processed++;
    console.log(`  ${id} ok`);
    return {
      id,
      category: group,
      takenAt: new Date(takenAt).toISOString(),
      width,
      height,
      // Path stem shared by every rendition; src/lib/img.js appends the
      // `_<size>.<format>` suffix rather than the manifest listing all six.
      base: `/photos/${group}/${base}`,
      placeholder: `data:image/webp;base64,${tiny.toString('base64')}`,
      srcHash,
      pipelineVersion: PIPELINE_VERSION,
    };
  });
}

const byDateDesc = (a, b) => new Date(b.takenAt) - new Date(a.takenAt);

const expectedOutputs = new Set();
const counters = { processed: 0, skipped: 0, noDate: 0 };

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
if (counters.noDate > 0) {
  console.warn(
    `⚠ ${counters.noDate} image(s) had no embedded date and fell back to file mtime — ` +
      `check the warnings above; their gallery order may be wrong.`
  );
}
