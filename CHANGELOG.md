# CHANGELOG

Running log of every change shipped to the LBDC site, written so you can port the same fix/feature to the platform later.

Format: each entry has a **What**, **Why**, and **Where** so you know what to copy across.

> Starting fresh from 2026-05-13. Earlier work is documented in `PLATFORM_MIGRATION.md`.

---

## [Unreleased — feature-tournament-eligibility branch]

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
