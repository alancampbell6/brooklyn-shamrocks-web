#!/usr/bin/env node
/**
 * Image Optimization Script
 * Generates WebP versions of the JPEG/PNG images. Originals are never
 * overwritten: re-encoding them on every run would lose quality each time.
 * For responsive AVIF/WebP sizes, see scripts/responsive-images.mjs.
 */

import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';

const IMAGES_DIR = './public/images';
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 80;

async function getImageFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getImageFiles(fullPath));
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function optimizeImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath, ext);
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));

  try {
    const originalStats = await stat(filePath);
    const originalSize = originalStats.size;

    // Read original image
    const image = sharp(filePath);
    const metadata = await image.metadata();

    // Resize if too large
    const resizeOptions = metadata.width > MAX_WIDTH
      ? { width: MAX_WIDTH, withoutEnlargement: true }
      : {};

    // Generate WebP version
    const webpPath = join(dir, `${name}.webp`);
    const webpBuffer = await sharp(filePath)
      .resize(resizeOptions)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    await sharp(webpBuffer).toFile(webpPath);

    const webpStats = await stat(webpPath);
    const webpSavings = ((originalSize - webpStats.size) / originalSize * 100).toFixed(1);

    console.log(`✓ ${basename(filePath)}`);
    console.log(`  Original: ${(originalSize / 1024).toFixed(0)}KB, WebP: ${(webpStats.size / 1024).toFixed(0)}KB (${webpSavings}% saved)`);

    return {
      file: filePath,
      originalSize,
      webpSize: webpStats.size
    };
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🖼️  Image Optimization Script\n');
  console.log('Settings:');
  console.log(`  Max width: ${MAX_WIDTH}px`);
  console.log(`  WebP quality: ${WEBP_QUALITY}\n`);

  const files = await getImageFiles(IMAGES_DIR);
  console.log(`Found ${files.length} images to optimize\n`);

  let totalOriginal = 0;
  let totalWebp = 0;

  for (const file of files) {
    const result = await optimizeImage(file);
    if (result) {
      totalOriginal += result.originalSize;
      totalWebp += result.webpSize;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Original total: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  WebP total: ${(totalWebp / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  WebP savings: ${((totalOriginal - totalWebp) / totalOriginal * 100).toFixed(1)}%`);
}

main().catch(console.error);
