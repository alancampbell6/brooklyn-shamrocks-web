// scripts/lib/foireann-transform.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  teamName,
  isByeFixture,
  isBrooklynName,
  involvesBrooklyn,
  normalizeTeamName,
} from './foireann-transform.js';

test('teamName prefers structured name, falls back, then TBC', () => {
  assert.equal(teamName({ homeTeam: { name: 'Sligo' } }, 'home'), 'Sligo');
  assert.equal(teamName({ homeTeamFallbackName: 'Winner R1' }, 'home'), 'Winner R1');
  assert.equal(teamName({}, 'away'), 'TBC');
});

test('isByeFixture detects BYE on either side, case-insensitively', () => {
  assert.equal(isByeFixture({ homeTeam: { name: 'BYE' }, awayTeam: { name: 'Cavan' } }), true);
  assert.equal(isByeFixture({ homeTeam: { name: 'Cavan' }, awayTeamFallbackName: 'bye' }), true);
  assert.equal(isByeFixture({ homeTeam: { name: 'Cavan' }, awayTeam: { name: 'Sligo' } }), false);
});

test('isBrooklynName matches brooklyn or shamrocks', () => {
  assert.equal(isBrooklynName('Brooklyn Shamrocks'), true);
  assert.equal(isBrooklynName('shamrocks GFC'), true);
  assert.equal(isBrooklynName('Sligo'), false);
  assert.equal(isBrooklynName(undefined), false);
});

test('involvesBrooklyn checks both sides', () => {
  assert.equal(involvesBrooklyn({ homeTeam: { name: 'Sligo' }, awayTeam: { name: 'Brooklyn Shamrocks' } }), true);
  assert.equal(involvesBrooklyn({ homeTeam: { name: 'Brooklyn Shamrocks' }, awayTeam: { name: 'Cavan' } }), true);
  assert.equal(involvesBrooklyn({ homeTeam: { name: 'Sligo' }, awayTeam: { name: 'Cavan' } }), false);
});

test('normalizeTeamName canonicalises Brooklyn, leaves others', () => {
  assert.equal(normalizeTeamName('Brooklyn shamrocks GFC'), 'Brooklyn Shamrocks');
  assert.equal(normalizeTeamName('Sligo'), 'Sligo');
});

// Task 2: New York date/time formatting
import { formatDateNY, formatTimeNY } from './foireann-transform.js';

test('formatDateNY returns YYYY-MM-DD in America/New_York', () => {
  // 2026-04-19T20:00:00Z is 4:00 PM EDT on the 19th in New York
  assert.equal(formatDateNY('2026-04-19T20:00:00Z'), '2026-04-19');
  // 2026-01-02T02:30:00Z is 9:30 PM EST on Jan 1st in New York
  assert.equal(formatDateNY('2026-01-02T02:30:00Z'), '2026-01-01');
  assert.equal(formatDateNY(undefined), '');
  assert.equal(formatDateNY('not-a-date'), '');
});

test('formatTimeNY returns "h:mm AM/PM" with an ASCII space', () => {
  assert.equal(formatTimeNY('2026-04-19T20:00:00Z'), '4:00 PM');
  assert.equal(formatTimeNY('2026-04-19T16:30:00Z'), '12:30 PM');
  assert.equal(formatTimeNY(undefined), 'TBD');
  assert.equal(formatTimeNY('not-a-date'), 'TBD');
  // The space before AM/PM must be a regular ASCII space (0x20), not the
  // U+202F narrow no-break space that Intl.DateTimeFormat.format() emits.
  const t = formatTimeNY('2026-04-19T20:00:00Z'); // '4:00 PM'
  assert.equal(t.charCodeAt(4), 0x20, 'expected ASCII space before AM/PM');
});

// Task 3: GAA score formatting
import { formatScore } from './foireann-transform.js';

test('formatScore renders goals-points with points padded to 2 digits', () => {
  assert.equal(formatScore({ goals: 4, points: 19 }), '4-19');
  assert.equal(formatScore({ goals: 1, points: 9 }), '1-09');
  assert.equal(formatScore({ goals: 0, points: 0 }), '0-00');
});

test('formatScore treats an omitted field as zero (real Foireann API behaviour)', () => {
  assert.equal(formatScore({ points: 12 }), '0-12');  // omitted goals = 0
  assert.equal(formatScore({ goals: 2 }), '2-00');    // omitted points = 0
});

test('formatScore returns "" only when both goals and points are absent', () => {
  assert.equal(formatScore({}), '');
  assert.equal(formatScore(undefined), '');
});

