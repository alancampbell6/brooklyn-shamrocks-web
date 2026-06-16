// scripts/lib/foireann-transform.js

/** Resolve a team's display name, preferring the structured name then fallback. */
export function teamName(fx, side) {
  const team = side === 'home' ? fx.homeTeam : fx.awayTeam;
  const fallback = side === 'home' ? fx.homeTeamFallbackName : fx.awayTeamFallbackName;
  return team?.name ?? fallback ?? 'TBC';
}

/** True when either side is a BYE (a free pass, not a real match). */
export function isByeFixture(fx) {
  const home = (fx.homeTeam?.name ?? fx.homeTeamFallbackName ?? '').trim().toUpperCase();
  const away = (fx.awayTeam?.name ?? fx.awayTeamFallbackName ?? '').trim().toUpperCase();
  return home === 'BYE' || away === 'BYE';
}

/** True when a team name belongs to the club (handles spelling variants). */
export function isBrooklynName(name) {
  return /brooklyn|shamrocks/i.test(name ?? '');
}

/** True when the club is the home or away team. */
export function involvesBrooklyn(fx) {
  return isBrooklynName(teamName(fx, 'home')) || isBrooklynName(teamName(fx, 'away'));
}

/** Normalise the club's own name to the canonical string the site compares against. */
export function normalizeTeamName(name) {
  return isBrooklynName(name) ? 'Brooklyn Shamrocks' : name;
}

const NY_TZ = 'America/New_York';

/** ISO timestamp -> "YYYY-MM-DD" in New York time, or "" when absent/invalid. */
export function formatDateNY(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // en-CA renders ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** ISO timestamp -> "h:mm AM/PM" in New York time, or "TBD" when absent/invalid. */
export function formatTimeNY(iso) {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBD';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
}

/** Render a team's GAA score as "goals-points" (points zero-padded to 2). */
export function formatScore(team) {
  if (!team) return '';
  const { goals, points } = team;
  if (goals == null && points == null) return '';
  return `${goals ?? 0}-${String(points ?? 0).padStart(2, '0')}`;
}

/** Foireann competition display name, with a leading sponsor prefix when set. */
export function competitionDisplayName(comp) {
  if (!comp?.name) return 'Competition';
  return comp.sponsor && comp.sponsorPosition === 'start'
    ? `${comp.sponsor} ${comp.name}`.trim()
    : comp.name;
}

/**
 * Canonical New York competition name for the site. Foireann names carry
 * sponsor prefixes (e.g. "Navillus Senior Football Championship") and grade
 * suffixes (e.g. "Junior B") that vary year to year; the site (Tables tab,
 * badges, Senior/Junior filter) keys off a small set of stable names, so we
 * derive one from the sport + tier + kind keywords.
 */
export function canonicalCompetition(name) {
  const n = (name ?? '').toLowerCase();
  const sport = n.includes('hurling') ? 'Hurling' : 'Football';
  const tier = n.includes('junior')
    ? 'Junior'
    : n.includes('intermediate')
      ? 'Intermediate'
      : 'Senior';
  const kind = n.includes('league') ? 'League' : 'Championship';
  return `NY ${tier} ${sport} ${kind}`;
}

/** Senior/Junior Football label used by the Senior/Junior filter buttons. */
export function teamLabel(competitionName) {
  const n = (competitionName ?? '').toLowerCase();
  if (n.includes('junior')) return 'Junior Football';
  // Senior, Intermediate, and anything else default to Senior Football.
  return 'Senior Football';
}

/** Map a Foireann fixture to the site's fixture/result JSON object. */
export function mapFixture(fx) {
  const isResult = Boolean(fx.isResult);
  const competition = canonicalCompetition(competitionDisplayName(fx.competition));
  const row = {
    id: `${isResult ? 'res' : 'fix'}-${fx.id}`,
    date: formatDateNY(fx.startDate),
    time: formatTimeNY(fx.startDate),
    team1: normalizeTeamName(teamName(fx, 'home')),
    team2: normalizeTeamName(teamName(fx, 'away')),
    competition,
    team: teamLabel(competition),
    venue: fx.place?.name ?? '',
    round: fx.round ?? '',
  };
  if (isResult) {
    row.score1 = formatScore(fx.homeTeam);
    row.score2 = formatScore(fx.awayTeam);
  }
  return row;
}

/** Keep only real Brooklyn Shamrocks matches (no BYE, no TBC opponent). */
export function selectBrooklyn(fixtures) {
  return fixtures.filter((fx) => {
    if (!involvesBrooklyn(fx) || isByeFixture(fx)) return false;
    return teamName(fx, 'home') !== 'TBC' && teamName(fx, 'away') !== 'TBC';
  });
}

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
