# Foireann league tables for Brooklyn's competitions — Design

**Date:** 2026-06-16
**Status:** Approved

## Goal

Replace the Tables tab's hand-computed, Brooklyn-only standings (which render
near-empty because opponents' other games aren't in the data) with foireann's
**official** standings, shown for **each competition Brooklyn Shamrocks plays in**.

## Why official tables

The foireann `/v1/competitions` endpoint returns each competition's
`divisions → leagues → teams` with authoritative `rank, played, won, drawn, lost,
pointsFor, pointsAgainst, totalPoints`. These already encode GAA scoring totals
(`pointsFor` = goals×3 + points), league points (2/win, 1/draw), group structure,
walkovers, and any CCC rulings — correct all season without us recomputing.

## Data observed (NY GAA, 2026)

Brooklyn appears in exactly **one division per competition**:
- **Senior Football Championship** — `league_knockout`, Brooklyn in division
  "Senior Football Championship - League Division 1" (7 teams).
- **Junior B Football Championship** — `league_knockout`, division
  "Junior B Football Championship " (8 teams).
- **Senior Football League** — `league`, division
  "Senior Football League - League Division 1" (7 teams).

## Components

### `src/lib/foireann.js` — new `getStandings()` (server-only, 5-min cache)
1. GET `${BASE}/v1/competitions?owner.id=<FOIREANN_NY_ORG_ID>&season=<season>`
   (same auth/env/cache pattern as `getFixtures`/`getResults`; `size=200`).
2. Walk `competitions → divisions → leagues`; keep each league whose `teams`
   contains a Brooklyn team (`isBrooklynName`). This selects only Brooklyn's
   competitions and Brooklyn's group.
3. Map each kept league to a table:
   ```
   {
     competition: string,  // canonicalCompetition(comp.name) — same labels as fixtures
     group: string,        // groupLabel(division.name, comp.name); '' when none
     rows: StandingRow[],
   }
   ```
4. Order tables: championships before leagues, then Senior → Intermediate → Junior,
   football before hurling (a small `standingsSortKey`). Return `[]` on missing
   config / non-200 / error (graceful, no caching of failures).

### `src/lib/foireann-transform.js` — new pure helpers (unit-tested)
- `groupLabel(divisionName, competitionName)` → the division's distinguishing
  suffix: strip the competition name and separators from the division name; e.g.
  `("Senior Football Championship - League Division 1", "Senior Football Championship")`
  → `"League Division 1"`; `("Junior B Football Championship ", "Junior B Football Championship")`
  → `""`. Returns `''` when nothing distinguishing remains.
- `standingRows(teams)` → maps foireann league `teams[]` to row objects and sorts
  them:
  ```
  { team, rank, played, wins, draws, losses, pointsFor, pointsAgainst, pointsDiff, totalPoints, isClub }
  ```
  - `team`: `normalizeTeamName(name)` (Brooklyn → exactly `CLUB_NAME`).
  - `wins/draws/losses` from foireann `won/drawn/lost`; `pointsFor/pointsAgainst`
    direct; `pointsDiff = pointsFor - pointsAgainst`; `totalPoints` direct;
    `rank` direct; `isClub = isBrooklynName(name)`.
  - Sort by `rank` asc, tiebreak `totalPoints` desc → `pointsDiff` desc →
    `pointsFor` desc → `team` asc.
  Field names match the existing Tables markup so rendering changes stay minimal.

### `src/pages/matches.astro` — Tables tab
- Remove the `Standing` interface, `buildStandings`, and the
  `seniorStandings`/`juniorStandings` consts.
- Add `import { getFixtures, getResults, getStandings } from '../lib/foireann.js'`
  and `const standings = await getStandings();`.
- Replace the two hardcoded table blocks with a single loop over `standings`,
  rendering the existing table markup (Pos `#` = row index+1, Team with crest/colour,
  P/W/D/L/F/A/+−/Pts, Brooklyn row highlighted via `row.team === CLUB_NAME`). Show
  the `group` as a muted subtitle in the header when non-empty.
- Empty state: when `standings.length === 0`, show a small note
  "League tables will appear once competitions are underway."

## Consumption / invariants
- Table headings reuse `canonicalCompetition`, matching the labels on fixtures and
  results lozenges.
- `getColor(team)` and the crest highlight already fall back gracefully for opponent
  names with `GFC`/`GAA` suffixes (unchanged behaviour).
- No client exposure: `getStandings` is only called server-side from the
  `prerender = false` page; the API key stays server-only.

## Testing / verification
1. `npm test` — new `groupLabel` and `standingRows` unit tests pass alongside existing.
2. `npm run dev` — Tables tab shows three tables (Senior Championship with Brooklyn
   #2 on 2 pts, Junior Championship, Senior League with Cavan top on 4 pts), Brooklyn
   highlighted, columns correct.
3. `npm run build` — hybrid build compiles.
