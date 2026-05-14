# LBDC → Platform Migration Index

Everything that needs to travel with this codebase when moving to the unified league platform. Organized by category. Last comprehensive sweep: 2026-05-13.

Source-of-truth file: `src/App.jsx` (~14,700 lines, single-file React app).

---

## 1. Database (Supabase) — Tables & Conventions

### Read tables
| Table | Used for |
|---|---|
| `seasons` | `id, name` — season identification by name pattern matching (NOT hard ids) |
| `games` | `id, season_id, game_date, game_time, field, away_team, home_team, away_score, home_score, status, headline, ll_game_id, innings, created_at` |
| `batting_lines` | per-batter line stats per game. `pos` column added 2026-05-12 via ALTER TABLE |
| `pitching_lines` | per-pitcher line stats per game. **No `hr` column** (HRs allowed not tracked — selecting it 400s) |
| `lbdc_rosters` | team rosters; `team, name, number, status` (Active / DL / Released) |
| `lbdc_schedules` | `id, data` jsonb. Saturday at id=`sat`, Boomers at id=`bom` |
| `lbdc_signups` | player sign-up form submissions |
| `player_payments` | fees paid tracking. `player_name, team_name, season, paid, notes` |
| `availability` | player game availability RSVPs |

### Write tables (via sbUpsert — singleton config rows)
| Table | id | Holds |
|---|---|---|
| `lbdc_alert` | "main" | League-wide alert banner config |
| `lbdc_contact` | "main" | Commissioner contact info |
| `lbdc_divisions` | "main" | Division config (Saturday + Boomers) |
| `lbdc_fields` | "main" | Field directions / addresses |
| `lbdc_gallery` | individual rows | Photo gallery |
| `lbdc_live_state` | per game | Live-scoring in-progress state |
| `lbdc_page_content` | per page | Rich-text editable page blocks |
| `lbdc_rules` | "main" | Rules content |
| `lbdc_sponsors` | "main" | Sponsor list |
| `lbdc_tournament_meta` | "main" | Tournament metadata (name, location, dates, order) |
| `tournament_games` | per game | Tournament-specific game records |
| `news` | per item | News & events feed |

### Database constraints
- `games_unique_matchup_2024plus` — partial UNIQUE on `(game_date, away_team, home_team)` WHERE `game_date >= '2024-01-01'`. Prevents the orphan-duplicate-game class of bugs we spent a week cleaning up.

### Schema migrations performed (in `sql-*.sql` files at repo root)
- `sql-cleanup-2026-04-26.sql` — initial NBSP cleanup
- `sql-cleanup-2026-05-12.sql` — re-run after corruption returned
- `sql-cleanup-2026-05-12-orphans.sql` — 29 orphan game records merged + deleted + unique constraint
- `sql-add-pos-column-2026-05-12.sql` — added `batting_lines.pos`
- `sql-audit-2026-05-12.sql` — read-only audit (14 checks)

### Data-quality landmines
- **Names contain NBSP** (U+00A0) sporadically — all reads should pass through `cleanName()`
- **Asterisk suffix** `*` = under-21 player marker. NOT part of identity. Strip via `matchKey()` for matching, preserve for display via `preferStarred()`
- **Trailing `$`** quirk in some Pirates names. `cleanName` strips
- **IP storage**: baseball notation `5.0/5.1/5.2`, NOT decimal. `.3/.7` is corruption. `parseIP` decodes baseball-style
- **Two seasons treated as one** for Saturday: `Spring/Summer 2026` (id=2) AND `Spring/Summer 2026 Diamond Classics Saturdays` (id=31). Season detection uses name patterns, never hardcoded ids
- **`status` values**: `Final`, `F`, `PPD`, `CAN`, `Scheduled`, or letter prefixes — code tolerates both `Final` and `F`
- **`headline`** may contain `[submitted: TEAM]` tag — public renders MUST strip via `cleanHeadline()`

---

## 2. Stats Aggregation Logic (most-bug-prone)

### `cleanName(n)`
Strip `\p{Z}` (all Unicode separators incl NBSP, narrow nbsp, ideographic), collapse whitespace, trim.

### `matchKey(n)`
`cleanName + .replace(/\*+\s*$/, "")` lowercased. The dedup/comparison key.

