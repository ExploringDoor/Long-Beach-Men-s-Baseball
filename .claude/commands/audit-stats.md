---
description: Statistical integrity audit — cross-check games / batting_lines / pitching_lines against each other
---

Run a statistical integrity audit. The Supabase project is `https://vhovzpajuyphjatjlodo.supabase.co`. Use the publishable key `sb_publishable_btmQX9enbqeWvKPHLRVVgA_kdObTZxC` for read-only queries via curl or Bash.

The point: catch DATA ENTRY MISTAKES that no code review can find. Past hits include Brooklyn entering 14 batters whose runs summed to 7 when their final score was 8 (one missed `R` checkbox).

## What to check

Produce a punch list under 600 words organized into these sections, with the offending `game_id` cited for each finding:

### 1. Score vs batter-runs mismatch
For each `games` row with `status='Final'` and both scores set, fetch its `batting_lines`. Sum each team's `r` column. Flag any game where the sum differs from the team's `away_score` / `home_score`. (Exclude games with zero batting lines for that team — those are "stats not entered yet," covered in section 5.)

### 2. Hits column inconsistency
For each batting line where `h > 0`, verify `h >= (doubles||0) + (triples||0) + (hr||0)`. A double IS a hit, so doubles should never exceed hits. Flag violations.

### 3. Pitcher IP vs game length
Sum each team's pitcher `ip` for each Final game. Flag games where one team's total IP is wildly off from a normal 7- or 9-inning game (under 4 IP or over 11 IP is suspicious). Could indicate missing pitcher entries or duplicate ones.

### 4. Player name near-duplicates splitting career stats
Pull all distinct `(team, player_name)` pairs from `batting_lines`. Within each team, use fuzzy matching to find names that are likely the same player split by typo:
- Same last name, different first (`John Sosa` vs `Jon Sosa`)
- Whitespace differences (`John Sosa` vs `John  Sosa`)
- Case differences (`john sosa` vs `John Sosa`)
- Punctuation (`O'Neil` vs `ONeil`)

For each suspected pair, list the distinct game counts to confirm they aren't both legit (a real homonym would have overlapping games). Flag the top 10 most likely splits.

### 5. Half-submitted games
Find `games` rows where status='Final' but only ONE team has `batting_lines` rows. These are the "[submitted: X]" half-submitted games. List them with the missing team highlighted.

### 6. Orphaned stat lines
Find `batting_lines` rows whose `game_id` doesn't match any row in `games` (deleted-game orphans). Same for `pitching_lines`.

### 7. Roster mismatches
For each Saturday team (Tribe / Pirates / Titans / Brooklyn / Generals / Black Sox), pull the roster from `TEAM_ROSTERS` in `src/App.jsx`. Then pull all distinct `player_name` for that team from `batting_lines`. Flag any batting-line player who is NOT on the roster (or is a roster player with a slightly different spelling — see section 4).

### 8. Standings reconciliation
Compute season W-L-T from `games` (filter by season_id, exclude PPD/CAN). Compare against the standings shown on the live site (visit the home page or /standings). Flag any team where computed record disagrees with displayed record.

## Useful curl pattern

```bash
curl -s "https://vhovzpajuyphjatjlodo.supabase.co/rest/v1/<endpoint>" \
  -H "apikey: sb_publishable_btmQX9enbqeWvKPHLRVVgA_kdObTZxC" \
  -H "Authorization: Bearer sb_publishable_btmQX9enbqeWvKPHLRVVgA_kdObTZxC"
```

Don't fix anything — just produce the punch list. The user picks what to address (most "fixes" here are data entry corrections, not code changes).

## When to run

- Every Sunday or Monday after the weekend's games are entered
- Right before the weekly recap email goes out
- When a player asks "why does my batting average look wrong"
- After any bulk stat import
