/**
 * Fixture & Results Scraper for Brooklyn Shamrocks GAA
 *
 * Scrapes from Final Whistle: https://www.finalwhistle.ie/gaelic/team/brooklyn-shamrocks/
 *
 * Usage:
 *   node scripts/scrape-fixtures.js
 */

import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  teamUrl: 'https://www.finalwhistle.ie/gaelic/team/brooklyn-shamrocks/',
  teamName: 'Brooklyn Shamrocks',
  outputFixturesPath: join(__dirname, '../src/data/fixtures.json'),
  outputResultsPath: join(__dirname, '../src/data/results.json'),
};

// Map competition names to readable format
const COMPETITION_MAP = {
  'New York SFC': 'NY Senior Football Championship',
  'New York Senior Football Championship': 'NY Senior Football Championship',
  'New York JFC': 'NY Junior Football Championship',
  'New York Junior Football Championship': 'NY Junior Football Championship',
  'NY GAA': 'NY GAA',
};

/**
 * Fetch HTML content from a URL
 */
async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error.message);
    return null;
  }
}

/**
 * Parse GAA score format (e.g., "2-14 (20)") to just goals-points
 */
function parseScore(scoreText) {
  if (!scoreText) return null;
  // Extract the goals-points format (e.g., "2-14" from "2-14 (20)")
  const match = scoreText.match(/(\d+-\d+)/);
  return match ? match[1] : scoreText.trim();
}

/**
 * Parse date from datetime attribute
 */
function parseDate(datetime) {
  if (!datetime) return null;
  // Format: "2025-09-07 20:15:00"
  const datePart = datetime.split(' ')[0];
  return datePart;
}

/**
 * Parse time from datetime attribute
 */
function parseTime(datetime) {
  if (!datetime) return 'TBD';
  // Format: "2025-09-07 20:15:00"
  const timePart = datetime.split(' ')[1];
  if (!timePart) return 'TBD';
  // Convert to 12-hour format
  const [hours, minutes] = timePart.split(':');
  const hour = parseInt(hours);
  if (hour === 0) return '12:00am';
  if (hour === 12) return `12:${minutes}pm`;
  if (hour > 12) return `${hour - 12}:${minutes}pm`;
  return `${hour}:${minutes}am`;
}

/**
 * Determine team category from competition name
 */
function getTeamCategory(competition) {
  const comp = competition.toLowerCase();
  if (comp.includes('junior') || comp.includes('jfc')) {
    return 'Junior Football';
  }
  return 'Senior Football';
}

/**
 * Parse results from the team page
 */
function parseResults($) {
  const results = [];

  // Find results section - look for rows in the sp-event-blocks table
  $('#sp-fixtures-results .sp-event-blocks tbody tr.sp-row').each((index, row) => {
    const $row = $(row);

    // Get teams from the title attributes of team-logo spans
    const teams = [];
    $row.find('.team-logo').each((i, logo) => {
      const title = $(logo).attr('title');
      if (title) teams.push(title);
    });

    if (teams.length < 2) return;

    const homeTeam = teams[0];
    const awayTeam = teams[1];

    // Get date from datetime attribute
    const datetime = $row.find('.sp-event-date').attr('datetime');
    const date = parseDate(datetime);
    if (!date) return;

    // Get scores - they're in sp-result spans
    const scoreSpans = $row.find('.sp-event-results .sp-result');
    if (scoreSpans.length < 2) return; // No scores means it's a fixture, not a result

    const homeScore = parseScore($(scoreSpans[0]).text());
    const awayScore = parseScore($(scoreSpans[1]).text());

    if (!homeScore || !awayScore) return;

    // Get competition
    const competitionRaw = $row.find('.sp-event-league a').text().trim() || 'NY GAA';
    const competition = COMPETITION_MAP[competitionRaw] || competitionRaw;

    // Get round/stage info
    const matchday = $row.find('.sp-event-matchday').text().trim().replace(/[()]/g, '') || '';

    results.push({
      id: `res-${date}-${index}`,
      date,
      homeTeam: homeTeam.replace(' NY', ''),
      awayTeam: awayTeam.replace(' NY', ''),
      homeScore,
      awayScore,
      competition,
      round: matchday,
      venue: 'Gaelic Park, Bronx',
      team: getTeamCategory(competition),
    });
  });

  return results;
}

/**
 * Parse fixtures from the team page
 */
