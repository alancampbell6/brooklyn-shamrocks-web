// src/lib/foireann.js
// Server-only Foireann fetch client with 5-minute in-memory cache.
// Do NOT import this in browser code.
//
// NOTE: We deliberately avoid `import.meta.env` here — it is not available
// when this file is run under `node --test`. Astro/Vite populates process.env
// for server-side code; Vercel provides real env vars at runtime. Using
// process.env via the env() helper keeps this file fully testable in node:test.

import { selectBrooklyn, mapFixture } from './foireann-transform.js';

export const BASE = 'https://api.foireann.ie/open-data';
export const TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Read a server-side config value.
 * - `astro dev` loads `.env` into `import.meta.env` (not process.env).
 * - Vercel's Node runtime and `node --test` expose vars on `process.env`.
 * Check both so the client works in dev, production, and unit tests. The
 * optional chaining keeps this safe under node:test where import.meta.env
 * is undefined.
 */
function env(key) {
  let val;
  try {
    val = import.meta.env?.[key];
  } catch {
    val = undefined;
  }
  if (val == null && typeof process !== 'undefined' && process.env) {
    val = process.env[key];
  }
  return val || undefined;
}

// ─── Injectable clock (seam for tests) ───────────────────────────────────────
let now = () => Date.now();

/** Replace the clock used for TTL checks. Call with Date.now for production. */
export function __setClock(fn) {
  now = fn;
}

// ─── Module-level cache ───────────────────────────────────────────────────────
// Keyed by 'fixtures' or 'results'. Each entry: { value: rows[], expires: ms }.
const cache = {};

/** Clear all cached entries. Call between tests to ensure isolation. */
export function __resetCache() {
  delete cache.fixtures;
  delete cache.results;
}

// ─── Core loader ──────────────────────────────────────────────────────────────

/**
 * Load a page of Foireann data, with caching.
 * @param {string} cacheKey     - 'fixtures' or 'results'
 * @param {boolean} isResult    - true for results, false for upcoming fixtures
 * @param {string} sort         - value for the API `sort` parameter
 * @returns {Promise<object[]>} - array of mapped fixture/result objects
 */
async function load(cacheKey, isResult, sort) {
  // 1. Return cached value if still fresh.
  const entry = cache[cacheKey];
  if (entry && now() < entry.expires) {
    return entry.value;
  }

  // 2. Check config; bail early without caching on misconfiguration.
  const key = env('FOIREANN_API_KEY');
  const org = env('FOIREANN_NY_ORG_ID');
  if (!key || !org) {
    console.warn('[foireann] not configured — FOIREANN_API_KEY and/or FOIREANN_NY_ORG_ID missing');
    return [];
  }

  // 3. Resolve season (first value of comma-list, default '2026').
  const seasonRaw = env('FOIREANN_SEASONS');
  const season = (seasonRaw ? seasonRaw.split(',')[0].trim() : '') || '2026';

  // 4. Build URL.
  const params = new URLSearchParams({
    'owner.id': org,
    'competition.season': season,
    isResult: String(isResult),
    size: '200',
    sort,
  });
  const url = `${BASE}/v1/fixtures?${params}`;

  // 5. Fetch.
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[foireann] HTTP ${res.status} fetching ${cacheKey}`);
      return [];
    }

    // 6. Parse, filter, map, cache.
    const json = await res.json();
    const data = json.data ?? [];
    const rows = selectBrooklyn(data).map(mapFixture);
    cache[cacheKey] = { value: rows, expires: now() + TTL_MS };
    return rows;
  } catch (err) {
    console.warn('[foireann] fetch error:', err?.message ?? err);
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Upcoming fixtures for the Brooklyn Shamrocks (ascending by start date). */
export async function getFixtures() {
  return load('fixtures', false, 'startDate,asc');
}

/** Past results for the Brooklyn Shamrocks (descending by start date). */
export async function getResults() {
  return load('results', true, 'startDate,desc');
}
