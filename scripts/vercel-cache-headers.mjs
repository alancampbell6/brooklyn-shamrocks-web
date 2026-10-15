#!/usr/bin/env node
/**
 * Files in public/ keep their names between deploys, so Vercel serves them with
 * `max-age=0, must-revalidate` and every repeat visit re-checks every image.
 * Add a browser cache lifetime for them to the Build Output API routes. Names
 * aren't content-hashed, so this is a day fresh plus a month of
 * stale-while-revalidate rather than `immutable`.
 */

import { readFile, writeFile } from 'fs/promises';

const CONFIG = '.vercel/output/config.json';
const CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=2592000';
const ROUTE = {
  src: '^/(images/.*|favicon[^/]*|apple-touch-icon\\.png|icon-\\d+\\.png|site\\.webmanifest)$',
  headers: { 'cache-control': CACHE_CONTROL },
  continue: true,
};

let config;
try {
  config = JSON.parse(await readFile(CONFIG, 'utf8'));
} catch {
  process.exit(0); // No Vercel output (e.g. local build without the adapter)
}

if (!config.routes.some((r) => r.src === ROUTE.src)) {
  // Header routes must come before the filesystem handler to apply to static files.
  const at = config.routes.findIndex((r) => r.handle === 'filesystem');
  config.routes.splice(at === -1 ? 0 : at, 0, ROUTE);
  await writeFile(CONFIG, JSON.stringify(config, null, '\t'));
  console.log(`${CONFIG}: cache-control for public assets → ${CACHE_CONTROL}`);
}
