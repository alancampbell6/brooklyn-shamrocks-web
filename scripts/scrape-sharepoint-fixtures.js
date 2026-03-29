/**
 * Scrape NYGAA Master Schedule from SharePoint
 *
 * Downloads the Excel file from the NY GAA SharePoint sharing link
 * and extracts Brooklyn Shamrocks fixtures.
 *
 * Approach:
 *   1. Load the SharePoint sharing page with Playwright (headless)
 *   2. Intercept the Graph API content URL with its tempauth token
 *   3. Download the .xlsx directly via that URL
 *   4. Parse with the xlsx library and extract Brooklyn matches
 *
 * Usage:
 *   npx playwright install chromium   # first time only
 *   node scripts/scrape-sharepoint-fixtures.js
 */

import XLSX from 'xlsx';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHAREPOINT_URL =
  'https://gaanewyork-my.sharepoint.com/:x:/p/info/IQCUKgVucYSNTIBVbDYIO-PTAZCE7aLc9D8tbqCXI7i4drQ?e=S2bsch';

const OUTPUT_PATH = join(__dirname, '../src/data/fixtures.json');

// Competition abbreviation mapping
const COMP_MAP = {
  SFC: { competition: 'NY Senior Football Championship', team: 'Senior Football' },
  SFL: { competition: 'NY Senior Football League', team: 'Senior Football' },
  IFC: { competition: 'NY Intermediate Football Championship', team: 'Senior Football' },
  JB: { competition: 'NY Junior B Football Championship', team: 'Junior Football' },
  JA: { competition: 'NY Junior A Football Championship', team: 'Junior Football' },
  JC: { competition: 'NY Junior C Football Championship', team: 'Junior Football' },
  JD: { competition: 'NY Junior D Football Championship', team: 'Junior Football' },
  IFL: { competition: 'NY Intermediate Football League', team: 'Senior Football' },
};

/**
 * Step 1: Get a fresh tempauth download URL by loading the sharing page
 */
async function getTempAuthUrl() {
  console.log('Launching browser to get tempauth token...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let contentUrl = null;

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('GetContentBundle') && !contentUrl) {
      const match = url.match(/bundleUrl=%27(.+?)%27&ui/);
      if (match) {
        const streamUrl = decodeURIComponent(match[1]);
        // Convert preview stream URL to direct content download URL
        contentUrl = streamUrl.replace(
          /streams\/content_preview_O\{0\}\/streamContent/,
          'content'
        );
      }
    }
  });

  await page.goto(SHAREPOINT_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await browser.close();

  if (!contentUrl) {
    throw new Error('Failed to capture tempauth content URL from SharePoint');
  }

  console.log('Got tempauth download URL');
  return contentUrl;
}

/**
 * Step 2: Download the Excel file
 */
async function downloadExcel(url) {
  console.log('Downloading Excel file...');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(`Downloaded ${(buffer.length / 1024).toFixed(1)} KB`);
  return buffer;
}

/**
 * Step 3: Parse the Excel file into a CSV-like row array
 */
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0]; // "Schedule 2026"
  const sheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return csv.split('\n').map((row) => row.split(','));
}

/**
 * Parse a date from the week header like "Mon 11-May" into a full date string.
 * Returns "2026-MM-DD" format.
 */
