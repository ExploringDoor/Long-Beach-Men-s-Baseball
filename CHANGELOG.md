# CHANGELOG

Running log of every change shipped to the LBDC site, written so you can port the same fix/feature to the platform later.

Format: each entry has a **What**, **Why**, and **Where** so you know what to copy across.

> Starting fresh from 2026-05-13. Earlier work is documented in `PLATFORM_MIGRATION.md`.

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
