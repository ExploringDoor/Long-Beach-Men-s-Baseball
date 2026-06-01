-- =====================================================================
-- DATA AUDIT — 2026-05-12
-- =====================================================================
-- Read-only audit script. Runs a battery of integrity checks across
-- games, batting_lines, pitching_lines, and lbdc_rosters. Each check
-- produces a labeled result table.
--
-- HOW TO READ THE RESULTS:
--   - "0 rows" for a check = clean, no issue
--   - Any rows returned = something worth eyes
--
-- The checks are grouped by SEVERITY:
--   🔴 CRITICAL — stats are visibly wrong; users will notice
--   🟡 SUSPICIOUS — probably indicates a data-entry error
--   🟢 INFO — context only, may or may not need action
--
-- Run the whole file at once. Paste the results back to Claude.

-- =====================================================================
-- 🔴 CRITICAL CHECKS
-- =====================================================================

-- C1. Score on game record doesn't match sum of batting_lines.r per team.
--     Captain saved 12 runs on the game card but only 8 R across all batters
--     = the box score doesn't reconcile with the final score.
SELECT 'C1: score-vs-batting mismatch' AS check;
WITH bat_runs AS (
  SELECT b.game_id, b.team, sum(b.r) AS sum_r
  FROM batting_lines b GROUP BY b.game_id, b.team
)
SELECT g.id, g.game_date, g.away_team, g.home_team,
  g.away_score, g.home_score,
  (SELECT sum_r FROM bat_runs WHERE game_id=g.id AND team=g.away_team) AS away_bat_r,
  (SELECT sum_r FROM bat_runs WHERE game_id=g.id AND team=g.home_team) AS home_bat_r
FROM games g
WHERE g.status='Final' AND g.away_score IS NOT NULL
  AND g.game_date >= '2026-01-01'
  AND (
    coalesce((SELECT sum_r FROM bat_runs WHERE game_id=g.id AND team=g.away_team),-1) NOT IN (g.away_score, 0)
    OR coalesce((SELECT sum_r FROM bat_runs WHERE game_id=g.id AND team=g.home_team),-1) NOT IN (g.home_score, 0)
  )
  AND EXISTS (SELECT 1 FROM batting_lines b WHERE b.game_id=g.id)
ORDER BY g.game_date DESC;

-- C2. Game marked Final but missing scores.
SELECT 'C2: Final without scores' AS check;
SELECT id, game_date, away_team, home_team, away_score, home_score, status
FROM games
WHERE status='Final' AND (away_score IS NULL OR home_score IS NULL)
ORDER BY game_date DESC;

-- C3. Negative computed singles (h < doubles+triples+hr means data entry error).
SELECT 'C3: negative singles in batting line' AS check;
SELECT b.game_id, b.player_name, b.team, b.h, b.doubles, b.triples, b.hr,
  (b.h - b.doubles - b.triples - b.hr) AS computed_singles
FROM batting_lines b
WHERE (b.h - b.doubles - b.triples - b.hr) < 0
ORDER BY b.game_id DESC;

-- C4. Pitcher has more than 9 IP in a single game (impossible in regulation).
SELECT 'C4: pitcher with >9 IP single game' AS check;
SELECT game_id, player_name, team, ip
FROM pitching_lines
WHERE ip > 9
ORDER BY ip DESC;

-- C5. Pitching IP fraction stored wrong.
--     The app stores IP as fractional THIRDS (1 out = .333, 2 outs = .667),
--     NOT baseball notation (.1 / .2). So valid storage fractions are
--     {0, 0.333..., 0.667...}. Anything else means parseIP() wasn't applied
--     and the captain's typed value got stored raw (e.g. ".1" stored as 0.1
--     which the app later misreads as zero outs).
SELECT 'C5: pitching IP with invalid storage fraction' AS check;
SELECT game_id, player_name, team, ip,
  round((ip - floor(ip))::numeric, 4) AS fraction
FROM pitching_lines
WHERE ip IS NOT NULL AND ip > 0
  AND abs((ip - floor(ip)) - 0) > 0.05
  AND abs((ip - floor(ip)) - 0.3333333333333333) > 0.05
  AND abs((ip - floor(ip)) - 0.6666666666666666) > 0.05
ORDER BY game_id DESC;

-- C6. Pitcher decisions don't add up: more than one W or one L per game.
SELECT 'C6: multiple W or L decisions on same game' AS check;
SELECT game_id, decision, count(*) AS n,
  array_agg(player_name || ' (' || team || ')') AS pitchers
FROM pitching_lines
WHERE decision IN ('W','L','S')
GROUP BY game_id, decision
HAVING (decision='W' AND count(*)>1)
    OR (decision='L' AND count(*)>1)
ORDER BY game_id DESC;

-- C7. Slot collisions: same team has two players with same slot in same game.
SELECT 'C7: duplicate slot in same lineup' AS check;
SELECT game_id, team, slot, count(*) AS n, array_agg(player_name) AS players
FROM batting_lines
WHERE slot IS NOT NULL AND slot <> ''
GROUP BY game_id, team, slot
HAVING count(*) > 1
ORDER BY game_id DESC;

-- =====================================================================
-- 🟡 SUSPICIOUS CHECKS
-- =====================================================================

