---
description: Data-shape audit of src/App.jsx — finds semantic bugs that pass code review but fail against real data
---

Run a "data-shape audit" on `src/App.jsx`. The goal is to surface SEMANTIC bugs — code that's syntactically clean but wrong against the actual league data shape (rematches between same teams, hardcoded constants drifting from admin-edited DB tables, internal metadata leaking into public render, etc.).

This audit has caught real bugs every time it's run. Past hits:
- `LiveBoxScoreFinalCard` sibling-game fallback pulled stats from past matchups of same teams (no `game_date` scope on the query)
- `TeamDetailPage` had the same bug copy-pasted
- `HomePage` rendered upcoming games from hardcoded `SCHED` instead of `lbdc_schedules`, hiding admin venue edits
- `Ticker` picked the current week from hardcoded SCHED, ignoring admin-added/moved weeks
- `[submitted: X]` submission-tracking metadata leaked into the public Recent Results card because `{game.headline}` was rendered raw at multiple sites
- `HomePage` Boomers recent-scores query had no `game_date` floor, surfacing stale games

## What to check

Produce a punch list under 500 words organized into FIVE numbered sections. Use file line numbers. Don't fix anything — just report.

### 1. Loose-match queries
Every `sbFetch` call in the file. Flag any query that filters by `(away_team, home_team)` but lacks a `game_date` or `season_id` scope — those will accidentally match past matchups since the league plays rematches. Also flag any "select latest X" query missing a date floor.

### 2. Sibling/fallback fetches
Any place where one query returning empty triggers a SECOND broader query. List the broadening (which filter was relaxed) and confirm whether it's safe given rematches.

### 3. Hardcoded vs DB drift
Constants in this file that have a corresponding admin-edited Supabase table:

| Hardcoded | Supabase table |
|---|---|
| `SCHED`, `BOOMERS_SCHED` | `lbdc_schedules` (id=sat, id=bom) |
| `FIELDS_INFO` | `lbdc_fields` |
| `CONTACT_INFO` | `lbdc_contact` |
| `RULES_DATA` | `lbdc_rules` |
| `SPONSORS_DATA` | `lbdc_sponsors` |
| `ALERT_*` | `lbdc_alert` |

For each constant, list every page/component that READS it. Flag any READ site that doesn't first try to load the live DB version — those are "I edited it in admin but the public page still shows the old value" bugs.

### 4. Raw render of writable text fields
Any `{game.headline}` / `{n.body}` / similar field that admins or the stat-submission flow can write to, rendered raw without sanitization. The canonical sanitizer is `cleanHeadline()` near the top of the file. Flag any display site that doesn't use it for `headline`. Also flag other writable text fields that could contain internal metadata leaking.

### 5. Cross-page consistency for "upcoming games" and "recent scores"
List EVERY page/component that displays upcoming games or recent scores. For each, note its source (live DB / hardcoded / hybrid). Flag any divergence — e.g. one page shows live data, another shows hardcoded.

## Useful context

- Supabase tables start with `lbdc_` plus plain `games`, `batting_lines`, `pitching_lines`, `tournament_games`, `availability`, `news`, `seasons`
- Wrappers: `sbFetch`, `sbUpsert`, `sbPatch`, `sbDelete`
- Helpers: `dedupGames` for game dedup, `cleanHeadline` for sanitizing headline text, `toISODate` for date parsing
- The league plays REMATCHES between the same two teams within a single season — so any `(away_team, home_team)` filter without `game_date` or `season_id` is suspicious
- The file is ~12,000+ lines — use `grep` to locate patterns rather than reading sequentially

## When to run this

- After adding a new admin editor for something that was previously hardcoded
- After a new season/division goes live (more rematches = more chances for the loose-query bug to fire)
- When a user reports "the page looks wrong but the score is correct" — that's the diagnostic signature of a data-shape bug
- Once a month as a baseline check

After the agent reports findings, the user picks which to fix. Do NOT auto-fix.
