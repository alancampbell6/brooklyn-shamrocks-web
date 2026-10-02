#!/usr/bin/env node
/**
 * @astrojs/vercel v7 (the last version for Astro 4) only knows Node 18/20 and
 * labels functions `nodejs18.x` when built on anything newer. Vercel no longer
 * runs Node 18 or 20, so point the generated functions at the Node 24 runtime.
 * Remove this once Astro + the adapter are upgraded.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const FUNCTIONS_DIR = '.vercel/output/functions';
const RUNTIME = 'nodejs24.x';

async function findConfigs(dir) {
  const configs = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) configs.push(...await findConfigs(fullPath));
    else if (entry.name === '.vc-config.json') configs.push(fullPath);
  }
  return configs;
}

let configs = [];
try {
  configs = await findConfigs(FUNCTIONS_DIR);
} catch {
  // No Vercel output (e.g. local build without the adapter) — nothing to fix
}

for (const file of configs) {
  const config = JSON.parse(await readFile(file, 'utf8'));
  if (config.runtime?.startsWith('nodejs') && config.runtime !== RUNTIME) {
    console.log(`${file}: ${config.runtime} → ${RUNTIME}`);
    config.runtime = RUNTIME;
    await writeFile(file, JSON.stringify(config, null, '\t'));
  }
}
