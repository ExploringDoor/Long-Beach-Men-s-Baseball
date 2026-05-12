-- =====================================================================
-- ORPHAN GAME CLEANUP — 2026-05-12
-- =====================================================================
-- Goal: permanently eliminate the duplicate game records that have been
-- causing every stats display bug we've chased the last few weeks.
--
-- WHAT THIS SCRIPT DOES (in order):
--   1. Normalizes player names in batting_lines + pitching_lines (NBSP,
--      narrow nbsp, ideographic space, zero-width, trailing $/whitespace).
--   2. For each duplicate game-record pair, MIGRATES batting_lines and
--      pitching_lines from the orphan onto the canonical record so no
--      stats are lost. (Some orphans had the full Brooklyn box score
--      saved on them — we keep that data.)
--   3. DELETES the now-empty orphan game records.
--   4. Adds a UNIQUE INDEX on (game_date, away_team, home_team) for games
--      after 2024-01-01 so this can never happen again.
--   5. Prints verification counts.
--
-- HOW TO RUN:
--   1. Open Supabase → SQL Editor.
--   2. Run BLOCK 0 (preview) first — read what will change.
--   3. If happy, run BLOCKS 1-5 in order. They're idempotent — re-running
--      is safe.
--
-- ROLLBACK: This script runs without an outer BEGIN/COMMIT so each block
-- commits as it goes. If something goes wrong mid-run, copies of the
-- before-state are easy to reconstruct from Supabase's point-in-time
-- recovery. Just stop and tell Claude.
--
-- DUPLICATE PAIRS (orphan → canonical):
--   Saturday Spring 2026 (10 pairs):
--     2348 → 948,  2330 → 2313, 2335 → 2313, 2336 → 2314,
--     2333 → 2323, 2332 → 2326, 2331 → 2325, 2341 → 2339,
--     2342 → 2337, 2347 → 2345, 2346 → 2344
--   Fall/Winter 2025-26 (19 pairs):
--     1824 → 2,    1821 → 5,    1822 → 4,    1820 → 6,
--     1817 → 9,    1816 → 10,   1815 → 11,   1814 → 12,
--     1810 → 15,   1809 → 17,   1808 → 18,   1807 → 19,
--     1804 → 22,   1805 → 21,   1803 → 23,   1801 → 25,
--     1798 → 28,   1799 → 27,   1795 → 31

-- =====================================================================
-- BLOCK 0 — PREVIEW (read-only) — RUN THIS FIRST
-- =====================================================================
-- Confirms what will move. Should print non-zero rows you recognize.

WITH orphan_map(orphan_id, canonical_id) AS (VALUES
  (2348::int, 948::int), (2330, 2313), (2335, 2313), (2336, 2314),
  (2333, 2323), (2332, 2326), (2331, 2325), (2341, 2339),
  (2342, 2337), (2347, 2345), (2346, 2344),
  (1824, 2), (1821, 5), (1822, 4), (1820, 6),
  (1817, 9), (1816, 10), (1815, 11), (1814, 12),
  (1810, 15), (1809, 17), (1808, 18), (1807, 19),
  (1804, 22), (1805, 21), (1803, 23), (1801, 25),
  (1798, 28), (1799, 27), (1795, 31)
)
SELECT
  m.orphan_id, m.canonical_id,
  (SELECT count(*) FROM batting_lines WHERE game_id = m.orphan_id) AS orphan_bat,
  (SELECT count(*) FROM batting_lines WHERE game_id = m.canonical_id) AS canon_bat,
  (SELECT count(*) FROM pitching_lines WHERE game_id = m.orphan_id) AS orphan_pit,
  (SELECT count(*) FROM pitching_lines WHERE game_id = m.canonical_id) AS canon_pit
FROM orphan_map m
ORDER BY m.canonical_id;

-- =====================================================================
-- BLOCK 1 — NORMALIZE PLAYER NAMES
-- =====================================================================
-- NBSP, narrow nbsp, zero-width chars → regular space, then collapse
-- multi-space and trim. Strip trailing $ (a Pirates data-entry quirk).
-- This MUST run before migration so duplicate-detection works on the
-- normalized names.

UPDATE batting_lines
SET player_name = trim(BOTH '$' FROM trim(
  regexp_replace(
    regexp_replace(player_name, '[  -​  　]', ' ', 'g'),
    '\s+', ' ', 'g'
  )
))
WHERE player_name ~ '[  -​  　$]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name);

UPDATE pitching_lines
SET player_name = trim(BOTH '$' FROM trim(
  regexp_replace(
    regexp_replace(player_name, '[  -​  　]', ' ', 'g'),
    '\s+', ' ', 'g'
  )
))
WHERE player_name ~ '[  -​  　$]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name);

-- =====================================================================
-- BLOCK 2 — MIGRATE BATTING_LINES from orphan to canonical
-- =====================================================================
-- For each orphan batting_line: if canonical already has a row for the
-- same (player_name, team), the orphan's line is a duplicate → DELETE.
-- Otherwise, re-point its game_id to the canonical.

