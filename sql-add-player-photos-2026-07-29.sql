-- Add player headshots (mugshots) to the roster.
-- Run this ONCE in the Supabase SQL Editor.
--
-- Adds a `photo` column to lbdc_rosters that stores a small compressed JPEG
-- (as a data URL, shrunk in the browser to ~15-30KB — no storage bucket needed).
--
-- The site feature-detects this column (rostersHavePhoto()):
--   • BEFORE you run this: the photo upload UI stays hidden and every player
--     shows the normal initials badge. Nothing breaks.
--   • AFTER you run this: captains get a "tap to add a photo" control on each
--     player in Captains Portal → Roster, and the headshots appear next to
--     player names on the Stats leaderboards and on each player's profile.
--
-- Safe to run once; IF NOT EXISTS makes a re-run a no-op.

alter table public.lbdc_rosters add column if not exists photo text;

-- Verify
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'lbdc_rosters'
  and column_name = 'photo';
-- Should list: photo
