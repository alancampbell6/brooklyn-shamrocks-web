# Foireann League Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show foireann's official standings for each competition Brooklyn Shamrocks plays in, on the Tables tab of `/matches`, replacing the hand-computed Brooklyn-only standings.

**Architecture:** New pure helpers (`groupLabel`, `standingsSortKey`, `standingRows`) in `src/lib/foireann-transform.js`; a new server-only `getStandings()` in `src/lib/foireann.js` that fetches `/v1/competitions`, keeps the leagues containing Brooklyn, and returns ready-to-render tables (5-min cached). `matches.astro` renders one table per returned entry.

**Tech Stack:** Astro 4 (hybrid/Vercel), Node `node:test`.

---

## File structure
- Modify: `src/lib/foireann-transform.js` (+ `.test.js`) — add `groupLabel`, `standingsSortKey`, `standingRows`.
- Modify: `src/lib/foireann.js` (+ `.test.js`) — add `getStandings`, extend cache reset, import new helpers.
- Modify: `src/pages/matches.astro` — replace Tables-tab data + markup.

---

## Task 1: Pure helpers `groupLabel` + `standingsSortKey`

**Files:** Modify `src/lib/foireann-transform.js`; Test `src/lib/foireann-transform.test.js`

- [ ] **Step 1: Add failing tests**

```js
// append to src/lib/foireann-transform.test.js
import { groupLabel, standingsSortKey } from './foireann-transform.js';

test('groupLabel strips the competition name and separators from the division name', () => {
  assert.equal(groupLabel('Senior Football Championship - League Division 1', 'Senior Football Championship'), 'League Division 1');
  assert.equal(groupLabel('Senior Football League - League Division 1', 'Senior Football League'), 'League Division 1');
  assert.equal(groupLabel('Junior B Football Championship ', 'Junior B Football Championship'), '');
  assert.equal(groupLabel('Group A', 'Senior Football Championship'), 'Group A');
  assert.equal(groupLabel(undefined, 'x'), '');
});

test('standingsSortKey orders championships before leagues, senior→junior, football before hurling', () => {
  const order = [
    'NY Senior Football Championship',
    'NY Junior Football Championship',
    'NY Senior Football League',
    'NY Senior Hurling Championship',
  ].map(standingsSortKey);
  // strictly increasing in the intended display order
  assert.ok(order[0] < order[1] && order[1] < order[2] && order[2] < order[3]);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `groupLabel`/`standingsSortKey` not exported.

- [ ] **Step 3: Implement**

```js
// append to src/lib/foireann-transform.js

/** The division's distinguishing suffix (e.g. "League Division 1"); '' when none. */
export function groupLabel(divisionName, competitionName) {
  if (!divisionName) return '';
  let s = String(divisionName).trim();
  const comp = String(competitionName ?? '').trim();
  if (comp && s.toLowerCase().startsWith(comp.toLowerCase())) {
    s = s.slice(comp.length);
  }
  return s.replace(/^[\s\-–—:]+/, '').trim();
}

