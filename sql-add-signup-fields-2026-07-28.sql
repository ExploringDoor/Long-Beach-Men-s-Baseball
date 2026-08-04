-- Add Date of Birth + Positions Played to the Player Sign-Up.
-- Run this ONCE in the Supabase SQL Editor.
--
-- The site feature-detects these columns (signupsHaveExtraCols()):
--   • BEFORE you run this: DOB + positions are still captured — they go in the
--     signup email to Daniel AND are folded into the sign-up "notes" field, so
--     nothing is lost and they show in Admin. Signups keep working.
--   • AFTER you run this: DOB + positions save to their own columns and show as
--     dedicated 🎂 / 🧢 fields on each card in Admin → Player Sign-Ups.
--
-- Safe to run once; the IF NOT EXISTS guards make a re-run a no-op.

alter table public.lbdc_signups add column if not exists dob        text;
alter table public.lbdc_signups add column if not exists positions  text;

-- Verify
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'lbdc_signups'
  and column_name in ('dob','positions');
-- Should list: dob, positions
