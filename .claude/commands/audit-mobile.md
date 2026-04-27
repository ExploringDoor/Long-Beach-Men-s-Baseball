---
description: Mobile/responsive audit — find layout breakage and touch-target issues at iPhone widths
---

Run a mobile/responsive audit on the LBDC site. The site is React + Vite at `~/Desktop/Long-Beach-Men-s-Baseball`. Built site is in `dist/`. Most fans visit from phones, so layout breakage on mobile = breakage for the majority of users.

## How to run it

If the Claude Preview MCP tools (`mcp__Claude_Preview__preview_*`) are available, use them — start a preview, resize to iPhone widths (375px and 390px), screenshot each major page. If not available, do a static code audit using the patterns below.

Either way, produce a punch list under 600 words organized by page.

## What to check on every page

### Per page
For each of these pages — Home, Schedule, Scores, Standings, Teams, Stats, Contact, Payments, Field Directions, Rules, Sponsors, Admin — verify at iPhone widths (375px):

1. **Horizontal overflow** — Does any element scroll the page sideways? Most common culprits: long team names in card headers, fixed-width tables, sidebar widgets that don't collapse.

2. **Touch targets** — Buttons / clickable rows under 44×44 pixels are too small for thumbs. Specifically check tab bars, card "View →" links, and modal close buttons.

3. **Modal fit** — Open every modal (BoxScoreModal, GamePreviewModal, BoomersRSVPModal, PlayerStatsModal, recap modal). Does it fit the viewport with margin? Is the close button reachable without scrolling?

4. **Sticky element overlap** — The top tab bar / nav. Does it cover the first row of content? Does the standings sidebar (sticky on desktop) collapse properly on mobile?

5. **Hero image scaling** — `/hero111.jpg`. Does it crop sensibly on mobile or stretch ugly?

6. **Form inputs** — Any admin form. Are inputs full-width? Do labels wrap or get cut off? Do date pickers fire the native iOS date picker?

7. **Long content overflow** — News & Events post bodies, commissioner announcements, recap text. Does overflow word-wrap or get truncated weirdly?

## Static code patterns to grep for (if Preview tools unavailable)

- `gridTemplateColumns:"1fr 340px"` — fixed-width sidebar that should collapse
- `width:"380px"` / `minWidth:380` — anything with hard pixel widths instead of `min(380px,100%)`
- `padding:"0 40px"` — large fixed padding on small screens
- `whiteSpace:"nowrap"` — text that won't wrap (often what causes horizontal scroll)
- `position:"fixed"` / `position:"sticky"` — anything that might cover content on small screens
- Tables without `overflowX:"auto"` wrappers — wide tables overflow

## Format the report

For each page, list issues as:
- **Page name**
  - [Severity] Description (file line if known)

Severity:
- **BLOCKER** — page is unusable on mobile (horizontal scroll, modal off-screen, button unreachable)
- **MED** — usable but ugly / confusing
- **LOW** — cosmetic nit

Don't fix anything. The user picks.

## When to run

- After adding a new page or major component
- Before sharing the site with a wider audience (season opener, championship week)
- When a user reports "the site looks weird on my phone"
- Once a quarter
