---
description: Persistence + error-handling audit — find every silent .catch and missing-validation save path
---

Run a save-path audit on `src/App.jsx`. The goal: catch the "It's not saving!" / "I clicked Save and nothing happened" class of bug.

This audit was prompted by a real user complaint earlier: admin made a venue change, hit save, and it appeared to do nothing — turned out the home page wasn't reading the saved data. But other "silent failures" exist where the SAVE itself fails and the user has no idea.

## What to check

Produce a punch list under 500 words organized into these sections, with file line numbers:

### 1. Silent .catch swallowers
Find every `.catch(()=>{})` or `.catch(() => {})` in the file. For each, identify:
- What operation it's swallowing (sbUpsert, sbFetch, sbPatch, sbDelete?)
- If the operation is a SAVE (write to DB), this is a real bug — the user should see an error toast/banner
- If the operation is a READ that has a fallback, it's OK to swallow but should log to console.warn at minimum

Flag every save-path silent catch as HIGH PRIORITY.

### 2. Missing required-field validation
Find every form / admin editor with a save button. For each, check:
- Are required fields enforced before the save fires? (look for guards like `if(!field) return`)
- Are numeric fields parsed as numbers (not strings)?
- Are URL fields validated for protocol (`http://` or `https://`)?
- Are date fields validated as parseable?

Flag forms where the save button fires unconditionally — those will write garbage data.

### 3. Optimistic UI without rollback
Find places where local state is updated BEFORE the save completes (the optimistic pattern: `setState(newValue); await sbUpsert(...)`). For each:
- If the sbUpsert fails (catch fires), is the local state rolled back?
- If not, the user sees their edit "succeed" in the UI but the next page load shows the OLD value — confusing.

Flag any optimistic update missing rollback.

### 4. PATCH-vs-UPSERT scope
Find every `sbPatch(...)` call. Check:
- Does it patch ONLY the fields being edited? Good.
- Does it patch fields it shouldn't (clearing values that should be preserved)? Bad.

Specifically watch for save flows that clear `headline`, `notes`, `status`, or stat lines as a side effect of editing something else.

### 5. Save success feedback
For every save button, verify one of these is present:
- A success toast/banner ("Saved!")
- A button-state change (Save → Saving... → Saved ✓)
- An auto-redirect to a confirmation view

Flag save buttons that show NO feedback on success — the user can't tell if it worked.

### 6. Race conditions
Find places where two saves can fire concurrently (e.g. user clicks Save twice quickly, or two admin tabs are open). Check:
- Is the save button disabled during in-flight requests?
- Could the second save overwrite the first?

Flag any save without a `disabled={saving}` guard.

### 7. Schema assumptions
For every `sbUpsert`, verify the table's schema is documented or the upsert is idempotent. Specifically, check that the table exists in Supabase (the user has to create `lbdc_*` tables manually — list any saves that target tables you can't confirm exist).

## Format

Group findings by section. For each finding give:
- File line number(s)
- One-sentence description of the risk
- Severity: HIGH (silent save failure), MED (missing UX feedback), LOW (defensive nit)

Don't fix anything. The user picks.

## When to run

- After adding a new admin editor
- When a user reports "I saved and it didn't work"
- Once a quarter as a baseline