-- S1. Player has stats on a team they're not rostered for.
--     Could be legit pool/sub player, or a captain typed wrong team.
SELECT 'S1: stats for player not on roster (current Saturday 2026)' AS check;
WITH cur_games AS (
  SELECT id FROM games WHERE season_id IN (2, 31)
), bat_by AS (
  SELECT DISTINCT b.player_name, b.team
  FROM batting_lines b WHERE b.game_id IN (SELECT id FROM cur_games)
)
SELECT b.team, b.player_name
FROM bat_by b
WHERE NOT EXISTS (
  SELECT 1 FROM lbdc_rosters r
  WHERE r.team = b.team AND lower(trim(r.name)) = lower(trim(replace(b.player_name, '*', '')))
)
  AND b.player_name NOT ILIKE '%Pool%'
ORDER BY b.team, b.player_name;

-- S2. Box score asymmetry: one team has batting_lines, the other doesn't.
SELECT 'S2: asymmetric box score (one team missing batting)' AS check;
SELECT g.id, g.game_date, g.away_team, g.home_team,
  (SELECT count(*) FROM batting_lines b WHERE b.game_id=g.id AND b.team=g.away_team) AS away_n,
  (SELECT count(*) FROM batting_lines b WHERE b.game_id=g.id AND b.team=g.home_team) AS home_n
FROM games g
WHERE g.status='Final' AND g.game_date >= '2026-01-01'
  AND EXISTS (SELECT 1 FROM batting_lines b WHERE b.game_id=g.id)
  AND (
    (SELECT count(*) FROM batting_lines b WHERE b.game_id=g.id AND b.team=g.away_team) = 0
    OR (SELECT count(*) FROM batting_lines b WHERE b.game_id=g.id AND b.team=g.home_team) = 0
  )
ORDER BY g.game_date DESC;

-- S3. Win decision on the LOSING team or Loss on the WINNING team.
--     Captain entered the wrong pitcher.
SELECT 'S3: W/L decision contradicts final score' AS check;
SELECT p.game_id, p.player_name, p.team, p.decision,
  g.away_team, g.away_score, g.home_team, g.home_score
FROM pitching_lines p
JOIN games g ON g.id = p.game_id
WHERE g.status='Final' AND g.game_date >= '2026-01-01'
  AND p.decision IN ('W','L')
  AND (
    (p.decision='W' AND p.team=g.away_team AND g.away_score < g.home_score)
    OR (p.decision='W' AND p.team=g.home_team AND g.home_score < g.away_score)
    OR (p.decision='L' AND p.team=g.away_team AND g.away_score > g.home_score)
    OR (p.decision='L' AND p.team=g.home_team AND g.home_score > g.away_score)
  )
ORDER BY g.game_date DESC;

-- S4. Single-game ABs over 8 (very unusual — top of the order in a long game
--     might get 6 PAs total, so 8+ AB is almost certainly miscounted).
SELECT 'S4: suspiciously high AB in single game (>8)' AS check;
SELECT game_id, player_name, team, ab, h, r
FROM batting_lines
WHERE ab > 8
ORDER BY ab DESC, game_id DESC;

-- S5. Same player name on multiple teams in same season — probably a name
--     collision, or a player legitimately switched teams mid-season.
SELECT 'S5: same player_name on multiple teams in current season' AS check;
WITH cur AS (
  SELECT DISTINCT b.player_name, b.team
  FROM batting_lines b JOIN games g ON g.id=b.game_id
  WHERE g.season_id IN (2, 31)
)
SELECT player_name, count(DISTINCT team) AS team_count,
  array_agg(team ORDER BY team) AS teams
FROM cur
GROUP BY player_name
HAVING count(DISTINCT team) > 1;

-- S6. Whitespace / asterisk still on player names (should be 0 after cleanup).
SELECT 'S6: player_name still has weird whitespace / leading-trailing junk' AS check;
SELECT 'batting' AS source, count(*) AS n FROM batting_lines
WHERE player_name <> trim(player_name) OR player_name ~ '\s\s' OR player_name ~ '[  -​  　]'
UNION ALL
SELECT 'pitching' AS source, count(*) AS n FROM pitching_lines
WHERE player_name <> trim(player_name) OR player_name ~ '\s\s' OR player_name ~ '[  -​  　]';

-- =====================================================================
-- 🟢 INFO CHECKS (context only)
-- =====================================================================

-- I1. Final games with no batting_lines at all (Score Only saves — usually OK).
SELECT 'I1: Final games with NO batting_lines (Score Only)' AS check;
SELECT id, game_date, away_team, home_team, away_score, home_score
FROM games g
WHERE status='Final' AND away_score IS NOT NULL
  AND game_date >= '2026-01-01'
  AND NOT EXISTS (SELECT 1 FROM batting_lines b WHERE b.game_id=g.id)
ORDER BY game_date DESC;

-- I2. Current Saturday games BY date — counts of stats and total scores.
--     Sanity dashboard. Each row = one real game. Helps eyeball that
--     every Saturday is fully represented.
SELECT 'I2: current Saturday games summary' AS check;
SELECT g.game_date, g.away_team, g.home_team, g.away_score, g.home_score,
  (SELECT count(*) FROM batting_lines b WHERE b.game_id=g.id) AS bat_n,
  (SELECT count(*) FROM pitching_lines p WHERE p.game_id=g.id) AS pit_n,
  g.status
FROM games g
WHERE g.season_id IN (2, 31) AND g.game_date IS NOT NULL
ORDER BY g.game_date DESC, g.away_team;

-- I3. Any remaining duplicate (date, away, home) groups? Should be empty
--     except the 2023 forfeit anomaly.
SELECT 'I3: any remaining duplicate game records' AS check;
SELECT game_date, away_team, home_team, count(*) AS n, array_agg(id) AS ids
FROM games WHERE game_date IS NOT NULL
GROUP BY 1,2,3 HAVING count(*) > 1
ORDER BY game_date DESC;