CREATE TEMP TABLE _orphan_map (orphan_id int PRIMARY KEY, canonical_id int);
INSERT INTO _orphan_map VALUES
  (2348, 948), (2330, 2313), (2335, 2313), (2336, 2314),
  (2333, 2323), (2332, 2326), (2331, 2325), (2341, 2339),
  (2342, 2337), (2347, 2345), (2346, 2344),
  (1824, 2), (1821, 5), (1822, 4), (1820, 6),
  (1817, 9), (1816, 10), (1815, 11), (1814, 12),
  (1810, 15), (1809, 17), (1808, 18), (1807, 19),
  (1804, 22), (1805, 21), (1803, 23), (1801, 25),
  (1798, 28), (1799, 27), (1795, 31);

-- 2a. Delete orphan batting lines that already have a sibling on canonical.
DELETE FROM batting_lines b
USING _orphan_map m
WHERE b.game_id = m.orphan_id
  AND EXISTS (
    SELECT 1 FROM batting_lines c
    WHERE c.game_id = m.canonical_id
      AND c.player_name = b.player_name
      AND c.team = b.team
  );

-- 2b. Re-point remaining orphan batting lines to their canonical game.
UPDATE batting_lines b
SET game_id = m.canonical_id
FROM _orphan_map m
WHERE b.game_id = m.orphan_id;

-- =====================================================================
-- BLOCK 3 — MIGRATE PITCHING_LINES (same pattern)
-- =====================================================================
DELETE FROM pitching_lines p
USING _orphan_map m
WHERE p.game_id = m.orphan_id
  AND EXISTS (
    SELECT 1 FROM pitching_lines c
    WHERE c.game_id = m.canonical_id
      AND c.player_name = p.player_name
      AND c.team = p.team
  );

UPDATE pitching_lines p
SET game_id = m.canonical_id
FROM _orphan_map m
WHERE p.game_id = m.orphan_id;

-- =====================================================================
-- BLOCK 4 — DELETE THE ORPHAN GAME RECORDS
-- =====================================================================
DELETE FROM games WHERE id IN (SELECT orphan_id FROM _orphan_map);

-- =====================================================================
-- BLOCK 5 — VERIFY (read-only)
-- =====================================================================
-- All three should be 0.

SELECT 'orphan games remaining' AS check, count(*) AS n
FROM games WHERE id IN (
  2348, 2330, 2335, 2336, 2333, 2332, 2331, 2341, 2342, 2347, 2346,
  1824, 1821, 1822, 1820, 1817, 1816, 1815, 1814, 1810, 1809, 1808,
  1807, 1804, 1805, 1803, 1801, 1798, 1799, 1795
);

SELECT 'batting on orphan ids' AS check, count(*) AS n
FROM batting_lines WHERE game_id IN (
  2348, 2330, 2335, 2336, 2333, 2332, 2331, 2341, 2342, 2347, 2346,
  1824, 1821, 1822, 1820, 1817, 1816, 1815, 1814, 1810, 1809, 1808,
  1807, 1804, 1805, 1803, 1801, 1798, 1799, 1795
);

SELECT 'pitching on orphan ids' AS check, count(*) AS n
FROM pitching_lines WHERE game_id IN (
  2348, 2330, 2335, 2336, 2333, 2332, 2331, 2341, 2342, 2347, 2346,
  1824, 1821, 1822, 1820, 1817, 1816, 1815, 1814, 1810, 1809, 1808,
  1807, 1804, 1805, 1803, 1801, 1798, 1799, 1795
);

-- Any remaining duplicate (date, away, home) groups? Should be empty
-- except possibly the 2023 Halo BC / Dodgers anomaly (one is a forfeit).
SELECT game_date, away_team, home_team, count(*) AS dup, array_agg(id) AS ids
FROM games
WHERE game_date IS NOT NULL
GROUP BY 1, 2, 3
HAVING count(*) > 1
ORDER BY game_date DESC;

-- =====================================================================
-- BLOCK 6 — PREVENT FUTURE ORPHANS (unique index)
-- =====================================================================
-- Partial index covers games on/after 2024-01-01 only, leaving the 2023
-- forfeit anomaly alone. Any future insert attempt for the same
-- (date, away, home) will fail loudly instead of silently creating a
-- duplicate.

CREATE UNIQUE INDEX IF NOT EXISTS games_unique_matchup_2024plus
  ON games(game_date, away_team, home_team)
  WHERE game_date >= '2024-01-01';

-- =====================================================================
-- BLOCK 7 — FINAL SPOT CHECK
-- =====================================================================
-- The 4/18 Brooklyn vs Tribe game should now have BOTH teams' batting
-- lines (12 Tribe + 12 Brooklyn = 24) on a single record (id=2326).
SELECT team, count(*) AS batters
FROM batting_lines
WHERE game_id = 2326
GROUP BY team
ORDER BY team;

-- Dennis Donnels on Black Sox: one row per pitched game (4 total —
-- 4/18, 4/25, 5/2, 5/9). Previously was 7 (because NBSP + orphan dups).
SELECT player_name, team, count(*) AS games_pitched, sum(ip) AS total_ip
FROM pitching_lines
WHERE team = 'Black Sox' AND player_name = 'Dennis Donnels'
GROUP BY 1, 2;
