# Foireann Runtime Fetch Implementation Plan

**Goal:** Serve Brooklyn Shamrocks fixtures/results from the Foireann API at request time, 5-min cached, on Vercel (hybrid). Remove the SharePoint scraper + cron + committed JSON.

**Architecture:** `@astrojs/vercel` adapter, `output: 'hybrid'`; `/matches` and `/` are `prerender=false`. Edge cache via `Cache-Control: s-maxage=300, stale-while-revalidate`; in-memory 300s TTL cache in the foireann client. Server-only API key.

---

## Task R1: Restore transform module to src/lib + adapter/config
- Move `scripts/lib/foireann-transform.js` (+ `.test.js`) → `src/lib/` (content unchanged; from /tmp/bsr-keep backup).
- `package.json`: `"test": "node --test src/lib/*.test.js"`; remove `scrape`/`fetch:foireann`; remove deps `playwright`,`xlsx`; add `@astrojs/vercel`.
- `npm install`.
- `astro.config.mjs`: add `import vercel from '@astrojs/vercel/serverless'`, `output: 'hybrid'`, `adapter: vercel()`.
- Verify: `npm test` → 17 pass.

## Task R2: `src/lib/foireann.js` client (TDD)
Server-only fetch + 300s TTL cache. `getFixtures()`, `getResults()`. Reads `import.meta.env` with `process.env` fallback. Graceful `[]` on missing key / non-200 / throw. Injectable clock for cache tests. Stub `globalThis.fetch` in tests; assert Brooklyn-only mapped output and that a 2nd call within TTL does not refetch.

## Task R3: Wire pages
`matches.astro` + `index.astro`: add `export const prerender = false`; replace JSON imports with `const fixturesData = { fixtures: await getFixtures() }` / `const resultsData = { results: await getResults() }`; set `Astro.response.headers.set('Cache-Control','public, s-maxage=300, stale-while-revalidate=600')`. Keep `videos.json`/`teamColors.json` static.

## Task R4: Removals + env/docs
Delete `scripts/scrape-sharepoint-fixtures.js`, `scripts/fetch-foireann.js` (if present), `.github/workflows/scrape.yml`, `src/data/fixtures.json`, `src/data/results.json`. Add `.env.example` (FOIREANN_API_KEY blank, FOIREANN_NY_ORG_ID default, FOIREANN_SEASONS=2026). Update README.

## Task R5: Verify
`npm test`; `npm run dev` + live `.env` → `/matches` & `/` show live Brooklyn data, 2nd hit cached; `npm run build` compiles (hybrid + serverless funcs for the 2 pages).