### `preferStarred(a, b)`
Pick the display name with `*` if either had it. So if any captain entered the asterisk, the player shows as under-21 across the site.

### `parseIP(str)` / `fromIP(val)`
Baseball IP encoding round-trip. `5.2` ⇔ `5.666...` (5 innings, 2 outs).

### `dedupGames(games)`
Collapses duplicate game records by `gameKey = date|away|home`. Prefers higher total score, then headline, then highest id.

### Sibling-game canonical pattern (used everywhere)
1. Fetch games by season (or by player-line game_ids)
2. ALSO fetch games on the same dates regardless of season
3. Build `canonicalByKey` preferring current-Saturday season records
4. Map every game_id → canonical_id
5. Re-key all batting/pitching lines onto canonical before aggregating

This pattern lives in:
- `TeamDetailPage` batting + pitching aggregations
- `StatsPage` `loadPlayer` (player profile)
- `PlayerStatsModal` (popup modal)
- `StatsPage` leaderboard fetch

### GP = batting OR pitching appearance
GP counts ANY game the player showed up in, not just games they batted. Tracked via `Set<canonical_gameKey>` per player.

### Score reconciliation gotcha
Box score auto-derives team score from sum-of-batter-R when in "full" mode. UNLESS `editGameId` is set — captains editing an existing game can override directly.

---

## 3. Box Score Entry (BoxScoreEntry component, line 10454)

### Save path
- DELETE-then-INSERT for batting_lines + pitching_lines (atomic-ish; only deletes if new rows exist to insert)
- Zero-stat filter: drop rows where every counting stat = 0 AND no decision/SB
- Slot auto-resolution: walks lineup, typed slots claim their leading number, empty rows fill lowest unused (`8A, 8B, 9, 10` not `8A, 8B, 10, 11`)
- Position `pos` column included only if feature-detect confirms it exists
- Innings jsonb payload: `{away:[r1..r9], home:[...], awayH, awayE, homeH, homeE}`
- Captain submission tag: `[submitted: TEAM]` appended to headline

### Load path (both `selectSavedGame` AND `Skip Lineup → Edit Stats`)
- Filter out fully-empty batting/pitching rows on load (hide legacy junk)
- Reload innings + H/E from `games.innings`
- Reload `pos` per batter
- Restore all stat fields

### A/B shared slot (UI line 10828+)
- ORDER column shows text input
- `updBat` includes `slot` in the string-passthrough list (NOT numerically coerced)
- Smart placeholder counts around A/B pairs
- Banner tip says "type 1A / 1B"

