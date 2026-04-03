#!/usr/bin/env node
/**
 * Scrapes all LBDC season history from leaguelineup.com
 * Outputs src/historyData.js with a HISTORY_DATA constant
 */
import { writeFileSync } from 'fs';

const BASE = 'https://www.leaguelineup.com';

const SEASONS = [
  {name:"2026 BOOMERS 60/70 Division", divisionId:"1064571"},
  {name:"2026 Diamond Classics Memorial", divisionId:"1065143"},
  {name:"2026 Las Vegas 60's World Series", divisionId:"1065193"},
  {name:"Spring/Summer 2026 Diamond Classics Saturdays", divisionId:"1064043"},
  {name:"2025 NABA AZ World Series 50's", divisionId:"1053560"},
  {name:"2025 NABA Father/Son", divisionId:"1059946"},
  {name:"2025 NABA Las Vegas World Series 60's", divisionId:"1053561"},
  {name:"2026 Fall/Winter Season (Season #10)", divisionId:"1061488"},
  {name:"2025 4th of July-NABA", divisionId:"1055104"},
  {name:"2025 Memorial Weekend Tournament-Las Vegas", divisionId:"1056761"},
  {name:"2025 NABA Great Park Tournament", divisionId:"1055186"},
  {name:"2025 NABA MLK Tournament", divisionId:"1053559"},
  {name:"2025 Spring/Summer Season", divisionId:"1055551"},
  {name:"2026 NABA MLK 55+ Division", divisionId:"1062824"},
  {name:"2024 4th of July-NABA", divisionId:"1045846"},
  {name:"2024 Father/Son NABA", divisionId:"1049256"},
  {name:"2024 MG Turkey Bowl Tournament", divisionId:"1053282"},
  {name:"2024 MLK-NABA", divisionId:"1041797"},
  {name:"2024 NABA LAS VEGAS World Series - 60+", divisionId:"1042135"},
  {name:"2024 NABA World Series - 50+", divisionId:"1042133"},
  {name:"2024 NABA World Series - 65+", divisionId:"1042134"},
  {name:"2024 Spring/Summer Season", divisionId:"1044289"},
  {name:"2024/2025 Fall Winter Season", divisionId:"1049932"},
  {name:"2023 Fall/Winter Season", divisionId:"1040472"},
  {name:"2023 Thanksgiving Turkey Bowl", divisionId:"1040473"},
  {name:"NABA World Series-LAS VEGAS 2023", divisionId:"1041039"},
  {name:"2023 Spring/Summer Season", divisionId:"1032266"},
  {name:"2022 Fall/Winter Season", divisionId:"1022573"},
  {name:"2022 Summer Season", divisionId:"1015858"},
  {name:"2024 Practice Games", divisionId:"1044295"},
  {name:"2021 All Star Game", divisionId:"1009514"},
  {name:"2021 Fall/Winter Season", divisionId:"1009695"},
  {name:"Summer 2019", divisionId:"850923"},
  {name:"2021 50+", divisionId:"997284"},
  {name:"2024 60's Mid-Week Division", divisionId:"1044619"},
];

const clean = s => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim();

function parseGames(html) {
  const games = [];
  // Split into table rows
  const rows = html.split(/<tr[\s\S]*?>/i);
  for (const row of rows) {
    // Extract TDs
    const tdMatches = [...row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 3) continue;

    const dateStr = clean(tdMatches[0][1]);
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) continue;

    const statusRaw = tdMatches[1][1];
    const isPlayoff = /\*/.test(statusRaw);
    const statusClean = clean(statusRaw).replace(/\s+/g,' ').trim();
    const isFinal = statusClean.startsWith('F');
    const status = isFinal ? (isPlayoff ? 'Playoff' : 'Final') : statusClean;

    // Game result TD - contains two teams with blue scores
    const resultTd = tdMatches[2][1];

    // Extract team names and scores
    // Pattern: TeamName&nbsp;<font COLOR="BLUE">Score&nbsp;</font>\n TeamName&nbsp;<font COLOR="BLUE">Score</font>
    const scoreMatches = [...resultTd.matchAll(/<font[^>]+COLOR[^>]+BLUE[^>]*>(\d+)/gi)];
    if (scoreMatches.length < 2) continue;

    const awayScore = parseInt(scoreMatches[0][1]);
    const homeScore = parseInt(scoreMatches[1][1]);

    // Get team names by stripping HTML before each score
    // Split result on the two score occurrences
    const parts = resultTd.split(/<font[^>]+COLOR[^>]+BLUE[^>]*>\d+/i);
    const awayTeam = clean(parts[0]).replace(/\s*$/, '').replace(/&nbsp;$/i,'').trim();
    // parts[1] is between score1 and score2 - contains &nbsp;</font> and then home team
    const homeTeam = parts[1]
      ? clean(parts[1]).replace(/^[\s&nbsp;\/]+/i,'').replace(/&nbsp;$/i,'').trim()
      : '';

    if (!awayTeam || !homeTeam) continue;

    const headline = tdMatches[3] ? clean(tdMatches[3][1]) : '';

    games.push({ date: dateStr, status, away_team: awayTeam, away_score: awayScore, home_team: homeTeam, home_score: homeScore, headline });
  }
  return games;
}

function parseStandings(html) {
  const standings = [];
  const rows = html.split(/<tr[\s\S]*?>/i);
  for (const row of rows) {
    const tdMatches = [...row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 3) continue;
    const team = clean(tdMatches[0][1]);
    if (!team || team === 'Team' || /^\s*$/.test(team)) continue;
    // Skip header-like rows
    if (team === 'Won' || team === 'Lost') continue;
    standings.push({
      team,
      w: parseInt(clean(tdMatches[1][1])) || 0,
      l: parseInt(clean(tdMatches[2][1])) || 0,
      t: parseInt(clean(tdMatches[3]?.[1] || '0')) || 0,
      pts: parseInt(clean(tdMatches[4]?.[1] || '0')) || 0,
      gb: clean(tdMatches[5]?.[1] || '--') || '--'
    });
  }
  return standings;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0' }
  });
  return res.text();
}

async function main() {
  const allData = [];
  for (let i = 0; i < SEASONS.length; i++) {
    const season = SEASONS[i];
    process.stdout.write(`[${i+1}/${SEASONS.length}] ${season.name}... `);
    try {
      const [gHtml, sHtml] = await Promise.all([
        fetchText(`${BASE}/games.asp?url=lbdc&divisionid=${season.divisionId}&teamid=99999`),
        fetchText(`${BASE}/standings.asp?url=lbdc&divisionid=${season.divisionId}`)
      ]);
      const games = parseGames(gHtml);
      const standings = parseStandings(sHtml);
      allData.push({ name: season.name, divisionId: season.divisionId, games, standings });
      console.log(`✓ ${games.length} games, ${standings.length} teams`);
    } catch(e) {
      console.log(`✗ ERROR: ${e.message}`);
      allData.push({ name: season.name, divisionId: season.divisionId, games: [], standings: [], error: e.message });
    }
    await new Promise(r => setTimeout(r, 250));
  }

  const totalGames = allData.reduce((s,d) => s + d.games.length, 0);
  console.log(`\nTotal: ${allData.length} seasons, ${totalGames} games`);

  const output = `// Auto-generated by scripts/scrape_history.mjs — ${new Date().toISOString()}
// ${allData.length} seasons, ${totalGames} total games

export const HISTORY_DATA = ${JSON.stringify(allData, null, 2)};
`;

  writeFileSync(new URL('../src/historyData.js', import.meta.url), output);
  console.log('Written to src/historyData.js');
}

main().catch(console.error);