function parseFixtures($) {
  const fixtures = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Look for fixture rows - these won't have scores
  $('#sp-fixtures-results .sp-event-blocks tbody tr.sp-row').each((index, row) => {
    const $row = $(row);

    // Check if this has scores - if so, it's a result, not a fixture
    const scoreSpans = $row.find('.sp-event-results .sp-result');
    const hasScores = scoreSpans.length >= 2 && $(scoreSpans[0]).text().trim();

    // If it has valid scores, skip (it's a result)
    if (hasScores) {
      const score1 = parseScore($(scoreSpans[0]).text());
      const score2 = parseScore($(scoreSpans[1]).text());
      if (score1 && score2) return;
    }

    // Get teams
    const teams = [];
    $row.find('.team-logo').each((i, logo) => {
      const title = $(logo).attr('title');
      if (title) teams.push(title);
    });

    if (teams.length < 2) return;

    const homeTeam = teams[0];
    const awayTeam = teams[1];

    // Get date
    const datetime = $row.find('.sp-event-date').attr('datetime');
    const date = parseDate(datetime);
    if (!date) return;

    // Only include future fixtures
    const fixtureDate = new Date(date);
    if (fixtureDate < today) return;

    // Get time
    const time = parseTime(datetime);

    // Get competition
    const competitionRaw = $row.find('.sp-event-league a').text().trim() || 'NY GAA';
    const competition = COMPETITION_MAP[competitionRaw] || competitionRaw;

    // Get round info
    const matchday = $row.find('.sp-event-matchday').text().trim().replace(/[()]/g, '') || '';

    fixtures.push({
      id: `fix-${date}-${index}`,
      date,
      time,
      homeTeam: homeTeam.replace(' NY', ''),
      awayTeam: awayTeam.replace(' NY', ''),
      venue: 'Gaelic Park, Bronx',
      competition,
      round: matchday,
      team: getTeamCategory(competition),
    });
  });

  return fixtures;
}

/**
 * Save data to JSON file
 */
function saveData(filePath, data) {
  const output = JSON.stringify(data, null, 2);
  writeFileSync(filePath, output, 'utf-8');
  console.log(`Saved ${filePath}`);
}

/**
 * Main scraping function
 */
async function main() {
  console.log('Brooklyn Shamrocks Fixture Scraper');
  console.log('==================================');
  console.log(`Source: ${CONFIG.teamUrl}`);
  console.log('');

  // Fetch the team page
  console.log('Fetching team page...');
  const html = await fetchPage(CONFIG.teamUrl);

  if (!html) {
    console.error('Failed to fetch team page');
    process.exit(1);
  }

  const $ = cheerio.load(html);

  // Parse results
  console.log('Parsing results...');
  const results = parseResults($);
  console.log(`Found ${results.length} Brooklyn Shamrocks results`);

  // Parse fixtures
  console.log('Parsing fixtures...');
  const fixtures = parseFixtures($);
  console.log(`Found ${fixtures.length} upcoming Brooklyn Shamrocks fixtures`);

  // Save results
  const resultsOutput = {
    lastUpdated: new Date().toISOString(),
    source: CONFIG.teamUrl,
    results: results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
  saveData(CONFIG.outputResultsPath, resultsOutput);

  // Save fixtures
  const fixturesOutput = {
    lastUpdated: new Date().toISOString(),
    source: CONFIG.teamUrl,
    fixtures: fixtures.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  };
  saveData(CONFIG.outputFixturesPath, fixturesOutput);

  console.log('\nScraping complete!');

  // Print summary
  if (results.length > 0) {
    console.log('\nRecent Results:');
    results.slice(0, 5).forEach(r => {
      const outcome = r.homeTeam === CONFIG.teamName
        ? (parseInt(r.homeScore) > parseInt(r.awayScore) ? 'W' : 'L')
        : (parseInt(r.awayScore) > parseInt(r.homeScore) ? 'W' : 'L');
      console.log(`  ${r.date}: ${r.homeTeam} ${r.homeScore} - ${r.awayScore} ${r.awayTeam} (${r.round || r.competition})`);
    });
  }

  if (fixtures.length > 0) {
    console.log('\nUpcoming Fixtures:');
    fixtures.slice(0, 5).forEach(f => {
      console.log(`  ${f.date} ${f.time}: ${f.homeTeam} vs ${f.awayTeam} (${f.round || f.competition})`);
    });
  }
}

// Run the scraper
main().catch(console.error);