// Task 4: Competition name + Senior/Junior label
import {
  competitionDisplayName,
  canonicalCompetition,
  teamLabel,
} from './foireann-transform.js';

test('competitionDisplayName prefers a start-positioned sponsor prefix', () => {
  assert.equal(
    competitionDisplayName({ name: 'Senior Football Championship', sponsor: 'Navillus', sponsorPosition: 'start' }),
    'Navillus Senior Football Championship',
  );
  assert.equal(competitionDisplayName({ name: 'NY Senior Football League' }), 'NY Senior Football League');
  assert.equal(competitionDisplayName(undefined), 'Competition');
});

test('canonicalCompetition maps live Foireann names to canonical NY names', () => {
  assert.equal(canonicalCompetition('Navillus Senior Football Championship'), 'NY Senior Football Championship');
  assert.equal(canonicalCompetition('Junior B Football Championship'), 'NY Junior Football Championship');
  assert.equal(canonicalCompetition('MRS Junior B Football Championship'), 'NY Junior Football Championship');
  assert.equal(canonicalCompetition('Senior Football League'), 'NY Senior Football League');
  assert.equal(canonicalCompetition('Intermediate Football League'), 'NY Intermediate Football League');
  assert.equal(canonicalCompetition(undefined), 'NY Senior Football Championship');
});

test('teamLabel maps competition name to Senior/Junior Football', () => {
  assert.equal(teamLabel('NY Senior Football Championship'), 'Senior Football');
  assert.equal(teamLabel('NY Intermediate Football League'), 'Senior Football');
  assert.equal(teamLabel('NY Junior B Football Championship'), 'Junior Football');
  assert.equal(teamLabel(undefined), 'Senior Football');
});

// Task 5: mapFixture + selectBrooklyn pipeline
import { mapFixture, selectBrooklyn } from './foireann-transform.js';

const sampleResult = {
  id: 'abc123',
  isResult: true,
  startDate: '2026-04-19T20:00:00Z',
  round: 'Round 1',
  homeTeam: { name: 'Sligo', goals: 1, points: 11 },
  awayTeam: { name: 'Brooklyn shamrocks', goals: 1, points: 14 },
  place: { name: 'Gaelic Park, Bronx' },
  competition: { name: 'NY Senior Football Championship' },
};

test('mapFixture (result) maps every field into the results shape', () => {
  assert.deepEqual(mapFixture(sampleResult), {
    id: 'res-abc123',
    date: '2026-04-19',
    time: '4:00 PM',
    team1: 'Sligo',
    team2: 'Brooklyn Shamrocks',
    competition: 'NY Senior Football Championship',
    team: 'Senior Football',
    venue: 'Gaelic Park, Bronx',
    round: 'Round 1',
    score1: '1-11',
    score2: '1-14',
  });
});

test('mapFixture (fixture) omits scores and prefixes id with fix-', () => {
  const fx = { ...sampleResult, isResult: false, awayTeam: { name: 'Brooklyn Shamrocks' } };
  const out = mapFixture(fx);
  assert.equal(out.id, 'fix-abc123');
  assert.equal('score1' in out, false);
  assert.equal('score2' in out, false);
  assert.equal(out.venue, 'Gaelic Park, Bronx');
});

test('mapFixture defaults venue and round to empty strings', () => {
  const fx = { id: 'x', isResult: false, startDate: '2026-04-19T20:00:00Z',
    homeTeam: { name: 'Brooklyn Shamrocks' }, awayTeam: { name: 'Cavan' },
    competition: { name: 'NY Junior B Football Championship' } };
  const out = mapFixture(fx);
  assert.equal(out.venue, '');
  assert.equal(out.round, '');
  assert.equal(out.team, 'Junior Football');
});

test('selectBrooklyn keeps only Brooklyn games, drops BYE and TBC', () => {
  const fixtures = [
    { homeTeam: { name: 'Brooklyn Shamrocks' }, awayTeam: { name: 'Cavan' } },
    { homeTeam: { name: 'Sligo' }, awayTeam: { name: 'Cavan' } },
    { homeTeam: { name: 'Brooklyn Shamrocks' }, awayTeam: { name: 'BYE' } },
    { homeTeam: { name: 'Brooklyn Shamrocks' }, awayTeam: {} },
  ];
  const kept = selectBrooklyn(fixtures);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].awayTeam.name, 'Cavan');
});

// Task 1 (standings plan): groupLabel + standingsSortKey
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

// Task 2 (standings plan): standingRows
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
