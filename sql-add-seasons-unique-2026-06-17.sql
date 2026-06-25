-- Guarantee tournament-season resolution can never create duplicate seasons.
--
-- The app's resolveTournamentSeason() does a deterministic read-then-create,
-- which is race-tolerant in practice (every caller converges on the lowest id).
-- This unique index makes duplicates impossible at the database level, so even
-- two truly-simultaneous box-score saves for the same brand-new tournament can
-- only ever produce ONE seasons row.
--
-- Safe to run once. If any duplicate season names already exist, the CREATE
-- will fail — run BLOCK 0 first to find/merge them.

----------------------------------------------------------------------
-- BLOCK 0 — find duplicate season names (should be empty)
----------------------------------------------------------------------
SELECT name, count(*) AS n, array_agg(id ORDER BY id) AS ids
FROM seasons
GROUP BY name
HAVING count(*) > 1
ORDER BY n DESC;

----------------------------------------------------------------------
-- BLOCK 1 — add the unique index (run only if BLOCK 0 is empty)
----------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS seasons_name_unique ON seasons (name);

-- Verify
SELECT indexname FROM pg_indexes WHERE tablename = 'seasons' AND indexname = 'seasons_name_unique';
-- Should print: seasons_name_unique
