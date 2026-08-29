# CHANGELOG

Running log of every change shipped to the LBDC site, written so you can port the same fix/feature to the platform later.

Format: each entry has a **What**, **Why**, and **Where** so you know what to copy across.

> Starting fresh from 2026-05-13. Earlier work is documented in `PLATFORM_MIGRATION.md`.

---

## [2026-08-28]

### Fixed — Stats/standings/team pages went blank after the Fall/Winter rollover

After activating the Fall/Winter 2026-27 season, every "current season" view defaulted to it — but Fall/Winter has **no games yet**, so the Stats leaderboard showed "no players," team pages looked empty, and head-to-head read "first meeting." (Reported via Daniel: "the tribe stats for the season only picks up 1… the stats r there but they aren't being included.") The Spring/Summer 2026 data was never lost — it was just hidden behind the empty new season.

- **Root cause:** `getSatSeasonFilter` / the Stats + Standings + team-page defaults all resolved to `CUR_SAT` (Fall/Winter, 0 games).
- **Fix — game-aware "active season" for DISPLAY:** added `ensureActiveSatProbed()` (probes once whether `CUR_SAT` has any games, cached) + `getDisplaySatSeasonRow()` / `getDisplaySatSeasonLabel()`. `getSatSeasonFilter` now uses the display resolver, so if `CUR_SAT` is empty it falls back to `PREV_SAT` (Spring/Summer). **Self-correcting:** the moment the new season gets its first game, everything flips to it automatically — no manual step, and it protects every future rollover. Each display effect `await`s the probe before resolving, so there's no first-render flash.
- **Write path untouched:** game SAVE routing still uses `getCurSatSeasonRow`/`getSatSeasonForDate`, so new games still land in the true current season (Fall/Winter for post-cutover dates).
- **Also:** Stats-page default season, the Saturday standings toggle default, and `DIV.SAT.name` (team-page eyebrow) now follow the active season; silenced a null-`value` React warning on the season `<select>`.

Verified against the live DB: Stats defaults to Spring/Summer (166 batters / 49 pitchers), Tribe team page shows 17-1 with full roster stats (Pete Cesario 17 GP / .431), head-to-head shows real records (Generals 8-9, Tribe 17-1, 0-3 Tribe leads). Build passes, console clean.

Known follow-up (pre-existing, not from this change): the Stats *leaderboard* undercounts a couple games for some players vs the player card / team page (dedup quirk). Deferred.

**Where:** `src/App.jsx` — season resolver block (`ensureActiveSatProbed`, `getDisplaySatSeasonRow`, `getDisplaySatSeasonLabel`, `getSatSeasonFilter`), 8 display call sites, StatsPage default, Saturday standings toggle, `DIV.SAT.name`.

### Added (dormant) — Squares Board fundraiser (not yet linked)

Built a 50-square (10×5) football/baseball squares pool board as a league fundraiser — view-only for players, admin-managed by the commissioner (fill names, draw numbers, live winner highlight). **No money shown anywhere on the site** (buy-in handled off-site via the commissioner). Currently **dormant**: `SquaresPage` + `/squares` route exist but the menu link is pulled, so it's invisible until launch. Re-enable by restoring the `["squares","🟦 Squares Board"]` entry in `moreLinks`.

**Where:** `src/App.jsx` — `SquaresPage`, `sqShuffle`/`sqDrawNumbers`/`sqWinnerIndex`, `/squares` route. DB: `lbdc_schedules` id="squares" (created when a board is set up).

## [2026-08-23]

### Added — Players Forum (suggestion box the whole league votes on)

Built from a player's suggestion (relayed by Daniel): a place where every rostered player posts ONE suggestion and the league votes on all of them.

