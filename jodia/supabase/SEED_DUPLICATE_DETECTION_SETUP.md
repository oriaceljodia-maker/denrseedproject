# Seed duplicate detection

This update does not require new tables, login pages, or authentication changes.
It does not automatically modify existing seeds, requests, stock, or audit trails.

## What the application does

- Add Seed and Edit Seed warn about matching active species, ignoring case and repeated whitespace.
- The warning shows the existing Seedlot No., source, and collection date when recorded.
- Another record for the same species must have its actual, distinct Seedlot No.
- The same active species and seedlot cannot be saved twice through these forms.
- The record being edited is excluded from its own duplicate check.
- The inventory list shows Seedlot No. and supports searching by seedlot.
- Failed validation keeps the form open, so the administrator does not lose their input.
- This matches recorded common names, not botanical aliases or spelling mistakes.

## Safe deployment order

1. Commit/push the application changes when ready and wait for the production Netlify deployment to finish. This does NOT run SQL automatically.
2. In Supabase SQL Editor, open a new query, paste all of `seed_duplicate_detection_review.sql`, and run it. It is read-only.
3. Review flagged records against the real collection records. Use Admin > Seeds > Edit to enter correct batch details where needed. Never invent a Seedlot No. simply to make the warning disappear.
4. If two entries are actually the same batch, stop and decide how to reconcile them after checking stock and linked requests. This update does not delete, merge, or automatically archive them.
5. After the exact duplicate batches have been resolved, open another new SQL query, paste all of `seed_duplicate_detection.sql`, and run it once. Do not rerun the full database setup or unrelated SQL files.
6. The final result should show `database_duplicate_protection_enabled = true`. If the script reports unresolved duplicates, no protection was installed by that failed run: review the records and retry the entire file. If it reports a lock timeout, retry during a quieter period.

## Existing records that need attention

The read-only live review on October 31, 2026 found two active `White nato` records with missing Seedlot Numbers. They may be separate batches, but the missing labels must be investigated. Their names alone are not a reason to delete either record. The install script deliberately stops while both still share the same blank batch label.

## Database rule

The separate SQL file adds one unique index for active records on normalized common name plus normalized Seedlot No. Blank and missing seedlots compare equally. It protects inserts, identity edits, and reactivation against duplicate batch keys, including simultaneous saves.

Different identified batches remain allowed. A single legacy record without a seedlot may remain, but the application requires an actual Seedlot No. when adding another record for that species. Archived records are excluded. Existing history and RLS policies are unchanged.

The form warnings work before SQL installation, but only the database index guarantees batch-key uniqueness against simultaneous saves or writes outside the application.

## Research instrument wording

Duplicate Seed Detection - The system identifies possible duplicate seed records and warns the administrator before saving. Separate records are allowed for clearly identified collection batches.

Do not mark the feature Passed based only on this code update. Confirm the deployed behavior and the installed database rule first.

## References

- [PostgreSQL unique indexes](https://www.postgresql.org/docs/17/indexes-unique.html)
- [PostgreSQL indexes on expressions](https://www.postgresql.org/docs/17/indexes-expressional.html)
- [PostgreSQL partial indexes](https://www.postgresql.org/docs/17/indexes-partial.html)
