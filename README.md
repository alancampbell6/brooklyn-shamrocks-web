# Brooklyn Shamrocks GAA Club Website

Built with [Astro](https://astro.build/), deployed on Vercel.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in FOIREANN_API_KEY
npm run dev
```

## Fixtures & results data

Fixtures and results come from the **Foireann Open Data API**, fetched at request
time and served from a ~5-minute cache. There is no committed fixtures data and no
scraper — the data is always live.

- The site is a hybrid Astro build: every page is static **except** `/matches` and the
  homepage, which set `export const prerender = false` and are server-rendered on demand
  (Vercel serverless) to fetch live data.
- `src/lib/foireann.js` is the server-only client. It fetches the New York GAA board,
  filters to the **Brooklyn Shamrocks** club, and caches results in-memory for 5 minutes.
  The two dynamic pages also send `Cache-Control: s-maxage=300` so Vercel's CDN serves a
  cached render for 5 minutes (foireann is hit at most ~once per 5 min per region).
- `src/lib/foireann-transform.js` holds the pure mapping/filtering logic (unit-tested).

### Configuration

Set these environment variables (server-only — never prefix with `PUBLIC_`):

| Variable | Notes |
| --- | --- |
| `FOIREANN_API_KEY` | Required. Request via Foireann support. |
| `FOIREANN_NY_ORG_ID` | New York GAA org id (default in `.env.example`). |
| `FOIREANN_SEASONS` | Season to fetch, e.g. `2026`. Bump for a new year. |

- **Local dev:** put them in `.env` (git-ignored; loaded by Astro into `import.meta.env`).
- **Production:** set them in the **Vercel project → Settings → Environment Variables**.

If the API key is missing or the API is unreachable, the pages render empty (graceful) —
no stale fallback.

## Commands

| Command           | Action                                |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start local dev server                |
| `npm run build`   | Build the production site (Vercel)    |
| `npm run preview` | Preview the production build          |
| `npm test`        | Run unit tests (`node --test`)        |
