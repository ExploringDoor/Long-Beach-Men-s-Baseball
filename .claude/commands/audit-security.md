---
description: Security audit — RLS policies, XSS surfaces, anon-key write scope, PII exposure
---

Run a security audit on the LBDC site. The site uses Supabase (anon-key writes from the browser, no server-side auth) and `dangerouslySetInnerHTML` in at least one place. Both are sources of risk if not bounded carefully.

## What to check

Produce a punch list under 500 words organized into these sections, with file line numbers and severity ratings.

### 1. Supabase RLS policies
For each `lbdc_*` table the site reads or writes (find them via grep `sbFetch\|sbUpsert.*"lbdc_` in `src/App.jsx`), verify:
- RLS is enabled
- Policies allow exactly the access the app needs (read-only public OR public read + public write — flag anything broader)

You can query Supabase's `pg_policies` system view via curl if needed. URL and key are in `src/App.jsx` near line 8478.

Flag any table with no RLS policy (= no access if RLS is on, OR open access if RLS is off — both bad).

### 2. dangerouslySetInnerHTML usage
Grep for `dangerouslySetInnerHTML`. For each hit, identify the source of the HTML:
- If it's an admin-edited rich-text field saved to Supabase with the public anon key, flag as HIGH — any malicious admin (or anyone with the anon key) can inject XSS that runs in every visitor's browser
- If the HTML is sanitized first (DOMPurify / sanitize-html), note the sanitizer
- If it's hardcoded source-controlled HTML, mark LOW

Severity:
- **HIGH** — admin-writable HTML rendered without sanitization
- **MED** — admin-writable plain text rendered through `dangerouslySetInnerHTML` even if it's "just text"
- **LOW** — hardcoded HTML

### 3. Anon-key write scope
The site embeds the Supabase anon key in client JS (visible to anyone who views source). Check what tables that key can write to:
- Any `lbdc_*` table (config, schedule, contact info)? Acceptable, since admins use the same key
- `games`, `batting_lines`, `pitching_lines`? Flag — fans could overwrite scores from devtools
- `availability`, `news`? Same risk

For each writable table, note whether the admin UI is the only legitimate writer. If yes, the answer is "we trust nobody messes with devtools." Document that explicitly so future-you knows the threat model.

### 4. PII exposure on public surfaces
Walk through every public page and list any:
- Phone numbers in plain text (not just `tel:` links)
- Email addresses in plain text
- Player full names + last names + photos combined (mild — sports league context, expected)

For each, decide: intended (commissioner contact info) vs leaked (player phone numbers in admin notes).

### 5. Admin gate
Find the admin login flow. Is the admin gate purely client-side (a password compared in JS)? If yes, anyone reading source can bypass it. Note the gate's strength — for a baseball league site this is usually fine (worst case someone edits a sponsor list), but call it out.

## Format

For each finding:
- File line number (or table name for RLS findings)
- Severity: HIGH / MED / LOW
- One-sentence description
- One-sentence remediation suggestion

Don't fix anything — the user picks based on their threat model.

## When to run

- Once per season at minimum
- Whenever a new public-writable table is added
- Whenever a new admin-editable rich-text field is added
