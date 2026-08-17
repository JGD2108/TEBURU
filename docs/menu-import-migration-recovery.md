# Menu-import pgcrypto migration recovery

`20260816200000_event_driven_menu_import_analysis.sql` must be repaired and
re-applied only when the failed migration is absent from the target migration
history. A failed PostgreSQL migration transaction is not recorded as applied,
so do not mark the version as applied manually and do not add a later
corrective migration that the runner cannot reach.

Before deploying, use `supabase migration list` (or the target's migration
history) to verify that version `20260816200000` is not applied. Confirm that
the target has `pgcrypto` installed and that it exposes `digest(text, text)`;
the extension may be in either `public`, Supabase's `extensions`, or another
installed schema.

Apply the corrected source migration through the normal `supabase db push`
workflow. If it fails, let the transaction roll back, correct the extension
prerequisite or source migration, and rerun the same version. Do not modify
the history of an environment where this version is already recorded.

After a successful apply, verify that the three lineage backfills completed:

```sql
SELECT
  (SELECT count(*) FROM menu_import_draft_items WHERE idempotency_key IS NULL) AS draft_items_missing_keys,
  (SELECT count(*) FROM menu_import_source_evidence WHERE idempotency_key IS NULL) AS evidence_missing_keys,
  (SELECT count(*) FROM menu_import_image_suggestions WHERE idempotency_key IS NULL) AS image_suggestions_missing_keys;
```

Each count must be zero before enabling or retrying event-driven menu analysis.
