-- DENR Seed Inventory: database protection against duplicate active seed batches.
-- Run seed_duplicate_detection_review.sql FIRST and review any flagged records.
-- Then copy this ENTIRE file into a NEW Supabase SQL Editor query and run it.
-- If duplicate species + seedlot keys remain, this script STOPS without changes.
-- It NEVER deletes, merges, renames, or assigns made-up seedlot numbers.
-- Existing tables/columns must already exist. Do NOT rerun full_setup_with_admin.sql.

BEGIN;

-- Fail safely instead of holding up the live inventory for a long time.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.seeds IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.seeds
    WHERE is_archived = false
    GROUP BY
      lower(btrim(regexp_replace(coalesce(species_name, ''), '[[:space:]]+', ' ', 'g'))),
      lower(btrim(regexp_replace(coalesce(seedlot_no, ''), '[[:space:]]+', ' ', 'g')))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate active seed batches need review. No records have been changed.'
      USING HINT = 'Run seed_duplicate_detection_review.sql. Verify the original collection records and correct the actual Seedlot No. through Admin > Seeds > Edit. Do not invent batch numbers, delete records, or combine stock automatically.';
  END IF;
END;
$$;

-- Case and whitespace differences do not create a new species or batch.
-- NULL, empty, and whitespace-only seedlot labels are the same unnamed batch.
-- Different real seedlot numbers for the same species remain allowed.
-- Archived records stay untouched and are excluded from active uniqueness.
-- The unique index also protects simultaneous saves by different administrators.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seeds_active_species_seedlot_unique
ON public.seeds (
  lower(btrim(regexp_replace(coalesce(species_name, ''), '[[:space:]]+', ' ', 'g'))),
  lower(btrim(regexp_replace(coalesce(seedlot_no, ''), '[[:space:]]+', ' ', 'g')))
)
WHERE is_archived = false;

COMMIT;

-- Read-only confirmation. Expect database_duplicate_protection_enabled = true.
SELECT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_seeds_active_species_seedlot_unique'
    AND i.indrelid = 'public.seeds'::regclass
    AND i.indisunique
    AND i.indisvalid
) AS database_duplicate_protection_enabled;
