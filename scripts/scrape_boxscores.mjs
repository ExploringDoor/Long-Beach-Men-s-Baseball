#!/usr/bin/env node
/**
 * Scrapes box scores for the last 2 years from leaguelineup.com
 * and inserts them into Supabase (seasons, games, batting_lines, pitching_lines)
 */

const SB_URL = "https://vhovzpajuyphjatjlodo.supabase.co";
const SB_KEY = "sb_publishable_btmQX9enbqeWvKPHLRVVgA_kdObTZxC";
const LL_BASE = "https://www.leaguelineup.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0";

// Seasons to process (last ~2 years, skip ones already in Supabase)
// Skipping divisionId 1061488 (2026 Fall/Winter - already in Supabase)
// Skipping divisionId 1064043 (Spring/Summer 2026 - no games yet)
const TARGET_SEASONS = [
  // 2025
  { name: "2025 Spring/Summer Season",               divisionId: "1055551" },
  { name: "2025 NABA AZ World Series 50's",          divisionId: "1053560" },
  { name: "2025 NABA Father/Son",                    divisionId: "1059946" },
  { name: "2025 NABA Las Vegas World Series 60's",   divisionId: "1053561" },
  { name: "2025 4th of July-NABA",                   divisionId: "1055104" },
  { name: "2025 Memorial Weekend Tournament-Las Vegas", divisionId: "1056761" },
  { name: "2025 NABA Great Park Tournament",         divisionId: "1055186" },
  { name: "2025 NABA MLK Tournament",                divisionId: "1053559" },
  // 2024
  { name: "2024/2025 Fall Winter Season",            divisionId: "1049932" },
  { name: "2024 Spring/Summer Season",               divisionId: "1044289" },
  { name: "2024 4th of July-NABA",                   divisionId: "1045846" },
  { name: "2024 Father/Son NABA",                    divisionId: "1049256" },
  { name: "2024 MG Turkey Bowl Tournament",          divisionId: "1053282" },
  { name: "2024 MLK-NABA",                           divisionId: "1041797" },
  { name: "2024 NABA LAS VEGAS World Series - 60+",  divisionId: "1042135" },
  { name: "2024 NABA World Series - 65+",            divisionId: "1042134" },
  { name: "2023 Thanksgiving Turkey Bowl",           divisionId: "1040473" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const delay = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return res.text();
}

const clean = s => s
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();

// ── Supabase helpers ──────────────────────────────────────────────────────────

const SB_HEADERS = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function sbPost(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "POST", headers: SB_HEADERS, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Parse games list page → [{date, status, away, home, awayScore, homeScore, headline, gameId}] ──

function parseGamesWithIds(html) {
  const games = [];
  const rows = html.split(/<tr[\s\S]*?>/i);
  for (const row of rows) {
    const tdMatches = [...row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 3) continue;

    const dateStr = clean(tdMatches[0][1]);
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) continue;

    const statusRaw = tdMatches[1][1];
    const isPlayoff = /\*/.test(statusRaw);
    const statusClean = clean(statusRaw).replace(/\s+/g, " ").trim();
    const isFinal = statusClean.startsWith("F");
    if (!isFinal) continue; // skip postponed, scheduled
    const status = isPlayoff ? "Playoff" : "Final";

    const resultTd = tdMatches[2][1];

    // Extract GameID from link
    const gameIdMatch = resultTd.match(/GameID=(\d+)/i);
    const gameId = gameIdMatch ? gameIdMatch[1] : null;

    const scoreMatches = [...resultTd.matchAll(/<font[^>]+COLOR[^>]+BLUE[^>]*>(\d+)/gi)];
    if (scoreMatches.length < 2) continue;
    const awayScore = parseInt(scoreMatches[0][1]);
    const homeScore = parseInt(scoreMatches[1][1]);

    const parts = resultTd.split(/<font[^>]+COLOR[^>]+BLUE[^>]*>\d+/i);
    const awayTeam = clean(parts[0]).trim();
    const homeTeam = parts[1] ? clean(parts[1]).trim() : "";
    if (!awayTeam || !homeTeam) continue;

    const headline = tdMatches[3] ? clean(tdMatches[3][1]).replace(/\s+/g, " ").trim() : "";

    games.push({ date: dateStr, status, away_team: awayTeam, home_team: homeTeam,
      away_score: awayScore, home_score: homeScore, headline, gameId });
  }
  return games;
}

// ── Convert M/D/YYYY → YYYY-MM-DD ────────────────────────────────────────────

function toISO(date) {
  const [m, d, y] = date.split("/");
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

// ── Parse box score page ──────────────────────────────────────────────────────

function parseBoxScore(html, awayTeam, homeTeam) {
  // Split on visitor/home batting/pitching comment markers
  const vBatStart  = html.indexOf("BEGIN VISITOR BATTING");
  const vBatEnd    = html.indexOf("END VISITOR BATTING");
  const hBatStart  = html.indexOf("BEGIN HOME BATTING");
  const hBatEnd    = html.indexOf("END HOME BATTING");
  const vPitStart  = html.indexOf("BEGIN VISITOR PITCHING");
  const vPitEnd    = html.indexOf("END VISITOR PITCHING");
  const hPitStart  = html.indexOf("BEGIN HOME PITCHING");
  const hPitEnd    = html.indexOf("END VISITOR PITCHING", hPitStart + 10); // second occurrence

  // Actually find the second "END VISITOR PITCHING" comment (used for home too)
  const allEnds = [...html.matchAll(/END VISITOR PITCHING/g)].map(m => m.index);

  const sections = {
    awayBat: vBatStart > 0 && vBatEnd > 0 ? html.slice(vBatStart, vBatEnd) : "",
    homeBat: hBatStart > 0 && hBatEnd > 0 ? html.slice(hBatStart, hBatEnd) : "",
    awayPit: vPitStart > 0 && allEnds[0] > 0 ? html.slice(vPitStart, allEnds[0]) : "",
    homePit: hPitStart > 0 && allEnds[1] > 0 ? html.slice(hPitStart, allEnds[1]) : "",
  };

  const parseBatters = (sec, team) => {
    const rows = sec.split(/<tr[\s\S]*?>/i);
    const batters = [];
    for (const row of rows) {
      const tds = [...row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map(m => clean(m[1]));
      if (tds.length < 6) continue;
      const name = tds[0];
      if (!name || name === "Hitters" || /^[\s-]*$/.test(name)) continue;
      const ab  = parseInt(tds[1]) || 0;
      const r   = parseInt(tds[2]) || 0;
      const h   = parseInt(tds[3]) || 0;
      const rbi = parseInt(tds[4]) || 0;
      const bb  = parseInt(tds[5]) || 0;
      const k   = parseInt(tds[6]) || 0;
      // Normalize name: "LAST FIRST" → title case
      const normName = name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      batters.push({ player_name: normName, team, ab, r, h, rbi, bb, k,
        doubles: 0, triples: 0, hr: 0, sb: 0, hbp: 0, sf: 0 });
    }
    return batters;
  };

  const parsePitchers = (sec, team) => {
    const rows = sec.split(/<tr[\s\S]*?>/i);
    const pitchers = [];
    for (const row of rows) {
      const tds = [...row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map(m => clean(m[1]));
      if (tds.length < 3) continue;
      let name = tds[0];
      if (!name || name === "Pitchers" || /^[\s-]*$/.test(name)) continue;
      // Extract decision from name: "JOHN DOE (W)" → decision=W
      let decision = null;
      const decMatch = name.match(/\(([WLS])\)/i);
      if (decMatch) { decision = decMatch[1].toUpperCase(); name = name.replace(/\s*\([WLS]\)/i, "").trim(); }
      const normName = name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      // IP is in format "6.0" or "8.0"
      const ipStr = tds[1];
      const ipNum = parseIP(ipStr);
      const h  = parseInt(tds[2]) || 0;
      const r  = parseInt(tds[3]) || 0;
      const er = parseInt(tds[4]) || 0;
      const bb = parseInt(tds[5]) || 0;
      const k  = parseInt(tds[6]) || 0;
      pitchers.push({ player_name: normName, team, ip: ipNum, h, r, er, bb, k, decision });
    }
    return pitchers;
  };

  const awayBat = parseBatters(sections.awayBat, awayTeam);
  const homeBat = parseBatters(sections.homeBat, homeTeam);
  const awayPit = parsePitchers(sections.awayPit, awayTeam);
  const homePit = parsePitchers(sections.homePit, homeTeam);

  return {
    batting:  [...awayBat, ...homeBat],
    pitching: [...awayPit, ...homePit],
  };
}

function parseIP(s) {
  if (!s) return 0;
  const clean = s.replace(/[^\d.]/g, "");
  const [whole, outs] = clean.split(".");
  return (parseInt(whole) || 0) + ((parseInt(outs) || 0) / 3);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Load existing seasons from Supabase to avoid duplicates
  const existingSeasons = await sbGet("seasons?select=id,name&limit=50");
  console.log(`Existing Supabase seasons: ${existingSeasons.map(s => s.name).join(", ")}`);

  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalNoBox    = 0;

  for (const season of TARGET_SEASONS) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`📅 ${season.name}`);

    // Get or create season in Supabase
    let sbSeason = existingSeasons.find(s => s.name === season.name);
    if (!sbSeason) {
      const res = await sbPost("seasons", [{ name: season.name }]);
      sbSeason = res[0];
      existingSeasons.push(sbSeason);
      console.log(`  ✨ Created season id=${sbSeason.id}`);
    } else {
      console.log(`  ♻️  Season already exists id=${sbSeason.id}`);
    }

    // Load existing game IDs for this season to skip duplicates
    const existingGames = await sbGet(
      `games?select=id,game_date,away_team,home_team&season_id=eq.${sbSeason.id}&limit=200`
    );
    const existingKeys = new Set(existingGames.map(g => `${g.game_date}|${g.away_team}|${g.home_team}`));

    // Scrape games list
    const gamesHtml = await get(`${LL_BASE}/games.asp?url=lbdc&divisionid=${season.divisionId}&teamid=99999`);
    const games = parseGamesWithIds(gamesHtml);
    console.log(`  📋 Found ${games.length} completed games`);

    let seasonInserted = 0;
    for (const game of games) {
      const isoDate = toISO(game.date);
      const key = `${isoDate}|${game.away_team}|${game.home_team}`;

      if (existingKeys.has(key)) {
        totalSkipped++;
        continue;
      }

      // Skip if no GameID (no box score available)
      if (!game.gameId) {
        totalNoBox++;
        continue;
      }

      // Scrape box score
      await delay(200);
      const boxHtml = await get(`${LL_BASE}/gamesum_baseball.asp?url=lbdc&GameID=${game.gameId}`);
      const { batting, pitching } = parseBoxScore(boxHtml, game.away_team, game.home_team);

      // Insert game record
      const [newGame] = await sbPost("games", [{
        season_id:  sbSeason.id,
        game_date:  isoDate,
        game_time:  null,
        field:      null,
        away_team:  game.away_team,
        home_team:  game.home_team,
        away_score: game.away_score,
        home_score: game.home_score,
        status:     game.status,
        headline:   game.headline || null,
      }]);

      // Insert batting lines
      if (batting.length > 0) {
        await sbPost("batting_lines", batting.map(b => ({ ...b, game_id: newGame.id })));
      }

      // Insert pitching lines
      if (pitching.length > 0) {
        await sbPost("pitching_lines", pitching.map(p => ({ ...p, game_id: newGame.id })));
      }

      const hasBox = batting.length > 0 || pitching.length > 0;
      process.stdout.write(hasBox ? "✓" : "·");
      seasonInserted++;
      totalInserted++;

      // Small delay between requests
      await delay(150);
    }

    console.log(`\n  ✅ Inserted ${seasonInserted} games`);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`🏁 Done! Inserted: ${totalInserted} | Skipped (dup): ${totalSkipped} | No box: ${totalNoBox}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
