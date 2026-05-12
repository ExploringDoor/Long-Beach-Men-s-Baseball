-- Add `pos` (position: P/C/1B/etc.) to batting_lines so the field captains
-- pick in the box score editor actually persists. Manager flagged that
-- after saving a box score and reopening, position selections were gone.
--
-- This is safe to run multiple times — the IF NOT EXISTS clause makes it a
-- no-op once the column is added.
--
-- The app feature-detects whether this column exists at runtime, so saves
-- continue to work whether you run this or not. Until you run this, the
-- position field will continue to reset to "Pos" on edit-reload like
-- before. After you run this, the chosen position round-trips correctly.

ALTER TABLE batting_lines ADD COLUMN IF NOT EXISTS pos text;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'batting_lines' AND column_name = 'pos';
-- Should print: pos | text
