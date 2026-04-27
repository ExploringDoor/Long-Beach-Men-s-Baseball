-- One-time data cleanup based on /audit-stats findings (2026-04-26)
-- Run this in Supabase SQL Editor.
--
-- Three things being cleaned up:
--   1. Non-breaking-space (U+00A0) splitting players into "two players"
--      across batting_lines and pitching_lines (70+ rows affected).
--   2. Other unicode whitespace (narrow nbsp, ideographic space, etc.).
--   3. A duplicate game record (id=2329 — empty Brooklyn vs Tribe 4/18
--      9 AM at Clark, scores 1-8; the real one is id=2326).
--
-- Run each block separately. Read the SELECT counts first BEFORE the
-- UPDATE / DELETE so you know what you're about to change.

----------------------------------------------------------------------
-- BLOCK 1: Player name whitespace normalization (PREVIEW first)
----------------------------------------------------------------------
-- Show how many batting_lines rows have weird whitespace in player_name:
SELECT count(*) AS rows_with_weird_space
FROM batting_lines
WHERE player_name ~ '[^\x20-\x7e]';   -- any character outside printable ASCII

-- Show the distinct names that will be normalized + how many times each appears:
SELECT
  player_name AS current_name,
  regexp_replace(regexp_replace(player_name, '[  -​  　]', ' ', 'g'), '\s+', ' ', 'g') AS normalized_to,
  count(*) AS rows
FROM batting_lines
WHERE player_name ~ '[  -​  　]'
GROUP BY 1, 2
ORDER BY rows DESC;

-- After eyeballing the preview, run the UPDATE:
UPDATE batting_lines
SET player_name = trim(regexp_replace(regexp_replace(player_name, '[  -​  　]', ' ', 'g'), '\s+', ' ', 'g'))
WHERE player_name ~ '[  -​  　]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name);

-- Same for pitching_lines:
UPDATE pitching_lines
SET player_name = trim(regexp_replace(regexp_replace(player_name, '[  -​  　]', ' ', 'g'), '\s+', ' ', 'g'))
WHERE player_name ~ '[  -​  　]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name);

-- Verify zero remaining weird-whitespace rows:
SELECT count(*) AS remaining_weird FROM batting_lines WHERE player_name ~ '[  -​  　]';
SELECT count(*) AS remaining_weird FROM pitching_lines WHERE player_name ~ '[  -​  　]';

----------------------------------------------------------------------
-- BLOCK 2: Delete duplicate game 2329
----------------------------------------------------------------------
-- Confirm what 2329 is BEFORE deleting:
SELECT id, game_date, game_time, field, away_team, home_team, away_score, home_score, status, headline, created_at
FROM games WHERE id IN (2326, 2329);

-- Confirm 2329 has NO stats attached (the real game's stats are on 2326):
SELECT 'batting_lines on 2329' AS table_name, count(*) FROM batting_lines WHERE game_id = 2329
UNION ALL
SELECT 'pitching_lines on 2329', count(*) FROM pitching_lines WHERE game_id = 2329;

-- If both counts are 0, safe to delete:
DELETE FROM games WHERE id = 2329;

----------------------------------------------------------------------
-- BLOCK 3 (optional): Spot-check a player who was previously split
----------------------------------------------------------------------
-- Joe Barrett should now show ALL his Brooklyn games as one row, not two:
SELECT player_name, count(*) AS game_count, sum(ab) AS total_ab, sum(h) AS total_h
FROM batting_lines
WHERE team = 'Brooklyn' AND player_name ILIKE '%barrett%'
GROUP BY player_name;