/** Display order for standings tables: championship before league, senior→junior, football before hurling. */
export function standingsSortKey(name) {
  const n = (name ?? '').toLowerCase();
  const sport = n.includes('hurling') ? 1 : 0;
  const kind = n.includes('league') ? 1 : 0;
  const tier = n.includes('junior') ? 2 : n.includes('intermediate') ? 1 : 0;
  return sport * 100 + kind * 10 + tier;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/foireann-transform.js src/lib/foireann-transform.test.js
git commit -m "feat: groupLabel and standingsSortKey helpers"
```

---

## Task 2: Pure helper `standingRows`

**Files:** Modify `src/lib/foireann-transform.js`; Test `src/lib/foireann-transform.test.js`

- [ ] **Step 1: Add failing tests**

```js
// append to src/lib/foireann-transform.test.js
import { standingRows } from './foireann-transform.js';

test('standingRows maps Foireann league teams, flags the club, and sorts by rank', () => {
  const teams = [
    { name: 'Kerry GFC', rank: 1, played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 23, pointsAgainst: 13, totalPoints: 2 },
    { name: 'Brooklyn shamrocks', rank: 2, played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 23, pointsAgainst: 21, totalPoints: 2 },
  ];
  const rows = standingRows(teams);
  assert.equal(rows[0].team, 'Kerry GFC');
  assert.deepEqual(rows[1], {
    team: 'Brooklyn Shamrocks', rank: 2, played: 1, wins: 1, draws: 0, losses: 0,
    pointsFor: 23, pointsAgainst: 21, pointsDiff: 2, totalPoints: 2, isClub: true,
  });
  assert.equal(rows[0].isClub, false);
});

test('standingRows defaults missing numbers to 0 and sorts a clubless table by rank', () => {
  const rows = standingRows([
    { name: 'B', rank: 2 },
    { name: 'A', rank: 1, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, totalPoints: 0 },
  ]);
  assert.equal(rows[0].team, 'A');
  assert.equal(rows[1].played, 0);
  assert.equal(rows[1].pointsDiff, 0);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `standingRows` not exported.

- [ ] **Step 3: Implement**

```js
// append to src/lib/foireann-transform.js

/** Map Foireann league teams to standings rows (club normalized + flagged), sorted. */
export function standingRows(teams) {
  const rows = (teams ?? []).map((t) => {
    const pointsFor = t.pointsFor ?? 0;
    const pointsAgainst = t.pointsAgainst ?? 0;
    return {
      team: normalizeTeamName(t.name ?? ''),
      rank: t.rank ?? null,
      played: t.played ?? 0,
      wins: t.won ?? 0,
      draws: t.drawn ?? 0,
      losses: t.lost ?? 0,
      pointsFor,
      pointsAgainst,
      pointsDiff: pointsFor - pointsAgainst,
      totalPoints: t.totalPoints ?? 0,
      isClub: isBrooklynName(t.name),
    };
  });
  rows.sort(
    (a, b) =>
      (a.rank ?? 999) - (b.rank ?? 999) ||
      b.totalPoints - a.totalPoints ||
      b.pointsDiff - a.pointsDiff ||
      b.pointsFor - a.pointsFor ||
      a.team.localeCompare(b.team),
  );
  return rows;
}
```

(`normalizeTeamName` and `isBrooklynName` already exist in this module.)

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/foireann-transform.js src/lib/foireann-transform.test.js
git commit -m "feat: standingRows helper"
```

---

## Task 3: `getStandings()` in the Foireann client

**Files:** Modify `src/lib/foireann.js`; Test `src/lib/foireann.test.js`

- [ ] **Step 1: Add failing tests**

```js
// append to src/lib/foireann.test.js
// (reuses the existing test harness in this file: __resetCache, fetch stubbing,
//  and process.env setup. Mirror the existing tests' setup/teardown style.)
import { getStandings } from './foireann.js';

test('getStandings returns only leagues containing Brooklyn, mapped and labelled', async () => {
  __resetCache();
  process.env.FOIREANN_API_KEY = 'k';
  process.env.FOIREANN_NY_ORG_ID = 'o';
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          name: 'Senior Football Championship',
          divisions: [
            { name: 'Senior Football Championship - League Division 1',
              leagues: [{ teams: [
                { name: 'Kerry GFC', rank: 1, played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 23, pointsAgainst: 13, totalPoints: 2 },
                { name: 'Brooklyn Shamrocks', rank: 2, played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 23, pointsAgainst: 21, totalPoints: 2 },
              ] }] },
            { name: 'Senior Football Championship - League Division 2',
              leagues: [{ teams: [ { name: 'Cork GFC', rank: 1 } ] }] }, // no Brooklyn → excluded
          ],
        },
      ],
    }),
  });
  const tables = await getStandings();
  assert.equal(tables.length, 1);
  assert.equal(tables[0].competition, 'NY Senior Football Championship');
  assert.equal(tables[0].group, 'League Division 1');
  assert.equal(tables[0].rows.length, 2);
  assert.equal(tables[0].rows[1].team, 'Brooklyn Shamrocks');
  assert.equal(tables[0].rows[1].isClub, true);
  delete process.env.FOIREANN_API_KEY; delete process.env.FOIREANN_NY_ORG_ID;
});

test('getStandings returns [] without fetching when the key is missing', async () => {
  __resetCache();
  delete process.env.FOIREANN_API_KEY;
  let called = false;
  globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const tables = await getStandings();
  assert.deepEqual(tables, []);
  assert.equal(called, false);
});

