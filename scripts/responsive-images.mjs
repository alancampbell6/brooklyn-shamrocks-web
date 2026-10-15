#!/usr/bin/env node
/**
 * Responsive image variants
 *
 * Reads the original photos in public/images (never modifies them) and writes
 * AVIF + WebP copies at several widths to public/images/responsive/, plus a
 * manifest (src/data/responsive-images.json) that <ResponsiveImage> uses to
 * build srcset and width/height. Re-run after adding or replacing a photo:
 *
 *   node scripts/responsive-images.mjs
 */

import sharp from 'sharp';
import { readdir, mkdir, writeFile, stat } from 'fs/promises';
import { join, dirname, relative, extname } from 'path';

const PUBLIC = './public';
const OUT_DIR = 'images/responsive';
const MANIFEST = './src/data/responsive-images.json';

// Each group: which originals, which widths, and encoder quality.
// The hero sits under a 75% green overlay, so it tolerates lower quality.
const GROUPS = [
  { files: ['images/hero-team-huddle.jpg'], widths: [640, 960, 1280, 1536], avif: 45, webp: 60 },
  { files: ['images/dinner-dance-2026.jpg'], widths: [480, 768, 1024], avif: 55, webp: 72 },
  { dir: 'images/history', widths: [400, 800, 1200], avif: 55, webp: 72 },
];

async function listOriginals(dir) {
  const entries = await readdir(join(PUBLIC, dir));
  return entries.filter((f) => /\.(jpe?g|png)$/i.test(f)).map((f) => `${dir}/${f}`);
}

async function main() {
  const manifest = {};
  let total = 0;

  for (const group of GROUPS) {
    const files = group.files ?? (await listOriginals(group.dir));
    for (const file of files) {
      const src = join(PUBLIC, file);
      const { width, height } = await sharp(src).metadata();
      const base = file.slice('images/'.length, -extname(file).length);
      const widths = [...new Set(group.widths.map((w) => Math.min(w, width)))];

      for (const w of widths) {
        for (const fmt of ['avif', 'webp']) {
          const out = join(PUBLIC, OUT_DIR, `${base}-${w}.${fmt}`);
          await mkdir(dirname(out), { recursive: true });
          const pipeline = sharp(src).resize({ width: w, withoutEnlargement: true });
          await (fmt === 'avif'
            ? pipeline.avif({ quality: group.avif, effort: 6 })
            : pipeline.webp({ quality: group.webp, effort: 6 })
          ).toFile(out);
          total += (await stat(out)).size;
        }
      }

      manifest[`/${file}`] = { width, height, base: `/${OUT_DIR}/${base}`, widths };
      console.log(`✓ ${file} (${width}x${height}) → ${widths.join(', ')}w`);
    }
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n${Object.keys(manifest).length} images, ${(total / 1024 / 1024).toFixed(2)}MB of variants`);
  console.log(`Manifest: ${relative('.', MANIFEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