### Captain auth & gating
- captainTeam set → only that team's batting + pitching editable
- Opposing team shows `lockedBox(name)` placeholder
- Captain's "Edit Saved Game" toggle to revisit submitted games
- Captain game list hides already-saved games (so they don't re-enter fresh)

### Live scoring (LiveScorerPage, line 12948)
- In-progress state persisted to `lbdc_live_state`
- Diamond + base-state UI
- Auto-resume if state exists
- Converts to full box score on game end

### Score-Only mode
- Captain skips lineup, enters just final score + optional headline
- "Skip — Enter Score Only" button in lineup phase

---

## 4. Pages / Routes

| Page | Component | Notes |
|---|---|---|
| Home | `HomePage` (1093) | Hero, recent results, upcoming, news ticker, sign-up promo banner |
| Scores | `ScoresPage` (1740) | Week pills + box score modals |
| Schedule | `SchedulePage` (1895) | Saturday + Boomers schedule grids |
| Tournaments | `TournamentsPage` (2141) | Public tournament games view |
| Standings | `StandingsPage` (2252) | Live-computed W/L/T records |
| Teams | `TeamsPage` (3742) | Team listing + rosters + records |
| Team Detail | `TeamDetailPage` (3003) | Per-team page: roster, batting card, pitching card, schedule, recent results |
| Stats | `StatsPage` (12141) | League-wide leaderboard + player profiles |
| Directions | `FieldDirectionsPage` (3990) | Field addresses + map links |
| Rules | `RulesPage` (4520) | Editable rich-text rules |
| Sponsors | `SponsorsPage` (4051) | Sponsor logos |
| Photos | `PhotosPage` (4102) | Gallery |
| History | `HistoryPage` (4650) | Season history archive |
| Player Sign-Up | `PlayerSignUpPage` (5016) | Form → `lbdc_signups` |
| Sub Board | `SubBoardPage` (5295) | Sub players available list |
| Contact | `ContactPage` (5443) | Commissioner info |
| Payments | `PaymentsPage` (5557) | Public payment info |
| Captain Portal | `CaptainAvailabilityView`/`AdminPage` flow | |
| Admin Portal | `AdminPage` (9186) | All admin tools |

### Admin sub-pages (gated by `lbdc2026` password)
- `PlayerEligibilityPage` (5647) — fees + appearances + tournament rosters
- `TournamentManagerPage` (6443) — tournament metadata + games
- `ManageSchedulePage` (6806) — edit Saturday/Boomers schedule
- `WeeklyEmailPage` (7024) — weekly recap email builder
- `AdminContentEditor` (7218) — page rich-text editor
- `AdminRulesEditor` (7269) — rules editor
- `AdminPhotosEditor` (7333) — gallery editor
- `AdminSponsorsEditor` (7500) — sponsor editor
- `AdminFieldsEditor` (7592) — field info editor
- `AdminContactEditor` (7718) — commissioner contact editor
- `AdminDivisionsEditor` (7924) — divisions editor (Phase 2 work, partial)
- `ManageTeamsPage` (8106) — team CRUD
- `AdminRostersEditor` (8227) — roster editor
- `AdminSignupsViewer` (8405) — sign-up review + email export
- `PlayerAvailabilityPage` (8794) — RSVP tracking
- `BoxScoreEntry` (10454) — full entry flow
- `LiveScorerPage` (12948) — live scoring

---

## 5. Hardcoded LBDC-Specific Data (needs parameterization on platform)

| Constant | Line | Content |
|---|---|---|
| `TEAM_LOGOS` | 16 | Team name → /image.png map |
| `BOOMERS_TEAMS` | 28 | Set of 2 Boomers team names |
| `TICKER_NAME` | 89 | Display name shortening for ticker |
| `DIV` | 94 | Division config (Saturday + Boomers) |
| `TEAM_COLORS` | 117 | Per-team accent color |
| `TEAM_ROSTERS` | 123 | Hardcoded roster fallback (when lbdc_rosters DB unreachable) |
| `TEAM_CAL_LINKS` | 237 | Per-team Google Calendar links |
| `TEAM_CAL_ICS` | 250 | Per-team iCal feed URLs |
| `SCORES` | 262 | Bootstrap scores (legacy) |
| `SCHED` | 277 | Bootstrap Saturday schedule |
| `BOOMERS_SCHED` | 420 | Bootstrap Boomers schedule |
| `RULES_DATA` | 432 | Rules content fallback |
| `FAKE_RECAPS` | 558 | Auto-recap text templates |
| `STANDINGS_HISTORY` | 2237 | Historical standings |
| `FIELDS_INFO` | 3905 | Field address/info fallback |
| `SPONSORS_DATA` | 3944 | Sponsor fallback |
| `CONTACT_INFO` | 3955 | Contact info fallback |
| `PAGE_CONTENT_BLOCKS` | 4354 | Editable content block fallback |
| `SEASONS_WITH_BOX_SCORES` | 4620 | Season IDs that have stats data |
| `PAYMENT_CATEGORIES` | 5548 | Fee structure (Saturday $50, Boomers $25+$20/game) |
| `SCHEDULE_FIELDS` | 6800 | Saturday's field rotation list |
| `DEFAULT_DIVISIONS` | 7877 | Boostrap divisions |
| `SB_URL`, `SB_KEY` | 10106-7 | Supabase publishable key |
| `ALL_SEASONS_KEY` | 12133 | Stats page "All Seasons" sentinel |

---

## 6. Static Assets (`/public`)

- `hero111.jpg` — current hero image (preloaded with fetchpriority="high")
- `hero1.png`, `hero11.png`, `heropic.jpeg` — legacy hero images
- `diamond-classics.mp3` — intro audio (AutoplayAnthem component)
- `qr-code.png` — sign-up QR
- Team logos: `tribe.png, pirates.png, titans.png, brooklyn.png, generals.png, blacksox.png, dodgers.png`
- `2026 Diamond Classic schedule template.png`
- Week previews: `week1.png, week2.png, week3.png`
- `20.png, 21.png` — secondary logos
- `pill-scan.html` — standalone QR scanner page

---

## 7. Auth / Permission Model

### Admin auth
- Single hardcoded password: `lbdc2026`
- Stored in `localStorage.lbdc_admin_v1 = "true"` for session persistence
- All admin pages gated on `screen === "admin"` state
- Logout clears localStorage

### Captain auth
- Captain picks team from dropdown on login screen
- No password — soft auth
- Sets `captainTeam` state, restricts box score editing to that team only
- Persisted across reload

### Public (no auth)
- All read-only pages
- Player Sign-Up form (anyone can fill out)
- Sub Board (anyone can post)

---

## 8. Business Rules (League Specific)

### Saturday Eligibility (Phase 1+)
- $50 season fee
- Minimum 4 games played
- BOTH required for playoff eligibility
- Tracked in `player_payments` with `season="Spring/Summer 2026"`

### Boomers Prepay Model
- $25 annual insurance (one-time)
- $20 per-game fee, prepaid
- Tracked in `player_payments` with `season="Boomers 2026"`, `notes` = game credit count

### Tournament Eligibility (new — Tournament Eligibility branch)
- Per-tournament roster + paid checkbox
- One row per player per tournament in `player_payments`
- `season` = tournament name (e.g. `"NABA Firecracker Tournament 55 Plus"`)

### Game records
- W = home/away_score > opponent
- L = inverse
- T = equal scores
- PPD/CAN excluded from W/L counts
- Status `"Final"` or `"F"` both treated as completed

### IP encoding
- `0` outs (no decimal): `5.0` = 5 IP
- `1` out: `5.1` = 5⅓ IP
- `2` outs: `5.2` = 5⅔ IP

### Box score input
- Singles auto-computed as `h - doubles - triples - hr`
- HR change auto-bumps R and RBI in both directions (`updBat` line 10328)
- Position dropdown values: `P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH, EH, PH, PR` (POSITIONS constant)

---

## 9. UI / Theme Components

### Colors
- Primary navy: `#002d6e`
- Gold accent: `#FFD700`
- Red accent: `#c8102e`
- Boomers purple: `#7c3aed` / `#3b1d6e`
- Success green: `#16a34a`
- Tournament orange: `#b45309`
- Backgrounds: `#fff`, `#f8f9fb`, `#fafbfc`

### Fonts
- Headings: `'Barlow Condensed', sans-serif` (weights 700-900)
- Body: system / `'Inter', sans-serif`

### Reusable components
- `TLogo` (503) — team logo by name with size prop
- `PageHero` (521) — page header banner
- `TabBar` (534) — tab navigation
- `Card` (550) — base card container
- `FinalCard` (585) — final-game display card
- `UpcomingCard` (643) — upcoming game card
- `GamePreviewModal` (677) — game preview modal
- `Ticker` (836) — score ticker
- `Navbar` (973) — top nav + More dropdown
- `BoxScoreModal` (1330) — public box score viewer
- `POTGBadge` (1539) — Player Of The Game badge
- `LiveBoxScoreFinalCard` (1599) — final card with live box score expand
- `RichTextInput` (4390) — simple rich text input
- `RichTextEditor` (4433) — full rich text editor with toolbar
- `BSH2`, `BSCrd` (10434, 10447) — Box Score entry headers/cards
- `SaveStatusToast` (10296) — toast notification system
- `AutoplayAnthem` (10341) — intro audio player
- `Diamond` (12923) — base diamond for live scoring
- `StatLegend` (2943) — abbreviation key

### Mobile considerations
- Responsive nav with "More ▾" dropdown
- Tab bars with horizontal scroll
- Touch-friendly button sizes
- viewport meta tag set

---

## 10. Email & Communications

### Weekly Email
- `WeeklyEmailPage` (7024) — generates HTML email recap
- Pulls latest games + standings + headlines
- Copy-paste output for sending via external service

### Sign-up Export
- `AdminSignupsViewer` (8405) — review submissions
- Email list export to CSV
- Add player to roster directly from sign-up

### Sign-Up Promotion
- "📣 PLAYERS — JOIN THE LIST!" banner on HomePage
- Styled in red/white/blue
- Auto-dismisses for users who've signed up

---

## 11. Captain Submission Flow

### "[submitted: TEAM]" tagging
- Captain saves box → headline gets ` [submitted: TEAM]` appended
- Admin sees the tag in edit mode (`editSubmittedTag` state)
- Public rendering MUST strip via `cleanHeadline()` (line 51)
- Re-saving preserves the original tag

### Per-team locked sections
- Captain sees their team's batting + pitching as editable
- Opposing team renders as locked box with summary

### Draft persistence
- Local-storage drafts per game (`bseDraftKey`)
- Restore on game re-select
- Cleared on successful save

---

## 12. Critical Bug Fix Patterns (don't break these)

### Stable React keys
- `key={g.id}` on all box-score-related lists (NOT `key={i}`)
- Otherwise component instance reuse causes stale-data leaks across games

### Defensive useEffect
- `LiveBoxScoreFinalCard` resets `boxLoaded` on `game?.id` change
- Prevents previous game's cached data leaking when parent changes data

### Save filter
- Drop zero-stat batting/pitching rows BEFORE insert
- Prevents phantom-row pollution in box score view

### Load filter
- Drop zero-stat rows on LOAD too
- Editor matches public view regardless of legacy data

### `hr` column in `pitching_lines` is NONEXISTENT
- Selecting it returns PGRST204
- Code workaround: just don't select it
- Career Pitching table dropped HR column

### Score reconciliation
- Auto-calc in fresh entry mode (prevents off-by-N during entry)
- Editable in edit mode (`editGameId` set) so captains can override

---

## 13. Slash Commands / Skills / External Tooling

- Deployed via Vercel (auto-deploys `main` branch)
- Vite build (`vite.config.js`)
- React 18, no router (single-file SPA with internal `tab` state)
- Supabase REST/PostgREST (no Realtime, no Edge functions, no Storage)
- DOMPurify for `dangerouslySetInnerHTML` sanitization

---

## 14. Known TODO / Phase 2 Work

- Standings page migration to dynamic divisions (partial)
- HomePage sidebar migration to dynamic divisions
- TeamsPage Team Directory dynamic divisions
- 5/9 Saturday games still need stat entry / re-entry
- Tab labels shortened with heuristic — may need explicit `short_name` column on lbdc_tournament_meta
- 4/18 Brooklyn vs Tribe score (canonical says 0-8, captain may have meant 1-8)
- 153 historical IP-fraction-encoded pitcher lines in old seasons (decimal `.3/.7` instead of baseball `.1/.2`) — left alone
- Score-vs-batting mismatches in 5 Spring 2026 games (off by 1-3 runs) — captains know the truth

---

## 15. File-Level Architecture Notes

**Single-file SPA.** `src/App.jsx` is ~14,700 lines. Has grown organically; multiple attempts to split would be high-risk. On the new platform, this is the natural decomposition boundary set:
- Public pages (Home, Scores, Schedule, Standings, Teams, Stats)
- Team Detail (its own subsystem)
- Player Profile / PlayerStatsModal (its own subsystem)
- Box Score Entry (huge, ~1500 lines, well-isolated)
- Live Scorer (huge, ~1500 lines)
- Admin Portal (all sub-tools, ~3000 lines combined)
- Auth + Captain layer
- Stats Aggregation utilities (cleanName, matchKey, dedupGames, etc.)
- UI primitives (Card, TabBar, TLogo, etc.)

When platform-izing, the **stats aggregation utilities** are the highest-leverage shared code. Every league site needs them.

---

## 16. What I'd Tag As LBDC-Specific vs Reusable

### Reusable across leagues (general baseball/softball platform)
- `cleanName`, `matchKey`, `preferStarred`
- `dedupGames`
- `parseIP`, `fromIP`
- Box score entry flow (with parameterized field rules)
- Player profile modal
- Stats leaderboard
- Schedule grid rendering
- Standings auto-computation
- Admin portal scaffolding
- Captain auth pattern
- Live scorer base
- Photo gallery
- Sponsor section
- Rules editor
- Rich text editor

### LBDC-specific (would need parameterization)
- Boomers vs Saturday split — assumes 2-division setup
- Saturday season detection (id 2 + 31)
- Specific team names, colors, logos
- $50 + 4-game eligibility rule
- Boomers $25+$20/game model
- Specific tournament list
- Field rotation
- Headlines auto-recap templates
- Audio anthem
- Tournament Manager UI specifics

---

End of inventory. Add anything I missed by appending to the relevant section.
