# Foireann fixtures & results for Brooklyn Shamrocks — Design (runtime/SSR)

**Date:** 2026-06-15 (revised 2026-06-16 to runtime architecture)
**Status:** Approved

## Goal

Serve Brooklyn Shamrocks fixtures and results from the Foireann Open Data API
(`api.foireann.ie`) — the same source NYGAA uses — fetched **at request time** and
served from a **~5-minute cache**, replacing the SharePoint scraper, the daily
GitHub Actions cron, and the committed `src/data/*.json` fixture/result snapshots.
Only matches involving the club **Brooklyn Shamrocks** are shown.

## Context

- `brooklyn-shamrocks-web` is an Astro site, currently **fully static** (no adapter).
  `/matches` and `/` import `src/data/fixtures.json` / `results.json`.
- Those JSON files were regenerated daily by `.github/workflows/scrape.yml` running
  `scripts/scrape-sharepoint-fixtures.js` (Playwright + SharePoint) → ~70 automated
  commits. This whole pipeline is being removed.
- Hosting: **Vercel**. Men's GAA only — single NY GAA org id.

## Architecture (decided)

- Add the **`@astrojs/vercel`** adapter and set **`output: 'hybrid'`**. The site stays
  static except `/matches` and `/`, which set `export const prerender = false` and are
  rendered on demand (serverless).
- **Two-layer 5-minute cache** (mirrors NYGAA's `revalidate: 300`):
  - **Edge (primary):** dynamic pages set
    `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`. Vercel's CDN
    serves a cached render for 5 minutes; foireann is hit ~once per 5 min per region.
  - **In-memory (secondary):** the foireann client memoizes results for 300s, so
    multiple reads within one render — and repeat hits on a warm function — don't refetch.
- **Server-only** API key: read via `import.meta.env.FOIREANN_API_KEY` (no `PUBLIC_`
  prefix ⇒ never bundled to the browser). A client-side fetch is explicitly rejected
  because it would leak the key.

## Components

### `src/lib/foireann-transform.js` (moved, unchanged)
The pure transform/filter logic built earlier — `teamName`, `isByeFixture`,
`involvesBrooklyn`, `normalizeTeamName`, `formatDateNY`, `formatTimeNY`, `formatScore`,
`canonicalCompetition`, `teamLabel`, `mapFixture`, `selectBrooklyn` — moved from
`scripts/lib/` to `src/lib/` so Astro can import it. Its 17 `node:test` unit tests
move with it. Foireann's omit-zero score behaviour (e.g. `{points:12}` ⇒ `"0-12"`) is
already handled.

### `src/lib/foireann.js` (new, server-only)
The fetch + cache client.
- `BASE = 'https://api.foireann.ie/open-data'`, `SEASON` default `2026`
  (`import.meta.env.FOIREANN_SEASONS`, comma-split — first value or all), org id from
  `import.meta.env.FOIREANN_NY_ORG_ID`.
- `getFixtures()` and `getResults()`:
  - serve from module-level cache if `Date.now() < expires` (TTL 300_000 ms);
  - else GET `/v1/fixtures` with `owner.id`, `competition.season`, `isResult`,
    `size=200`, `sort` (asc for fixtures, desc for results), header
    `Authorization: Bearer <key>`, `Accept: application/json`;
  - `selectBrooklyn(...).map(mapFixture)`, sort, cache, return the array.
  - On missing key, non-200, or thrown error: log a warning and return `[]`
    (graceful empty — no stale fallback, per decision).
- Cache must be testable: accept an injectable clock (`now = () => Date.now()`) or
  export a reset helper, so the TTL behaviour can be unit-tested without real time.

### `src/pages/matches.astro` and `src/pages/index.astro` (modified)
- Add `export const prerender = false`.
- Replace `import fixturesData from '../data/fixtures.json'` /
  `import resultsData from '../data/results.json'` with
  `const fixturesData = { fixtures: await getFixtures() }` and
  `const resultsData = { results: await getResults() }` — preserving the exact shape the
  templates already consume (`fixturesData.fixtures`, `resultsData.results`). All
  downstream filtering, sorting, standings, badges, schema, and video matching are
  unchanged.
- Set the edge cache header, e.g.
  `Astro.response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')`.
- `videos.json` and `teamColors.json` remain static imports.

## Removals
- `scripts/scrape-sharepoint-fixtures.js`, `scripts/fetch-foireann.js` (if present),
  `.github/workflows/scrape.yml`, `src/data/fixtures.json`, `src/data/results.json`.
- Deps `playwright`, `xlsx` (only the scraper used them). Add `@astrojs/vercel`.

## Config & secrets
- Astro env (server-only): `FOIREANN_API_KEY`, `FOIREANN_NY_ORG_ID`, `FOIREANN_SEASONS`.
- Local `.env` (git-ignored) for dev; **Vercel Project → Environment Variables** for prod
  (the user sets these). `.env.example` documents them. Until set, live pages render empty.

## Consumption invariants preserved
Same as before: Brooklyn normalized to exactly `CLUB_NAME`; `team` ∈ {Senior Football,
Junior Football}; competition canonicalized to `NY {tier} Football {Championship|League}`
so the Tables tab matches; scores parse as `goals-points`; `round` populated for video
matching. (Standings remain Brooklyn-only/partial — a pre-existing UI trait, out of scope.)

## Verification
1. `npm test` — 17 transform tests + foireann-client cache tests pass.
2. `npm run dev` with local `.env` → `/matches` and `/` fetch live Brooklyn data; second
   load within 5 min is cache-served.
3. `npm run build` → hybrid + Vercel build compiles; static pages prerender, the two
   dynamic pages emit serverless functions.
