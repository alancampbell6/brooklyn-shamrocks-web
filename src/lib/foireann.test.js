// src/lib/foireann.test.js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getFixtures, getResults, __resetCache, __setClock } from './foireann.js';

// ─── Minimal raw Foireann fixture factories ───────────────────────────────────

function makeRawFixture({ id = 'fx1', isResult = false, homeTeam = 'Brooklyn Shamrocks', awayTeam = 'Cork GFC' } = {}) {
  return {
    id,
    isResult,
    startDate: '2026-06-21T16:30:00Z',
    homeTeam: { name: homeTeam },
    awayTeam: { name: awayTeam },
    competition: { name: 'Navillus Senior Football Championship' },
    place: { name: 'Gaelic Park' },
  };
}

function makeRawResult({ id = 'res1' } = {}) {
  return {
    id,
    isResult: true,
    startDate: '2026-05-10T18:00:00Z',
    homeTeam: { name: 'Brooklyn Shamrocks', goals: 1, points: 14 },
    awayTeam: { name: 'Sligo GFC', goals: 2, points: 5 },
    competition: { name: 'Navillus Senior Football Championship' },
    place: { name: 'Gaelic Park' },
  };
}

// ─── Env + fetch helpers ──────────────────────────────────────────────────────

const ORIG_FETCH = globalThis.fetch;
const ORIG_API_KEY = process.env.FOIREANN_API_KEY;
const ORIG_ORG_ID = process.env.FOIREANN_NY_ORG_ID;

function setEnv() {
  process.env.FOIREANN_API_KEY = 'test-api-key';
  process.env.FOIREANN_NY_ORG_ID = '999';
}

function restoreEnv() {
  if (ORIG_API_KEY === undefined) delete process.env.FOIREANN_API_KEY;
  else process.env.FOIREANN_API_KEY = ORIG_API_KEY;
  if (ORIG_ORG_ID === undefined) delete process.env.FOIREANN_NY_ORG_ID;
  else process.env.FOIREANN_NY_ORG_ID = ORIG_ORG_ID;
}

function stubFetch(data, { ok = true, status = 200 } = {}) {
  let callCount = 0;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    callCount++;
    calls.push({ url: url.toString(), opts });
    if (!ok) return { ok: false, status };
    return { ok: true, status, json: async () => ({ data }) };
  };
  return { getCallCount: () => callCount, getCalls: () => calls };
}

// Reset between every test
beforeEach(() => {
  __resetCache();
  __setClock(() => Date.now());
  globalThis.fetch = ORIG_FETCH;
  restoreEnv();
});

afterEach(() => {
  globalThis.fetch = ORIG_FETCH;
  restoreEnv();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

// 1. maps + filters: returns only the Brooklyn fixture in site shape
test('getFixtures maps Brooklyn fixture and drops non-Brooklyn and BYE', async () => {
  setEnv();
  stubFetch([
    makeRawFixture({ id: 'keep', homeTeam: 'Brooklyn Shamrocks', awayTeam: 'Cork GFC' }),
    makeRawFixture({ id: 'drop-other', homeTeam: 'Sligo', awayTeam: 'Cork GFC' }),
    makeRawFixture({ id: 'drop-bye', homeTeam: 'Brooklyn Shamrocks', awayTeam: 'BYE' }),
  ]);

  const rows = await getFixtures();

  assert.equal(rows.length, 1, 'only the Brooklyn vs Cork fixture should survive');
  const [row] = rows;
  assert.equal(row.id, 'fix-keep');
  assert.equal(row.team1, 'Brooklyn Shamrocks');
  assert.equal(row.team2, 'Cork GFC');
  assert.equal(row.competition, 'NY Senior Football Championship');
  assert.equal(row.team, 'Senior Football');
  assert.equal('score1' in row, false, 'fixture rows must not have scores');
});

// 2. caches within TTL: second call does not re-fetch
test('getFixtures returns cached value within TTL (fetch called once)', async () => {
  setEnv();
  const t0 = Date.now();
  __setClock(() => t0); // frozen clock
  const { getCallCount } = stubFetch([makeRawFixture()]);

  const first = await getFixtures();
  const second = await getFixtures();

  assert.equal(getCallCount(), 1, 'fetch must be called exactly once within TTL');
  assert.deepEqual(first, second);
});

// 3. refetches after TTL expiry
test('getFixtures re-fetches after TTL expiry', async () => {
  setEnv();
  const TTL_MS = 5 * 60 * 1000;
  let fakeNow = Date.now();
  __setClock(() => fakeNow);
  const { getCallCount } = stubFetch([makeRawFixture()]);

  await getFixtures(); // call 1 — populates cache

  fakeNow += TTL_MS + 1; // advance past TTL

  await getFixtures(); // call 2 — cache expired, should re-fetch

  assert.equal(getCallCount(), 2, 'fetch must be called again after TTL expires');
});

// 4. graceful empty on non-200 response
test('getFixtures returns [] on non-200 response (no throw)', async () => {
  setEnv();
  stubFetch(null, { ok: false, status: 500 });

  const rows = await getFixtures();
  assert.deepEqual(rows, []);
});

// 5. graceful empty + no fetch call when API key missing
test('getFixtures returns [] without fetching when FOIREANN_API_KEY is unset', async () => {
  delete process.env.FOIREANN_API_KEY;
  process.env.FOIREANN_NY_ORG_ID = '999';
  const { getCallCount } = stubFetch([makeRawFixture()]);

  const rows = await getFixtures();

  assert.deepEqual(rows, []);
  assert.equal(getCallCount(), 0, 'fetch must not be called when key is missing');
});

// 6a. results path: getResults requests isResult=true and returns mapped results with scores
test('getResults requests isResult=true and maps scores', async () => {
  setEnv();
  const { getCalls } = stubFetch([makeRawResult()]);

  const rows = await getResults();

  assert.equal(rows.length, 1);
  const [row] = rows;
  // scores must be present
  assert.equal(row.score1, '1-14', 'score1 should reflect home team goals-points');
  assert.equal(row.score2, '2-05', 'score2 should reflect away team goals-points');
  assert.equal(row.id, 'res-res1');

  // URL must include isResult=true
  const url = getCalls()[0].url;
  assert.ok(url.includes('isResult=true'), `URL should include isResult=true, got: ${url}`);
});

// 6b. results path: getResults requests sort=startDate,desc
test('getResults uses descending sort by startDate', async () => {
  setEnv();
  const { getCalls } = stubFetch([makeRawResult()]);

  await getResults();

  const url = getCalls()[0].url;
  assert.ok(
    url.includes('sort=startDate%2Cdesc') || url.includes('sort=startDate,desc'),
    `URL should include sort=startDate,desc, got: ${url}`,
  );
});

// 6c. fixtures path: getFixtures requests isResult=false
test('getFixtures requests isResult=false', async () => {
  setEnv();
  const { getCalls } = stubFetch([makeRawFixture()]);

  await getFixtures();

  const url = getCalls()[0].url;
  assert.ok(url.includes('isResult=false'), `URL should include isResult=false, got: ${url}`);
});

// ─── getStandings tests ───────────────────────────────────────────────────────
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