- **`PlayersForumPage`** + `/forum` route. Player identifies themselves (pick team → name from the roster, remembered on the device), posts **one** suggestion (enforced), and votes on everyone's. Suggestions are ranked by votes. Each player can toggle a 👍 vote on any suggestion (one vote per player per suggestion). Own suggestion is editable/deletable; "Not you?" switches identity.
- **Disclaimers baked in** (the two the player asked for): "voting does not guarantee any suggestion will be implemented — but every one will be considered, and everyone can see how the whole league feels," and "this isn't a perfect system, but it's the best we could put together on short notice."
- **Welcome-page access:** a prominent gold-accented "Players Forum — Have Your Say" card at the top of the Home content column (player-facing), plus a "💡 Players Forum" entry in the More menu.
- **No DB setup:** stored as a jsonb blob under `lbdc_schedules` id="forum" (same store as field_fees); writes re-read the latest blob first to minimize lost updates. Works immediately.

Verified end-to-end against the live DB: identity gate, post (one-per-player), vote/unvote (1→0→1, persisted), ranking, disclaimers, Home card + nav. No console errors. Test data cleaned up.

**Where:** `src/App.jsx` — `PlayersForumPage`, `/forum` route, `moreLinks`, Home welcome card. DB: `lbdc_schedules` id="forum" (created on first post).

---

## [2026-08-22]

### Changed — Activated the Fall/Winter 2026-27 season (rolled over from Spring/Summer 2026), with overlap handling

Daniel: activate Fall/Winter while keeping Spring/Summer + the championship fully accessible during the overlap (playoffs 8/22 done, championship 9/12 pending).

**Single source of truth (fixes the season-resolution landmine permanently):** replaced ~30 scattered "resolve the Saturday season by name" sites with one config + helper set (`CUR_SAT` / `PREV_SAT` / `SAT_CUTOVER_ISO` and `getCurSatSeasonRow` / `getPrevSatSeasonRow` / `getSatSeasonFilter` / `getSatSeasonForDate` / `getSatSeasonRowByLabel`). Rolling to a future season is now a one-line change. Built with a graceful fallback so the code was safe to deploy before the new `seasons` row existed.

**Overlap handling — games route to the right season by DATE:** all 5 game-save paths now use `getSatSeasonForDate(seasons, isoDate)` — games dated on/before **2026-09-12** stay in **Spring/Summer 2026**, later games go to **Fall/Winter 2026-27**. So the championship (9/12) and playoffs (8/22) still count for Spring/Summer even after the flip, while new fall games land in Fall/Winter. Verified against the live DB.

**Spring/Summer stays fully accessible:**
- **Scores** → tabs: Fall/Winter 2026-27 (default) · Spring/Summer 2026 · Tournaments.
- **Standings** → Fall/Winter / Spring/Summer toggle.
- **Stats** → defaults to Fall/Winter; Spring/Summer (all 166 players) still in the dropdown, kept **separate** (no cross-season merge; also fixed the player-profile per-season breakdown to stop merging/mislabeling the two seasons).
- **Admin → Manage Saved Games** spans both seasons so the championship stays editable.
- **Home / team pages** default to the current (Fall/Winter) season.

**Labels** updated to the current season where they mean "this season" (division name, sign-up hero, schedule-manager header, etc.); left data keys (payments) and the Spring/Summer tab entries alone. Tidied stale "Season opens April 11" empty-state text.

**DB:** created `seasons` row "Fall/Winter 2026-27 Diamond Classics Saturdays" (id 42, year 2027). Fall/Winter schedule starts empty for Daniel to fill in via Manage Schedule (TBD teams/times/fields supported); the Spring/Summer schedule + playoffs + championship are untouched. Reverting the flip = delete that one row.

**Where:** `src/App.jsx` — season config/helpers (~11833), 5 save paths, Scores/Standings/Stats, TeamDetail, loadAdminGames, labels. DB: `seasons`.

---

## [2026-08-16]

### Added — Playoff (8/22) + Championship (9/12) games on the schedule, with round badges

Daniel: "2 playoff games 8/22, times/fields TBD, championship 9/12 TBD."

