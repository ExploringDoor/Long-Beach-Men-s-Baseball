---
description: Empty / loading / error state audit — find async fetches that render blank or weird when data is missing
---

Run an empty-state audit on `/Users/AdamMiller/Desktop/Long-Beach-Men-s-Baseball/src/App.jsx`.

The point: every async data fetch has THREE failure modes that look identical to the user — loading, empty, error. If a component doesn't handle each one explicitly, the user sees a blank page or a half-rendered card and assumes the site is broken.

## What to check

Find every `sbFetch` and `useEffect` that loads data. For each, walk the rendering path and verify:

### 1. Loading state
While the fetch is in flight, what does the user see?
- Skeleton placeholder ✓
- Spinner ✓
- "Loading..." text ✓
- Nothing — blank space ✗ (user thinks the section is broken or empty)
- Stale previous-page data ✗ (user thinks site is wrong)

Flag components that render nothing (or stale data) during initial load.

### 2. Empty state
After fetch returns successfully but with zero rows:
- Friendly empty message like "No upcoming games" ✓
- A call-to-action like "Check back after opening day" ✓
- Hidden section (the whole block disappears) — usually fine
- A broken-looking partial render (a card frame with nothing inside, an empty table with headers only) ✗

Flag components that render a degenerate UI for empty data.

### 3. Error state
If the fetch fails (network error, 500, RLS denial, etc.):
- Error toast/banner ✓
- Inline error message ✓
- Falls back to hardcoded data + console.warn ✓ (this is the LBDC pattern for admin-editable constants)
- Renders nothing or stale ✗
- Breaks downstream code (component throws because data is unexpected shape) ✗

Flag fetches whose failure leaves the user in the dark.

## Format the report

Group by component. For each component with at least one issue:

**ComponentName** (line X)
- Loading: [issue or ✓]
- Empty: [issue or ✓]
- Error: [issue or ✓]

Severity:
- **HIGH** — the user sees what looks like a broken page
- **MED** — the user sees something confusing but functional
- **LOW** — minor polish

Don't fix anything — produce the punch list. Under 500 words.

## When to run

- Once per major release
- After adding a new fetched data source
- When a user reports "the page is blank" or "the standings disappeared"