test('getStandings returns [] on a non-200 response', async () => {
  __resetCache();
  process.env.FOIREANN_API_KEY = 'k';
  process.env.FOIREANN_NY_ORG_ID = 'o';
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  assert.deepEqual(await getStandings(), []);
  delete process.env.FOIREANN_API_KEY; delete process.env.FOIREANN_NY_ORG_ID;
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `getStandings` not exported.

- [ ] **Step 3: Implement**

In `src/lib/foireann.js`, extend the transform import and add the function. Update the import line:

```js
import {
  selectBrooklyn,
  mapFixture,
  isBrooklynName,
  canonicalCompetition,
  groupLabel,
  standingsSortKey,
  standingRows,
} from './foireann-transform.js';
```

Add `'standings'` to `__resetCache`:

```js
export function __resetCache() {
  delete cache.fixtures;
  delete cache.results;
  delete cache.standings;
}
```

Add a season helper (DRY) near the top of the module body and use it; then add `getStandings`:

```js
/** Current season: first value of FOIREANN_SEASONS, default '2026'. */
function currentSeason() {
  const raw = env('FOIREANN_SEASONS');
  return (raw ? raw.split(',')[0].trim() : '') || '2026';
}

/** Official standings for each competition the club plays in (5-minute cache). */
export async function getStandings() {
  const entry = cache.standings;
  if (entry && now() < entry.expires) return entry.value;

  const key = env('FOIREANN_API_KEY');
  const org = env('FOIREANN_NY_ORG_ID');
  if (!key || !org) {
    console.warn('[foireann] not configured — FOIREANN_API_KEY and/or FOIREANN_NY_ORG_ID missing');
    return [];
  }

  const params = new URLSearchParams({ 'owner.id': org, season: currentSeason(), size: '200' });
  const url = `${BASE}/v1/competitions?${params}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[foireann] HTTP ${res.status} fetching competitions`);
      return [];
    }
    const comps = (await res.json()).data ?? [];
    const tables = [];
    for (const c of comps) {
      for (const dv of c.divisions ?? []) {
        for (const lg of dv.leagues ?? []) {
          const teams = lg.teams ?? [];
          if (teams.some((t) => isBrooklynName(t.name))) {
            tables.push({
              competition: canonicalCompetition(c.name),
              group: groupLabel(dv.name, c.name),
              rows: standingRows(teams),
            });
          }
        }
      }
    }
    tables.sort((a, b) => standingsSortKey(a.competition) - standingsSortKey(b.competition));
    cache.standings = { value: tables, expires: now() + TTL_MS };
    return tables;
  } catch (err) {
    console.warn('[foireann] competitions fetch error:', err?.message ?? err);
    return [];
  }
}
```

Optionally refactor `load()` to use `currentSeason()` in place of its inline season parsing (same behaviour). Leave the rest of `load` unchanged.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: PASS (all existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/foireann.js src/lib/foireann.test.js
git commit -m "feat: getStandings — official Foireann tables for the club's competitions"
```

---

## Task 4: Render the Tables tab from `getStandings()`

**Files:** Modify `src/pages/matches.astro`

- [ ] **Step 1: Update the data layer (frontmatter)**

Change the foireann import to include `getStandings` (the line currently imports `getFixtures, getResults`):

```js
import { getFixtures, getResults, getStandings } from '../lib/foireann.js';
```

Add, alongside the existing `const fixturesData = ...` / `const resultsData = ...`:

```js
const standings = await getStandings();
```

Delete the `Standing` interface, the entire `buildStandings` function, and the two lines:

```js
const seniorStandings = buildStandings('NY Senior Football Championship');
const juniorStandings = buildStandings('NY Junior Football Championship');
```

(`parseGAAScore` may now be unused in the frontmatter — if so, remove it from the `../lib/gaa` import. Verify it isn't referenced elsewhere in the file first; the results-outcome code uses `getOutcome`, not `parseGAAScore`.)

- [ ] **Step 2: Replace the Tables panel markup**

Replace the two hardcoded standings blocks (the `{seniorStandings.length > 0 && (...)}` block and the `{juniorStandings.length > 0 && (...)}` block) inside `<div id="panel-tables" ...>` with a single loop plus an empty state:

```astro
        <div class="space-y-8">
          {standings.length === 0 && (
            <p class="text-center text-sm text-gray-500 py-8">
              League tables will appear once competitions are underway.
            </p>
          )}
          {standings.map((tbl) => (
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div class="bg-shamrock-900 px-4 py-3">
                <h3 class="text-sm font-bold text-white uppercase tracking-wide">{tbl.competition}</h3>
                {tbl.group && <p class="text-xs text-shamrock-200 mt-0.5">{tbl.group}</p>}
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-200 bg-gray-50">
                      <th class="text-left pl-4 pr-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-8">#</th>
                      <th class="text-left px-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide">Team</th>
                      <th class="text-center px-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-10">P</th>
                      <th class="text-center px-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-10">W</th>
                      <th class="text-center px-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-10">D</th>
                      <th class="text-center px-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-10">L</th>
                      <th class="text-center px-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-14 hidden sm:table-cell">F</th>
                      <th class="text-center px-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-14 hidden sm:table-cell">A</th>
                      <th class="text-center px-2 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-14">+/-</th>
                      <th class="text-center px-2 pr-4 py-3 font-bold text-gray-500 uppercase text-xs tracking-wide w-12">Pts</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    {tbl.rows.map((s, i) => (
                      <tr class={`hover:bg-gray-50 transition-colors ${s.team === CLUB_NAME ? 'bg-shamrock-50' : ''}`}>
                        <td class="pl-4 pr-2 py-3 text-gray-400 font-semibold">{i + 1}</td>
                        <td class="px-2 py-3">
                          <div class="flex items-center gap-2.5">
                            <div class="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={s.team === CLUB_NAME ? '' : `background-color: ${getColor(s.team)}`}>
                              {s.team === CLUB_NAME ? (
                                <img src="/images/crest_white_bg.png" alt={CLUB_NAME} width="22" height="22" loading="lazy" class="w-[22px] h-[22px] object-contain" />
                              ) : (
                                <span class="text-white font-bold text-[10px]">{s.team.substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <span class={`font-semibold ${s.team === CLUB_NAME ? 'text-shamrock-700' : 'text-gray-900'}`}>{s.team}</span>
                          </div>
                        </td>
                        <td class="text-center px-2 py-3 font-semibold text-gray-700">{s.played}</td>
                        <td class="text-center px-2 py-3 text-gray-600">{s.wins}</td>
                        <td class="text-center px-2 py-3 text-gray-600">{s.draws}</td>
                        <td class="text-center px-2 py-3 text-gray-600">{s.losses}</td>
                        <td class="text-center px-2 py-3 text-gray-600 hidden sm:table-cell">{s.pointsFor}</td>
                        <td class="text-center px-2 py-3 text-gray-600 hidden sm:table-cell">{s.pointsAgainst}</td>
                        <td class="text-center px-2 py-3 font-semibold text-gray-700">{s.pointsDiff > 0 ? `+${s.pointsDiff}` : s.pointsDiff}</td>
                        <td class="text-center px-2 pr-4 py-3 font-bold text-shamrock-700">{s.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
```

- [ ] **Step 3: Build to verify it compiles**

Run: `npm run build`
Expected: `[build] Complete!` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/matches.astro
git commit -m "feat: render official Foireann standings on the Tables tab"
```

---

## Task 5: Live verification

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Dev server with live data**

Run: `npm run dev` (with the local `.env` present), then load `http://localhost:4321/matches` and open the Tables tab.
Expected: three tables — **NY Senior Football Championship** (Brooklyn 2nd, 2 pts), **NY Junior Football Championship** (Brooklyn listed), **NY Senior Football League** (Cavan top, 4 pts). Brooklyn's row highlighted; P/W/D/L/F/A/+−/Pts populated.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `[build] Complete!`.

---

## Self-Review

- **Spec coverage:** official tables via `/v1/competitions` (T3); Brooklyn-only via team-name match (T3); `groupLabel`/`standingRows`/`standingsSortKey` (T1–T2); canonical headings + group subtitle, highlight, empty state (T4); removal of `buildStandings` (T4); 5-min cache + graceful empty (T3); verification (T5). Covered.
- **Type/name consistency:** row fields `team/rank/played/wins/draws/losses/pointsFor/pointsAgainst/pointsDiff/totalPoints/isClub` match between `standingRows` (T2) and the markup (T4); table shape `{competition, group, rows}` matches between `getStandings` (T3) and the markup (T4); `__resetCache` clears `standings` (T3). Consistent.
- **No placeholders:** all steps contain complete code/commands.