- Posted 3 games to the Saturday schedule (`lbdc_schedules` "sat"): two **Aug 22** playoff games and one **Sep 12** championship, all **TBD** teams / time / field (Daniel edits them in Manage Schedule as seeding + fields lock in).
- **Round badge:** `UpcomingCard` now shows a gold "🏆 PLAYOFFS" / "🏆 CHAMPIONSHIP" pill driven by the game's `notes` field, so these read clearly as postseason instead of blank TBD cards. Passed `label={g.notes}` at the Home "This Week" and Schedule-tab call sites.
- **Bye-week fix:** the Schedule page was listing all 8 teams as "BYE WEEK" on the playoff weeks (because TBD-vs-TBD means no real team is scheduled). Now the bye row is suppressed when no real matchup is set for the week.

Verified: Aug 22 shows two 🏆 PLAYOFFS cards, Sep 12 shows the 🏆 CHAMPIONSHIP card, no bogus bye row, build + no console errors.

**Where:** `src/App.jsx` — `UpcomingCard` (`label` badge), SchedulePage bye logic + two UpcomingCard call sites; DB `lbdc_schedules` "sat".

---

## [2026-08-15]

### Removed — the Boomers 60/70 division (abandoned experiment), everywhere

Per Daniel: the Boomers division "never took hold" — removed it completely so the site is just the 8-team Saturday league (+ Tournaments).

**Code (`src/App.jsx`, `api/schedule.ics.js`, `src/historyData.js`):** removed ~166 references — `BOOMERS_TEAMS`, `BOOMERS_SCHED`, `DIV.BOM`, `buildStaticBomWeeks`, the two Boomers teams from the color/logo maps, the 3 Boomers rules sections, and every `boomer*`/`bom*` state/branch/fetch/UI across HomePage, Ticker, ScoresPage, SchedulePage, StandingsPage, RulesPage, PlayerEligibilityPage, ManageSchedulePage, Manage-Saved-Games, LiveScorerPage, game-entry/save, TeamDetailPage, payment categories, and the iCal feed. The Saturday/Boomers/Tournaments tab bars on Scores & Schedule collapsed to Saturday + Tournaments (renumbered the Tournaments index). Build passes; browser-verified Home, Scores, Schedule, Standings, Rules, and admin Manage Schedule — no Boomers, no console errors, Tournaments still reachable.

**Database:** deleted the Boomers season (`2026 BOOMERS 60/70 Division`) + its 3 experimental games (+32 stat lines), the `lbdc_schedules` "bom" blob, both Boomers team rosters (36 players), and 28 `player_payments` rows (`season='Boomers 2026'`). Also scrubbed the admin-edited rules (`lbdc_rules`): removed the 3 Boomers sections and the Boomers paragraph embedded in "Registration & Playoff Eligibility."