function parseWeekDate(headerText, year = 2026) {
  // Match patterns like "Mon 11-May", "Tue 12-May", "Sun 05-Jul"
  const match = headerText.match(/\d{2}-[A-Z][a-z]{2}/);
  if (!match) return null;

  const [day, monthStr] = match[0].split('-');
  const months = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const month = months[monthStr];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Extract competition prefix and team names from a match description.
 * e.g. "SFC Sligo vs Brooklyn" -> { comp: "SFC", home: "Sligo", away: "Brooklyn" }
 */
function parseMatchDescription(text) {
  if (!text) return null;
  text = text.trim();

  // Match pattern: PREFIX Team1 v/vs/s Team2
  // Note: "s" handles typos like "Rockland s Brooklyn" in the spreadsheet
  const match = text.match(
    /^(SFC|SFL|IFC|IFL|JB|JA|JC|JD)\s+(.+?)\s+(?:vs?\.?|VS|s)\s+(.+)$/i
  );
  if (!match) return null;

  const prefix = match[1].toUpperCase();
  const home = match[2].trim();
  const away = match[3].trim();

  return { prefix, home, away };
}

/**
 * Normalize team name to standard format
 */
function normalizeTeam(name) {
  const n = name.trim();
  if (/brooklyn|shamrocks/i.test(n)) return 'Brooklyn Shamrocks';
  if (/st\.?\s*barnabas/i.test(n)) return 'St. Barnabas';
  if (/st\.?\s*pat/i.test(n)) return 'St. Patricks';
  if (/st\.?\s*ray/i.test(n)) return 'St. Raymonds';
  if (/shannon/i.test(n)) return 'Shannon Gaels';
  if (/manhattan/i.test(n)) return 'Manhattan Gaels';
  // Capitalize first letter of each word
  return n.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map column index to day-of-week date from the header row.
 * The CSV columns are structured as:
 *   0: Venue
 *   1-2: Mon (time, match)
 *   3-4: Tue (time, match)
 *   5-6: Wed (time, match)
 *   7-8: Thu (time, match)
 *   9-10: Fri (time, match)
 *   11-12: Sat (time, match)
 *   13-14: Sun (time, match)
 */
const DAY_COLS = [
  { timeCol: 1, matchCol: 2, dayIdx: 0 },   // Mon
  { timeCol: 3, matchCol: 4, dayIdx: 1 },   // Tue
  { timeCol: 5, matchCol: 6, dayIdx: 2 },   // Wed
  { timeCol: 7, matchCol: 8, dayIdx: 3 },   // Thu
  { timeCol: 9, matchCol: 10, dayIdx: 4 },  // Fri
  { timeCol: 11, matchCol: 12, dayIdx: 5 }, // Sat
  { timeCol: 13, matchCol: 14, dayIdx: 6 }, // Sun
];

/**
 * Step 4: Extract Brooklyn Shamrocks fixtures from the parsed rows
 */
function extractBrooklynFixtures(rows) {
  const fixtures = [];
  let currentWeekDates = {}; // dayIdx -> "YYYY-MM-DD"

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];

    // Detect week header rows — they contain date strings like "Mon 11-May"
    const isHeaderRow = row.some((cell) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{2}-/.test(cell));
    if (isHeaderRow) {
      currentWeekDates = {};
      for (const { matchCol, dayIdx } of DAY_COLS) {
        // Headers can be in either the time or match column
        for (const col of [matchCol - 1, matchCol]) {
          const cell = row[col] || '';
          const date = parseWeekDate(cell);
          if (date) {
            currentWeekDates[dayIdx] = date;
            break;
          }
        }
      }
      continue;
    }

    // Check venue
    const venue = (row[0] || '').trim();
    if (!venue) continue;

    // Scan each day column for Brooklyn matches
    for (const { timeCol, matchCol, dayIdx } of DAY_COLS) {
      const matchText = row[matchCol] || '';
      if (!/brooklyn|shamrocks/i.test(matchText)) continue;

      const parsed = parseMatchDescription(matchText);
      if (!parsed) continue;

      const date = currentWeekDates[dayIdx];
      if (!date) continue;

      const time = (row[timeCol] || 'TBD').trim().replace(/(\d+)\.(\d+)(PM|AM)/i, '$1:$2 $3');
      const compInfo = COMP_MAP[parsed.prefix] || {
        competition: parsed.prefix,
        team: 'Senior Football',
      };

      const venueMap = {
        'Gaelic Park': 'Gaelic Park, Bronx',
        'Redmond': 'Redmond',
        'Frank Golden': 'Frank Golden',
        'Rockland': 'Rockland',
      };

      fixtures.push({
        date,
        time,
        team1: normalizeTeam(parsed.home),
        team2: normalizeTeam(parsed.away),
        competition: compInfo.competition,
        team: compInfo.team,
        venue: venueMap[venue] || venue,
      });
    }
  }

  // Sort by date then time
  fixtures.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.time.localeCompare(b.time);
  });

  // Assign IDs
  const counts = {};
  return fixtures.map((f) => {
    const key = f.date;
    counts[key] = (counts[key] || 0) + 1;
    const compAbbr = Object.entries(COMP_MAP).find(
      ([, v]) => v.competition === f.competition
    )?.[0]?.toLowerCase() || 'fix';
    return {
      id: `fix-${f.date}-${compAbbr}${counts[key]}`,
      ...f,
      round: '',
    };
  });
}

/**
 * Main
 */
async function main() {
  console.log('NYGAA SharePoint Schedule Scraper');
  console.log('=================================\n');

  // Step 1: Get download URL
  const downloadUrl = await getTempAuthUrl();

  // Step 2: Download Excel
  const buffer = await downloadExcel(downloadUrl);

  // Step 3: Parse
  const rows = parseExcel(buffer);
  console.log(`Parsed ${rows.length} rows from spreadsheet\n`);

  // Step 4: Extract Brooklyn fixtures
  const brooklynFixtures = extractBrooklynFixtures(rows);
  console.log(`Found ${brooklynFixtures.length} Brooklyn Shamrocks fixtures:\n`);

  for (const f of brooklynFixtures) {
    console.log(`  ${f.date} ${f.time.padEnd(8)} ${f.team1} vs ${f.team2} (${f.competition}) @ ${f.venue}`);
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    source: SHAREPOINT_URL,
    fixtures: brooklynFixtures,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${brooklynFixtures.length} fixtures to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
