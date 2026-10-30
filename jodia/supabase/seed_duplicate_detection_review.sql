-- DENR Seed Inventory: READ-ONLY duplicate review.
-- Copy this entire file into a NEW Supabase SQL Editor query and run it first.
-- It does not change, delete, merge, or archive records.
-- A repeated species is allowed when it has distinct, genuine collection batches.

WITH active_batches AS (
  SELECT
    s.id,
    s.species_name,
    s.seedlot_no,
    s.source_location,
    s.date_collected,
    s.quantity,
    s.unit,
    lower(btrim(regexp_replace(coalesce(s.species_name, ''), '[[:space:]]+', ' ', 'g'))) AS species_key,
    lower(btrim(regexp_replace(coalesce(s.seedlot_no, ''), '[[:space:]]+', ' ', 'g'))) AS seedlot_key,
    (SELECT count(*) FROM public.requests r WHERE r.seed_id = s.id) AS linked_requests
  FROM public.seeds s
  WHERE s.is_archived = false
), reviewed AS (
  SELECT *,
    count(*) OVER (PARTITION BY species_key) AS same_species_records,
    count(*) OVER (PARTITION BY species_key, seedlot_key) AS same_batch_records
  FROM active_batches
)
SELECT
  id,
  species_name,
  seedlot_no,
  source_location,
  date_collected,
  quantity,
  unit,
  linked_requests,
  same_species_records,
  same_batch_records,
  CASE
    WHEN same_batch_records > 1 THEN 'REVIEW REQUIRED: same species and seedlot (including missing seedlots).'
    WHEN seedlot_key = '' THEN 'Seedlot not recorded: verify the collection batch.'
    ELSE 'Different seedlot: verify that this is a genuine separate collection batch.'
  END AS review_note
FROM reviewed
WHERE same_species_records > 1
ORDER BY species_key, seedlot_key, id;