**Also fixed while in the rules:** the DB-edited Rules page still showed the **$50** registration fee — the earlier $50→$75 change only touched the hardcoded fallback, not the admin-edited `lbdc_rules` copy the page actually renders. Corrected both fee mentions to **$75** (matches the commissioner's posted "first increase in 12 seasons" announcement).

**Fall/Winter 2026-27:** teams carry over (same 8 rosters, untouched). Per Daniel (Option 2), NOT flipping the site to the new season yet — will create + activate Fall/Winter 2026-27 once he sends the finalized schedule, to avoid a duplicate "…Diamond Classics Saturdays" season colliding with the live Spring/Summer one.

**Where:** `src/App.jsx`, `api/schedule.ics.js`, `src/historyData.js`; DB tables `seasons`, `games`, `batting_lines`, `pitching_lines`, `lbdc_schedules`, `lbdc_rosters`, `player_payments`, `lbdc_rules`.

---

## [2026-08-09]

### Fixed — TWIB rejected scheme-less links + didn't embed http/non-www TikTok short links

Two follow-on bugs from the short-link work:
- **"⚠ Not an Instagram or TikTok link":** Daniel pasted `tiktok.com/t/…` **without** `http(s)://`. `parseTwibUrl` uses `new URL()`, which requires a scheme, so it rejected the link. Now it prepends `https://` when the scheme is missing.
- **Preview showed the "Watch on TikTok" card instead of the video:** his link was `http://tiktok.com/t/…` (http, no www). TikTok's oEmbed only resolves `https://www.tiktok.com/…` — `http://tiktok.com/…` returns nothing (and, being an error response, has no CORS header, so the browser blocked it). `resolveTiktokId` now canonicalizes the url to `https://www.tiktok.com/…` before calling oEmbed. Verified all three forms (`http://tiktok.com/t/…`, bare `tiktok.com/t/…`, `https://www.tiktok.com/t/…`) resolve to the video with no errors, and the admin preview embeds the real player.

**Where:** `src/App.jsx` — `parseTwibUrl` (scheme prepend), `resolveTiktokId` (https+www normalization).

---

## [2026-08-08]

### Fixed — TWIB now embeds TikTok SHORT links (tiktok.com/t/… , vm.tiktok.com/…)

Daniel posts with TikTok's short share link (e.g. `tiktok.com/t/ZTAcVgrUt/`), which has no numeric video id in the URL, so TWIB fell back to a "Watch on TikTok" button instead of embedding the video.

- Short links are now **resolved via TikTok's public oEmbed** endpoint (`/oembed?url=…`), which accepts short links and returns the video id (`embed_product_id`). Confirmed oEmbed is CORS-open, so this runs entirely in the browser — no server/proxy, works on localhost and prod, and handles the already-posted link with no re-posting.
- `parseTwibUrl` marks short links `resolvable`; a `useTwibEmbedUrl` hook (with a per-URL cache) does the async lookup and swaps in `embed/v2/{id}`. `TwibEmbed` and `TwibHeroVideo` show a brief "Loading…" then the real player; if resolution ever fails they still fall back to the watch-link card. The admin's live detection now shows "✓ TikTok video detected — will embed" for short links too.
- Verified end-to-end with Daniel's exact link: `tiktok.com/t/ZTAcVgrUt/` → resolved to `embed/v2/7671817038616202510` → the video rendered on the hero. No console errors.

**Where:** `src/App.jsx` — `resolveTiktokId` + `_tiktokIdCache`; `parseTwibUrl` (`resolvable`); `useTwibEmbedUrl`; `TwibEmbed`, `TwibHeroVideo`; admin `isEmbeddable`.

---

## [2026-07-30] (2)

### Added — Drag-to-position photo cropper + larger headshots

Follow-up to Daniel: he wanted to preview and manually center each photo, and the photos read a bit small.

- **`PhotoCropper`:** after a captain picks a photo (Captains Portal → Roster → tap a headshot), a circular preview opens that they **drag to center the face** and a **Zoom slider** to scale in. Pointer-events based (works with touch on phones; `touchAction:none`). On save it bakes exactly that framing to a 340px square JPEG — so the stored image is already framed and display is foolproof (no guessing at object-position). Verified the bake math maps drag/zoom → the correct source region.
- **Bigger everywhere:** leaderboard thumbnails 28→36px; profile-header photos 48→72px (both the Stats-page profile and PlayerStatsModal). Verified live with a test headshot — reads clearly on the leaderboard and looks sharp in the profile.
- The old auto-compress (`compressImageFile`) is no longer used for uploads (the cropper handles sizing) but is left in place.

**Note:** the ~7 photos already uploaded were framed by the old code; re-uploading them through the new cropper lets the captain position each one properly.

**Where:** `src/App.jsx` — `PhotoCropper`; `CaptainRosterEditor` (crop flow, `savePhoto`, 44px row avatar); leaderboard/profile photo sizes.

---

## [2026-07-30]

### Fixed — Player photos were lopping off heads (center-crop → keep the whole photo)

Daniel's uploaded headshots (e.g. Joe Barrett) had the heads cut off. `compressImageFile` was center-cropping every upload to a square, which discards the top/bottom — so on a portrait photo the head (up top) got thrown away, permanently, at upload time.

- **Stopped cropping at upload:** `compressImageFile` now resizes the WHOLE image to fit within 380px (preserving aspect ratio, no crop) so the full head is always kept in the stored file. Still small (~20-40KB JPEG).
- **Bias the circular view toward the top:** `PlayerPhoto` renders the round avatar with `object-position: center 20%`, so when a portrait is shown in a circle the face stays in frame instead of centering on the torso. Verified side-by-side (portrait test image: new setting keeps the face; old center-crop pushed it out).

**Note:** photos uploaded before this fix were already square-cropped (head gone from the stored data), so those need a quick re-upload to benefit. New uploads are correct automatically.

**Where:** `src/App.jsx` — `compressImageFile` (no crop), `PlayerPhoto` (`objectPosition`).

---

## [2026-07-29] (2)

### Added — Player mugshots (headshots) on the Stats pages; captains upload them

Daniel asked for player photos on the stats pages, uploaded by captains.

**How it works:**
- **Captains upload:** Captains Portal → Roster now shows a round headshot (initials until a photo is set) beside each player. Tap it → pick a photo (camera roll / camera on phone) → it's saved. A small ✎/＋ badge indicates change/add; a ✕ removes it.
- **Where photos show:** a round thumbnail beside each name on the **Batting & Pitching leaderboards**, and a larger one in the **player profile** popups (both the Stats-page profile and the shared PlayerStatsModal used from Home/Standings). Players without a photo keep the initials badge, so nothing ever looks broken.

**No storage setup needed:** each photo is center-cropped to a square and compressed in the browser to a ~220px JPEG (~15–30KB) stored as a data URL in a new `lbdc_rosters.photo` column — no Supabase Storage bucket. The leaderboards fetch only rows that actually have a photo (`photo=not.is.null`), lazily and non-blocking, so the page isn't slowed and the payload stays small.

**Safe rollout:** the `photo` column is added by `sql-add-player-photos-2026-07-29.sql`. The app feature-detects it (`rostersHavePhoto()`): before the SQL runs, the upload UI is hidden and everyone shows initials (verified — the probes 400 and are caught); after, upload + display light up. Captains already have UPDATE rights on `lbdc_rosters` (they edit rosters), so no new policy is needed.

**Verified:** leaderboards + profile render initials cleanly with the column absent; the browser image compressor turns a 1.1MB PNG into a 3KB square JPEG; no new console errors (only the expected feature-detect 400s).

**Where:** `src/App.jsx` — `PlayerPhoto` + `compressImageFile`; `rostersHavePhoto()` + `fetchPlayerPhotoMap()`; `CaptainRosterEditor` upload UI; StatsPage `photoMap` + leaderboard thumbnails + profile header; `PlayerStatsModal` photo. Plus `sql-add-player-photos-2026-07-29.sql`.

**Note (needs Adam):** run `sql-add-player-photos-2026-07-29.sql` once in Supabase to switch photos on. Until then everything shows initials.

---

## [2026-07-29]

### Added — "TBD" selectable for teams AND venues in Manage Schedule (post playoff games before matchups are set)

Daniel wanted to post a couple of upcoming playoff games but two teams (and their fields) are still undetermined. The Manage Schedule editor's team/venue dropdowns only listed real teams/fields, so there was no way to enter a placeholder.

Added **"TBD"** as a selectable option in every team dropdown (single Add Game, bulk "Add Many", and inline edit) and every venue dropdown in `ManageSchedulePage`, via local `teamOptsTBD` / `fieldOptsTBD` lists. The app already treats "TBD"/"TBA" as placeholders everywhere — kept out of standings and team lists, and `TLogo` renders a plain "TBD" badge instead of a broken logo — so a TBD game displays cleanly and pollutes nothing. `addGame` only requires a date, so a TBD-vs-TBD matchup saves fine. Left the other (non-schedule) team dropdown at ~13952 untouched.

**Where:** `src/App.jsx::ManageSchedulePage` — `teamOptsTBD`/`fieldOptsTBD`; the 4 team selects + 3 venue selects.

---

## [2026-07-28]

### Changed — Registration fee $50 → $75; Player Sign-Up now collects Date of Birth + Positions Played

**Fee:** the seasonal registration fee is now **$75** everywhere it's referenced as the 50's registration fee — the Sign-Up page fee box, the Rules "Registration & Playoff Eligibility" section, and the Admin eligibility tracker ("$75 fee paid" / "$75 Paid" column). Left untouched (different charges): Boomers 60/70 "$25 Registration & Insurance" and the separate "Seasonal Insurance (50's) $50" line item.

**New sign-up fields:**
- **Date of Birth** (date picker, required) — "used to confirm age eligibility for the division."
- **Positions Played** (tap-to-toggle chips: P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH; optional, multi-select).
- Both are included in the sign-up email to Daniel and shown in Admin → Player Sign-Ups (🎂 DOB, 🧢 positions).

**Safe rollout (no signups break before the DB migration):** `dob`/`positions` need two new columns on `lbdc_signups`, added by `sql-add-signup-fields-2026-07-28.sql`. The form feature-detects the columns (`signupsHaveExtraCols()`): before the SQL is run it folds DOB + positions into the `notes` field (so nothing is lost and they still show in Admin) and never sends unknown columns; after the SQL is run they save to their own columns and render as dedicated fields. Verified the probe 400s and the fallback insert succeeds.

**Where:** `src/App.jsx` — RULES fee text; SignUp fee box + `dob`/`positions` state, fields, submit payload + email; `signupsHaveExtraCols()`; PlayerEligibilityPage fee labels; admin signups viewer row. Plus `sql-add-signup-fields-2026-07-28.sql`.

**Note (needs Adam):** run `sql-add-signup-fields-2026-07-28.sql` once in Supabase for clean DOB/positions columns. Until then the data still flows via the email + notes. DOB is currently **required** — say the word to make it optional.

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

## [2026-07-27] (2)

### Changed — TWIB video moved onto the hero banner (right/first-base side) + music volume lowered

Daniel asked for the weekly video to sit on the banner, opposite the league emblem (which is baked into the left of `hero111.jpg`), with the site music softer.

- **Hero overlay:** the most recent TWIB video now renders on the RIGHT side of the field banner via `TwibHeroVideo`. Reels are portrait and the banner is only ~400px tall, so the embed is rendered at native size inside a wrapper and CSS `transform: scale(0.62)` shrinks the whole player to fit the banner height (scaling the wrapper, not the iframe width, avoids clipping TikTok/IG's side rail). A "🎥 This Week in Baseball" caption sits beneath it.
- **Responsive:** on ≤820px the banner is too short to overlay, so the video drops just below the banner (full-width, centered) instead. Verified desktop overlay + mobile stack.
- **Content column:** `TwibNotesSection` is now a "Past TWIB Notes" archive (previous clips only) since the latest lives on the hero; renders nothing until there are ≥2 videos.
- **Music:** league anthem volume lowered 0.5 → 0.14 (much softer background).

**Known limits (flagged to the commissioner, inherent to IG/TikTok embeds):** the embed can't autoplay with sound (browser rule — viewer taps once to hear the message), and the site can't detect when a cross-origin embed ends, so the music can't be sequenced to start *after* the video — it stays as low background. Both would require self-hosted/uploaded video instead of an IG/TikTok link.

**Where:** `src/App.jsx` — `TwibHeroVideo`; HomePage `latestTwib` + hero overlay; `.hero-wrap`/`.hero-video-overlay`/`.hero-video-cap` CSS (+ ≤820px media query); `TwibNotesSection` (past-only); `AutoplayAnthem` volume.

---

## [2026-07-27]

### Added — TWIB Notes: weekly video updates on the Home page (Instagram/TikTok)

Daniel wanted a "Diamond Classics TWIB Notes" spot on the home page for weekly video updates he can make from his phone and share from Instagram/TikTok.

**How it works for Daniel:** Admin → 🎥 TWIB Notes → paste an Instagram or TikTok share link (+ optional caption + date) → it publishes to the Home page. The most recent clip is embedded prominently under "News & Events"; older ones appear in an "Earlier Updates" list.

**Implementation:**
- **Embed via each platform's DIRECT iframe endpoint** (`instagram.com/<type>/<code>/embed/`, `tiktok.com/embed/v2/<id>`), parsed from the pasted URL — not the flaky embed.js `<script>` widgets, which need re-processing inside a React SPA. An iframe just renders. Verified the TikTok embed endpoint renders a real video standalone.
- **Graceful fallback:** links we can't turn into an embed (TikTok `vm.*` short links, YouTube, etc.) render a "Watch on …" card instead, and every embed also carries a "▶ Watch on {Platform} ↗" link beneath it, so the section is never a dead blank box even if a platform is slow/blocked.
- **Zero SQL setup:** data lives as a jsonb list under `lbdc_schedules` id="twib" (the same general keyed-JSON store that already holds `field_fees`). The Home section renders nothing until the first video is added, so this shipped dormant and appears the moment Daniel posts.
- Admin manager auto-detects the platform, shows a live "✓ Instagram/TikTok detected" hint + inline preview, warns on non-IG/TikTok links, and lists posted videos with delete.

**Where:**
- `src/App.jsx` — `parseTwibUrl`/`twibPlatformLabel` helpers, `TwibEmbed` + `TwibNotesSection` (Home), `TwibNotesPage` (admin); HomePage fetch + render; admin tile + `quickView==="twib"`.

**Note:** Instagram/TikTok posts must be **Public** to embed. Verified end-to-end: admin add/detect/delete, DB round-trip, Home render with correct iframe + earlier-updates list. (The in-app preview pane doesn't paint cross-origin iframes, but the embed endpoint renders correctly on a real browser — confirmed by loading it standalone.)

---

## [2026-07-26] (2)

### Changed — Rebuilt the hardcoded fallback schedule (`SCHED`) to match the current 8-team live schedule

The `SCHED` constant is the built-in fallback the ticker and Schedule page show for the split second before the live admin schedule (`lbdc_schedules` id="sat") loads. It predated the Leones/Indios expansion — it had only the original 6 teams, stopped at Aug 8, and its matchups had drifted from the live schedule. That mismatch was the *content* half of the ribbon bug fixed earlier today (the dependency fix made the overlay recover once live data loaded; this makes the fallback itself accurate so there's nothing to recover from).

Regenerated `SCHED` directly from the live `lbdc_schedules` "sat" blob: 17 weeks (Apr 11–Aug 15), 58 games, all 8 teams (Leones/Indios included from Jun 27 on), correct fields/times/matchups. `buildStaticSatWeeks()` (Schedule page) derives from `SCHED`, so both fallbacks update from this one change. Validated the literal parses to 17 weeks / 8 teams with balanced game counts (6 original teams ×17, Leones/Indios ×7).

**Where:** `src/App.jsx::SCHED` (single source; ticker maps it directly, `buildStaticSatWeeks` derives from it).

---

## [2026-07-26]

### Fixed — Ribbon (and Schedule tab) showed freshly-entered finals as "upcoming" when the live schedule differs from the hardcoded fallback

Daniel entered 3 of the 4 Jul 25 finals Sunday morning; the top ribbon still showed them as game times (only the Brooklyn/Generals forfeit, entered earlier, showed as FINAL).

**Root cause — a stale React effect dependency.** The ticker's score-overlay effect was keyed on `week.label` alone, but it builds its query from the week's **matchups** (`games`). On load, `liveSat` is null so `satWeeks` falls back to the hardcoded `SCHED`; the effect fetches scores for those *hardcoded* matchups. The live admin schedule then loads async and swaps in the current matchups **under the same "Jul 25" label** — so the dependency never changed and the score fetch never re-ran. The overlay stayed keyed to the stale hardcoded matchups. Brooklyn@Generals exists in both schedules → it mapped; Leones/Indios (teams added after the hardcoded `SCHED` was written) and the reshuffled Pirates@Tribe pairing did not → they rendered as "upcoming." This is why it only bites now that there are 8 teams and the live matchups diverge from the old fallback.

**Fix.** Derive a `gamesKey` from the actual matchups (`away|home` joined) and add it to the effect's dependency array so the score fetch re-runs the moment the matchups change. Applied to BOTH the ticker and the Schedule page (`schedScores`), which had the identical latent bug.

**Where:**
- `src/App.jsx::Ticker` — `gamesKey`; score-overlay effect dep `[week.label, gamesKey]`
- `src/App.jsx::SchedulePage` — `gamesKey`; `schedScores` effect dep `[wk, satSeasonId, gamesKey]`

---

## [2026-07-24]

### Fixed — A forfeit (and any non-"Final" result) didn't show on the ticker or Schedule tab; plus a duplicate empty season that silently broke the Schedule tab's finals

Daniel entered a Wed forfeit (Brooklyn 7 @ Generals 0). It showed nowhere: not the top ribbon, not the Schedule tab. **Two independent root causes**, both fixed:

**1. Status vocabulary mismatch.**
- The box-score entry form offers `Final / Forfeit / Tie / Postponed`, but every consumer in the app only recognized the literal `"Final"` (plus PPD/CAN). A game saved as "Forfeit" — even with a final score — was treated as *unplayed*: hidden from the ticker, the Schedule tab, and excluded from the standings queries (`status=eq.Final`).
- Added two helpers (top of `App.jsx`):
  - `canonicalStatus()` — normalizes at the **write** boundary: Forfeit/Tie → `Final` (a forfeit IS a final with an official score), Postponed → `PPD`, Cancelled → `CAN`. Applied to all three status writes in the box-score save. So standings/ticker/schedule "just work" without teaching the ~11 `status=eq.Final` query sites a new word.
  - `isNotPlayedStatus()` — the display test. Ticker and Schedule now show a game's result unless its status is postponed/canceled/scheduled (defense-in-depth: even a stray non-canonical status still displays its score).
- Repaired the live row: game 2679 status `Forfeit` → `Final` (kept headline "Generals Forfeit" so it reads as a forfeit).

**2. Duplicate empty season shadowing the real one.**
- There were TWO seasons for the 2026 Saturday league: **id 2 "Spring/Summer 2026"** (held all 44 games) and **id 31 "Spring/Summer 2026 Diamond Classics Saturdays"** (0 games, an accidental duplicate created by a save-path fallback that names the season differently than the primary insert path).
- The app resolves this season by name in ~15 places with inconsistent heuristics. The Schedule page used `find("Diamond Classics Saturdays") || find("Spring"+"2026")`, which preferred the **empty** id 31 → its score fetch returned nothing → finals (forfeit or not) never appeared on the Schedule tab. The box-score save used a single-predicate `.find` that happened to land on id 2 — which is why games saved to 2 but the schedule read 31.
- **Consolidated to one season:** deleted empty id 31, renamed id 2 → "Spring/Summer 2026 Diamond Classics Saturdays". Now every resolution heuristic (includes-Diamond-Classics, Spring+2026, single-find, and the create-if-missing fallbacks) converges on the one season that holds the games — so a save can't recreate a duplicate. Verified no games/config referenced 31; `player_payments.season` is an independent text column and was untouched.
- **Hardened the Schedule fetch** to not depend on a name-resolved season id at all: it now matches by exact ISO date + team pair + has-score (same as the ticker, which never had the bug). Even if a duplicate season reappears, the Schedule tab keeps working.

**Where:**
- `src/App.jsx` — `canonicalStatus` / `isNotPlayedStatus` helpers; ticker `isFinal`; SchedulePage `schedScores` fetch (dropped `season_id` filter) and its `LiveBoxScoreFinalCard` gate; three `status:canonicalStatus(gameStatus)` writes in the box-score save.
- DB: deleted season 31, renamed season 2, set game 2679 → Final.

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
