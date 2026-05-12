-- One-time cleanup for invisible-whitespace contamination in player_name
-- (NBSP U+00A0, narrow nbsp, ideographic space, zero-width chars, etc.).
-- This is the SAME cleanup as 2026-04-26 — running it again because new
-- corrupted rows entered the DB via the orphan duplicate game records in
-- season_id=36 between then and now.
--
-- After running this, every name in batting_lines + pitching_lines should
-- be using only ASCII space (U+0020), no trailing/leading whitespace, no
-- internal double-spaces.
--
-- The web app already normalizes via cleanName() on every save path
-- (DOMPurify-style) — see src/App.jsx::cleanName. So this should be the
-- LAST time we have to run this manually as long as we don't bulk-import
-- from external sources without re-normalizing.

----------------------------------------------------------------------
-- BLOCK 1 — Preview what's about to change (READ-ONLY)
----------------------------------------------------------------------
-- Distinct corrupted names + how many rows each:
SELECT
  player_name AS bad_name,
  trim(regexp_replace(regexp_replace(player_name, '[  -​  　]', ' ', 'g'), '\s+', ' ', 'g')) AS clean_name,
  count(*) AS rows
FROM batting_lines
WHERE player_name ~ '[  -​  　]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name)
GROUP BY 1, 2
ORDER BY rows DESC;

SELECT
  player_name AS bad_name,
  trim(regexp_replace(regexp_replace(player_name, '[  -​  　]', ' ', 'g'), '\s+', ' ', 'g')) AS clean_name,
  count(*) AS rows
FROM pitching_lines
WHERE player_name ~ '[  -​  　]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name)
GROUP BY 1, 2
ORDER BY rows DESC;

----------------------------------------------------------------------
-- BLOCK 2 — Apply the normalization
----------------------------------------------------------------------
UPDATE batting_lines
SET player_name = trim(regexp_replace(regexp_replace(player_name, '[  -​  　]', ' ', 'g'), '\s+', ' ', 'g'))
WHERE player_name ~ '[  -​  　]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name);

UPDATE pitching_lines
SET player_name = trim(regexp_replace(regexp_replace(player_name, '[  -​  　]', ' ', 'g'), '\s+', ' ', 'g'))
WHERE player_name ~ '[  -​  　]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name);

----------------------------------------------------------------------
-- BLOCK 3 — Verify no remaining bad rows
----------------------------------------------------------------------
SELECT count(*) AS remaining_bad_batting FROM batting_lines
WHERE player_name ~ '[  -​  　]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name);

SELECT count(*) AS remaining_bad_pitching FROM pitching_lines
WHERE player_name ~ '[  -​  　]'
   OR player_name ~ '\s\s'
   OR player_name <> trim(player_name);
-- Both should print 0.

----------------------------------------------------------------------
-- BLOCK 4 — Spot-check: Dennis Donnels / Lee Frankel on Black Sox
--          should now show ONE row each per game, not two.
----------------------------------------------------------------------
SELECT player_name, team, count(*) AS games_pitched, sum(ip) AS total_ip
FROM pitching_lines
WHERE team = 'Black Sox' AND player_name IN ('Dennis Donnels','Lee Frankel')
GROUP BY 1, 2
ORDER BY 1;
