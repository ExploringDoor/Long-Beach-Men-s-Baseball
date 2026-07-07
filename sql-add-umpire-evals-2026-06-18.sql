-- One-time setup for the Umpire Evaluations feature.
-- Run this once in the Supabase SQL Editor. Until it's run, the captain
-- portal shows "Umpire evaluations aren't enabled yet" and the admin
-- Umpire Evals page shows this same setup notice — the app feature-detects
-- the table, so nothing crashes before you run it.
--
-- After running: captains get a "📋 Umpire Evaluation" form in their portal,
-- and Admin → 📋 Umpire Evals shows every submission + per-umpire averages.

create table if not exists public.umpire_evals (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  team                text,   -- the submitting captain's team
  game_date           text,
  field               text,
  game_time           text,
  plate_umpire        text,
  base_umpire         text,
  game_control        int,    -- 1-5
  rule_interpretation int,    -- 1-5
  accuracy            int,    -- 1-5
  attitude            int,    -- 1-5
  notes               text
);

-- The site uses the publishable/anon key, so allow anon to submit + read +
-- delete (same trust model as lbdc_signups / player_payments in this project).
alter table public.umpire_evals enable row level security;

create policy "umpire_evals anon select" on public.umpire_evals
  for select to anon using (true);
create policy "umpire_evals anon insert" on public.umpire_evals
  for insert to anon with check (true);
create policy "umpire_evals anon delete" on public.umpire_evals
  for delete to anon using (true);

grant select, insert, delete on public.umpire_evals to anon;

-- Verify
select 'umpire_evals ready' as status
where exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='umpire_evals');
