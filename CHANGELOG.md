# CHANGELOG

Running log of every change shipped to the LBDC site, written so you can port the same fix/feature to the platform later.

Format: each entry has a **What**, **Why**, and **Where** so you know what to copy across.

> Starting fresh from 2026-05-13. Earlier work is documented in `PLATFORM_MIGRATION.md`.

---

## [2026-06-17]

### Added — Tournament schedule on team pages + styled tournament cards on Schedule page

**What:**
- Tournament team detail pages now show a "Tournament Schedule" card below the roster (mirrors the Saturday team's "2026 Schedule" card). Each game row: date, time, HOME/AWAY badge, opponent logo, opponent name, tournament tag, field, and bracket/pool notes.
- Public Schedule page → Tournaments tab now renders each game using the shared UpcomingCard component (logos, big clickable team names, time/date/field, Preview), matching the Saturday Division tab visual weight. Previously plain text rows.

**Why:**
- Saturday teams show schedule + roster together; tournament teams only had a roster
- Tournament games on the Schedule page looked plain vs the polished Saturday cards
- Both requested by user/Daniel

**Robustness fixes (from adversarial review):**
- TLogo now null-guards `name` — tournament_games rows can have NULL away/home teams; without the guard `.slice(0,4)` crashed the whole page.
- Tournament team schedule sorts game_time by minute-of-day client-side (server's text sort put "10:00 AM" before "9:00 AM").
- Loading sentinel (null vs []) prevents the "No games" empty-state flash during initial fetch.

**Where:**
- `src/App.jsx::TLogo` — null guard
- `src/App.jsx::TeamDetailPage` — tournamentGames state + useEffect + schedule card (tournament branch)
- `src/App.jsx::SchedulePage` league===2 branch — UpcomingCard grid

---

## [2026-07-19]

### Fixed — Box score edits could silently re-label a DIFFERENT game and strand its stats

**What:**
- The box score save's edit path PATCHes `away_team`/`home_team` onto `editGameId`. If that id went stale (schedule reload, switching games in the picker, cached saved-games list), the PATCH **re-labeled an unrelated game row** — that row silently became the matchup on screen, and the stats already attached to it were stranded on a game they don't belong to.
- Added an identity guard: before taking the edit path, re-read the target row and confirm its teams still match the matchup in the editor. If they don't, the code refuses to re-label and falls through to the normal find-or-create path (by date + teams + season), so the write lands on the correct row.

**Why (real incident):**
- 7/18 Pirates @ Brooklyn. Daniel entered Brooklyn's full box score; it saved to game #2675. Something later edited #2675 and re-labeled it "Leones @ Indios," and Brooklyn's game was re-created as fresh row #2678 with **no stats**. To Daniel this looked like "I input my Brooklyn stats and they didn't save."
- The 12 batting + 3 pitching lines were never lost — they were sitting on the Leones@Indios record the whole time. Confirmed by the pitching lines: Duane Welty (Pirates, L) and David Young (Brooklyn, W), which only make sense for Pirates@Brooklyn.
- **Data repair:** repointed the 15 orphaned rows from game 2675 → 2678 via PATCH. Verified the box score renders in full.

**Note:** `src/App.jsx:12722` is the only place in the app that writes `away_team`/`home_team` onto an existing game row. The other two PATCH sites (~15263, ~15560) look the row up *by* away+home+season+date, so their teams are self-consistent and can't re-label. That makes this guard a complete fix for the vector.

**Where:**
- `src/App.jsx::BoxScoreEntry::submit` — `editTargetOk` identity guard before the `if(editGameId)` branch

---

## [2026-06-18]

### Fixed — Ticker lingered on the last played weekend

**What:** the top ribbon picked the latest weekend ≤ today (most recent PAST weekend), so between weekends it stayed on the last played one all week (Daniel: "showing June 27 for a couple weeks").
**Now:** shows the current/upcoming weekend, with a 2-day grace window so Sat–Mon still show that weekend's results, then it advances to the next upcoming weekend (which displays as matchups+times until scores are entered).
**Verified:** unit-tested the date logic across 11 scenarios (game day → current; Sun/Mon → grace results; Tue+ → upcoming; season over → last; pre-season → first).
**Where:** `src/App.jsx::Ticker` — weekIdx selection.

### Added — Umpire Evaluations (captain form + admin review)

**What:** captains get a "📋 Umpire Evaluation" form in their portal (Date, Field, Time, Plate Umpire, Base Umpire, four 1–5 ratings — Game Control / Rule Interpretation / Accuracy / Attitude — and Notes). Admin → 📋 Umpire Evals lists every submission newest-first with per-umpire average ratings, filters, and delete.

**Storage:** new `umpire_evals` table. The code feature-detects it (like the pos-column probe), so before the migration is run the captain form and admin view both show a friendly "not enabled / run this SQL" notice instead of crashing.

**Setup required:** run `sql-add-umpire-evals-2026-06-18.sql` once in Supabase.

**Built via workflow** (research → implement → 3-lens adversarial review: submit/validation, table-missing safety, admin view). All lenses passed with no fixes needed. Verified in preview: captain tile + graceful not-enabled state; form fields confirmed against spec. Full submit→admin flow verifiable once the table exists.

### Added — Field Fees ledger (admin)

**What:**
- New Admin → 🏟️ Field Fees page to track per-team field-fee payments per game.
- Summary cards: Total Owed / Collected / Outstanding.
- Editable per-field fee settings (seeded from lbdc_fields: Clark/St Pius/Cantwell $150, Fromhold $125, South Gate $100).
- Games table (auto-pulled from the live schedule + Boomers + tournament games): each game has a paid checkbox + note per team.
- Filters: team / field / status / division. Per-team ledger (games, owed, paid, balance, sorted by balance). CSV export.

**Storage:** reuses lbdc_schedules with a new id="field_fees" row (no schema migration); writes are read-modify-write of that row only — never touches sat/bom/teams.

**Built via workflow** (research → implement → 3-lens adversarial review). Review fixes applied: payKey now includes time+field (so same-day rematches don't collide), ref-based writes (no lost updates on rapid clicks), NaN-safe fee reads, TBD/BYE rows excluded, controlled note remount. Verified end-to-end in preview (toggle → $0→$150 collected + persisted, per-team ledger, CSV) with a then-deleted test row.

### Fixed — Captains couldn't see rematch games to score

**What:**
- The captain "From Schedule" picker hid already-submitted games by matching only (away_team, home_team) — ignoring the date.
- Teams play each other twice a season, so once the first meeting was scored, the SECOND meeting (Jul/Aug rematch) was wrongly hidden. A captain often saw only the 1 game vs a brand-new opponent.
- Now matches on date too, so only the specific submitted game is hidden; all upcoming/unscored games (including rematches) show.

**Verified:** Black Sox captain went from seeing 1 game (Indios Jul 25) to all 6 upcoming games (Jul 11 → Aug 15) in date order. Submitted games still hidden.

**Where:** `src/App.jsx::BoxScoreEntry` — captain savedGames hide filter now compares `s.game_date === toISODate(g.date)`.

**Note:** the live-schedule fix, chronological sort, and Jump-to-Today button all already applied to the captain portal (same BoxScoreEntry component) — this was the one captain-specific gap.

### Added — "Jump to Today's Games" button in Box Score Entry

**What:**
- A button at the top of the From-Schedule picker that scrolls to (and briefly highlights) the first game on/after today's date.
- Now that the picker is sorted Apr → Aug, today's games are far down the list; this jumps straight to them.

**Where:**
- `src/App.jsx::BoxScoreEntry` — todayRowRef + jumpToToday + button in the picker.

### Fixed — Box Score Entry picker sorted chronologically

**What:** picker showed games in raw insertion order (Boomers first, bulk-appended Jun 27–Aug 15 out of sequence). Now sorted by date then time.

### Fixed — Box Score Entry now shows the revised (live) schedule

**What:**
- The "From Schedule" game picker in Box Score Entry was built from the static hardcoded `SCHED`/`BOOMERS_SCHED` constants, NOT the live `lbdc_schedules` table that Admin → Manage Schedule edits.
- So any revised/added games (new dates, Leones/Indios matchups, the Jun 27–Aug 15 revisions) were invisible when trying to enter scores — Daniel: "the revised schedule isn't visible."
- Now fetches the live schedule from lbdc_schedules (sat + bom) and builds the picker from it; static constants are only a fallback for first paint / fetch failure.

**Where:**
- `src/App.jsx::BoxScoreEntry` — added liveSchedule state + fetch; allGames derives from it.

---

## [2026-06-17] — Full tournament box scores (one-sided)

### Added — Score tournament games with full box scores

**What:**
- Tournament games can now be scored through Box Score Entry with full batting + pitching for the Diamond Classics side. The opponent is score-only (per Daniel: "only posting our stats, not the opponents").
- Tournament results live in the `games` table under a per-tournament season (created on demand), so all existing box-score machinery + player-stats aggregation work automatically.
- Scores page: new **Tournaments** tab grouping played tournament games by tournament, each with a full box score (our stats + opponent score-only).
- Team pages: tournament schedule card shows the inline final score (W/L + score) once a game is played.
- Player stats: every Diamond Classics player's tournament batting/pitching rolls into their career profile automatically.

**How it works:**
- `resolveTournamentSeason(name)` — deterministic resolve-or-create of a `seasons` row matching the tournament name (id.asc read so all callers converge on one id even without the DB constraint; re-reads after create for race-tolerance).
- Box Score Entry: tournament games added to the picker; selecting one defaults the Diamond Classics side to "full" and the opponent to "simple" (score-only). handleSave routes tournament games to the tournament season; Saturday/Boomers detection unchanged.
- Scores Tournaments tab + team-page inline scores fetch `games` by tournament season_ids.

**Verified end-to-end** in preview with a real (then-deleted) test game: entry one-sided default, Scores tab, one-sided box modal (no crash on empty opponent), team-page inline W 12–5, and player career stats all correct.

**Adversarial review fixes applied:**
- Season resolver made deterministic + race-tolerant (was check-then-insert; could dup).
- "Skip Lineup → Edit Stats" shortcut made tournament-aware (was forcing both sides full).
- selectSavedGame skips its fallback fetches once the authoritative tournament-season map is built (perf on Saturday edits).

**Where:**
- `src/App.jsx` — resolveTournamentSeason, BoxScoreEntry (picker + selectGame + handleSave + edit paths), ScoresPage (Tournaments tab), TeamDetailPage (inline tournament scores).
- `sql-add-seasons-unique-2026-06-17.sql` — optional unique index on seasons.name (belt-and-suspenders for the resolver).

---

## [2026-06-16]

### Added — Multi-game add panel (Schedule Editor + Tournament Manager)

**What:**
- Admin → Manage Schedule: new "📋 Add Many for One Date" button next to "+ Add Game"
  - Panel with single date input + 4 default rows (matches typical Saturday)
  - Per-row time + field + away + home + Notes (tournament only)
  - "+ Add Row" inherits last row's time/field
  - "Save All" creates every row as a game in one persist call
- Admin → Manage Tournaments: per-tournament "📋 Add Many" button on each card
  - Same UX, plus date + default field + per-row notes
  - Auto-registers any new team names to the tournament's teams list
- Built-in placeholders use this tournament's teams first in the dropdown

**Why:**
- Daniel requested ability to add multiple games for a date in one shot
- Previously each game required a full form click-through; tournaments hit hardest (6-12 games per bracket)
- Now one panel handles a whole Saturday or tournament round

**Where:**
- `src/App.jsx::ManageSchedulePage` — added bulk state + bulkSave + UI panel
- `src/App.jsx::TournamentManagerPage` — added bulkAddGames + per-card UI panel
- Each tournament's "+Add Many" pre-fills tournament name + location

---

## [2026-05-23]

### Added — Leones and Indios to Saturday League

**What:**
- Two new teams in the Spring/Summer 2026 Saturday Division
- Leones (seed #7) — accent color #dc2626 (red)
- Indios (seed #8) — accent color #15803d (forest green)
- Empty rosters; admin can fill via Manage Rosters
- TLogo falls back to colored letter boxes ("LEON" / "INDI") until logo PNGs are added to /public

**Why:**
- Two new teams joining the league

**Where:**
- `src/App.jsx::DIV.SAT.teams` — appended both as seeds 7 + 8
- `src/App.jsx::TEAM_COLORS` — added entries
- `src/App.jsx::TEAM_ROSTERS` — empty arrays
- 5 hardcoded `satTeams`/`SAT_TEAMS` lists updated:
  - HomePage (1162), ScoresPage (1765), SchedulePage (1934)
  - PlayerEligibilityPage (5658), AdminDivisionsEditor (8035)

**Future:** Add `/public/leones.png` + `/public/indios.png` and entries in `TEAM_LOGOS` when artwork is ready

### Added — Per-tournament team lists

**What:**
- Each tournament in Admin → 🏆 Manage Tournaments now has its own teams list
- "Teams: [chips] [+ Add Team]" row under each tournament header
- Picker offers existing teams (built-in + Manage Teams extras) OR free-text for new ones
- Add-game form's team dropdown filters to that tournament's teams first
- Saving a game auto-adds typed team names to the tournament's list

**Why:**
- Tournaments have their own roster of competing teams (Firecracker = 4-6 teams, separate from Father/Son etc.)
- Previously: only built-in Saturday teams appeared in the game dropdown; tournament teams added via Manage Teams were invisible
- Now: each tournament's team list is self-contained

**Migration / Backfill:**
- On TournamentManagerPage load, any tournament without a teams array auto-populates from existing games' away/home teams
- One-time, idempotent

**Where:**
- `src/App.jsx::TournamentManagerPage` — added state, backfill effect, team chip UI, scoped dropdown
- `lbdc_tournament_meta.data[]` shape extended: `{name, location, teams?: string[]}`

---

## [2026-05-14]

### Fixed — Live Scorer was storing raw-decimal IP instead of fractional thirds

**What:**
- `LiveScorerPage` `toIP()` previously had a fallback: if input didn't match `^\d+\.[012]?$`, it called `parseFloat()` and stored the raw decimal
- Captain typing "4.7" thinking it meant 4.7 innings stored `4.7` instead of `4.667` (4⅔)
- Display still worked due to `fromIP()` rounding logic, but storage was inconsistent across rows
- Now strict: parses baseball notation, clamps `.3+` to `.2` (max 2 outs)

**Why:**
- Two pitching save paths (BoxScoreEntry uses `parseIP`, LiveScorer used `toIP`) had different rules
- Storage inconsistency made the audit script C5 query unreliable

**Where:**
- `src/App.jsx::LiveScorerPage::toIP` (around line 13384)

### Fixed — Audit script C5 had wrong IP-validity rule

**What:**
- `sql-audit-2026-05-12.sql` C5 check now flags only fractions that AREN'T near {0, 0.333, 0.667}
- Previously thought storage was baseball-notation (.0/.1/.2). Actually it's fractional thirds.
- 4 rows from 2026-05-12 fixes were incorrect — revert SQL provided to user

**Why:**
- App stores IP as `parseIP("X.Y")` = X + Y/3 (fractional thirds)
- `fromIP(val)` decodes back to baseball notation for display
- So 0.667 stored ↔ "0.2" displayed. Storing 0.2 directly causes the app to display "0.1" (lost an out).
- The audit was systematically flagging valid data as wrong

**Where:**
- `sql-audit-2026-05-12.sql` — C5 query updated
- DB: 4 manual UPDATEs to revert game 2323 + 2343 Pirates pitcher IPs

---

## [2026-05-13] — Tournament Eligibility

### Added — Tournament eligibility tracking

**What:**
- New tabs on Admin → 🏅 Player Eligibility, one per tournament from `lbdc_tournament_meta`
- Per-tournament roster table with paid checkbox + notes + remove button
- "+ Add Player" form with autocomplete from all LBDC team rosters
- "Copy Roster from Another Tournament or Team" picker for one-click bulk import (skips duplicates)
- Tab labels auto-shortened (Firecracker, Father/Son, 65's WS, AZ WS, Vegas WS) with full name in title tooltip

**Why:**
- League runs 4-5 tournaments a year (Firecracker, Father/Son, 65's, 55 Wood, Vegas WS)
- Previously no way to track who signed up + who paid per tournament
- Most rosters share 10-15 regulars — manual re-entry per tournament was tedious

**Where:**
- `src/App.jsx::PlayerEligibilityPage` — added tournament tab logic + state
- `src/App.jsx::TournamentEligibilityBlock` — new component for the per-tournament view
- Uses existing `player_payments` table with `season = tournament name`
- No schema changes required

---

<!--
TEMPLATE for new entries — copy this when adding:

## [YYYY-MM-DD] — short description

### Added | Fixed | Changed | Removed — short title

**What:**
- bullet 1
- bullet 2

**Why:**
- bullet

**Where:**
- `path/to/file::function` — quick description
- DB tables touched
- Schema migrations (if any)

-->
