#!/usr/bin/env node
/**
 * Image Optimization Script
 * Compresses JPEG/PNG images and generates WebP versions
 */

import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';

const IMAGES_DIR = './public/images';
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 80;
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

    // Optimize original format
    let optimized;
    if (ext === '.png') {
      optimized = await image
        .resize(resizeOptions)
        .png({ quality: JPEG_QUALITY, compressionLevel: 9 })
        .toBuffer();
    } else {
      optimized = await image
        .resize(resizeOptions)
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
    }

    // Generate WebP version
    const webpPath = join(dir, `${name}.webp`);
    const webpBuffer = await sharp(filePath)
      .resize(resizeOptions)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // Write optimized files
    await sharp(optimized).toFile(filePath);
    await sharp(webpBuffer).toFile(webpPath);

    const newStats = await stat(filePath);
    const webpStats = await stat(webpPath);

    const savings = ((originalSize - newStats.size) / originalSize * 100).toFixed(1);
    const webpSavings = ((originalSize - webpStats.size) / originalSize * 100).toFixed(1);

    console.log(`✓ ${basename(filePath)}`);
    console.log(`  Original: ${(originalSize / 1024).toFixed(0)}KB → ${(newStats.size / 1024).toFixed(0)}KB (${savings}% saved)`);
    console.log(`  WebP: ${(webpStats.size / 1024).toFixed(0)}KB (${webpSavings}% saved)`);

    return {
      file: filePath,
      originalSize,
      newSize: newStats.size,
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
  console.log(`  JPEG quality: ${JPEG_QUALITY}`);
  console.log(`  WebP quality: ${WEBP_QUALITY}\n`);

  const files = await getImageFiles(IMAGES_DIR);
  console.log(`Found ${files.length} images to optimize\n`);

  let totalOriginal = 0;
  let totalNew = 0;
  let totalWebp = 0;

  for (const file of files) {
    const result = await optimizeImage(file);
    if (result) {
      totalOriginal += result.originalSize;
      totalNew += result.newSize;
      totalWebp += result.webpSize;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Original total: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Optimized total: ${(totalNew / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  WebP total: ${(totalWebp / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Total savings: ${((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1)}%`);
  console.log(`  WebP savings: ${((totalOriginal - totalWebp) / totalOriginal * 100).toFixed(1)}%`);
}

main().catch(console.error);
