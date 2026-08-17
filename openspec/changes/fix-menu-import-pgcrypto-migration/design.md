## Context

The initial schema enables `pgcrypto` without pinning its schema, while the
event-driven lineage migration uses unqualified `digest(...)` calls to populate
three idempotency-key columns. On the affected Supabase project, the function
is not visible through the migration session's default search path, producing
SQLSTATE `42883` before the constraints can be created. Because that failing
file is itself unapplied, a later migration cannot execute to fix it.

## Goals / Non-Goals

**Goals:**

- Make the failed, unapplied migration independent of the session `search_path`
  and of whether `pgcrypto` is installed in `public` or `extensions`.
- Preserve the same stable idempotency-key values for equivalent existing rows.
- Fail before any partial lineage schema becomes observable if the extension
  dependency cannot be resolved.

**Non-Goals:**

- Changing menu-import jobs, webhook orchestration, upload, or PDF analysis.
- Recomputing keys for rows that already have an idempotency key.
- Moving, dropping, or reinstalling an existing extension from an unknown
  schema.

## Decisions

### 1. Repair the failing migration in place

The implementation will correct
`20260816200000_event_driven_menu_import_analysis.sql`, the migration that is
currently failing and unrecorded. Before deployment, operators verify that its
version is absent from the target migration history. A later corrective file is
not viable because the runner stops at this failing predecessor.

Changing a migration that has already been recorded in a target is out of scope:
that target has already completed the backfill and must not be repaired by
silently mutating migration history.

### 2. Resolve the installed extension schema from catalog metadata

The migration will determine the schema of the installed `pgcrypto` extension
from PostgreSQL catalog metadata, verify the required digest overload exists,
and execute each backfill through that schema-qualified function. It will not
hard-code `extensions.digest`, because the local predecessor can install
`pgcrypto` in `public`, and it will not rely on unqualified lookup through the
session search path.

Changing the database-wide `search_path` was rejected because it is hidden
session state that can affect unrelated migrations. Moving an already installed
extension was rejected because it risks breaking existing objects in an
environment whose extension ownership is not known.

### 3. Guard the backfill before constraints

The migration will run an explicit extension/function preflight before its
first hash expression, then perform all three backfills before making the
columns non-null or adding uniqueness/lineage constraints. Existing non-null
keys remain unchanged using `COALESCE`.

The preflight produces a bounded diagnostic identifying the missing extension
capability. This is preferable to the raw operator-resolution error because it
gives deployment operators a direct configuration action.

### 4. Verify on a transactionally clean database state

Tests will cover both public and Supabase-compatible extension-schema
installations and existing draft rows. Verification will assert the migration
succeeds, the generated keys are non-null/deterministic, and a forced
preflight failure rolls back the entire migration state.

## Risks / Trade-offs

- **[Extension schema differs across environments]** → Catalog resolution and
  preflight select the installed schema or report the exact unavailable
  capability; operators do not receive a misleading data-constraint error.
- **[A prior failed deployment is retried]** → PostgreSQL migration transaction
  rollback keeps the failed migration unapplied; correct that same file and
  apply it through normal migration history rather than adding an unreachable
  successor or manually marking the version as applied.
- **[A target already recorded the migration]** → Check migration history before
  deploying; do not rewrite deployed history, because a recorded target has
  already completed this migration.
- **[Hash input normalization changes keys]** → Retain the existing
  `concat_ws` field order and null handling; only function resolution changes.

## Migration Plan

1. Verify that `20260816200000_event_driven_menu_import_analysis.sql` is absent
   from the target migration history, then repair that failing source migration
   in place to preflight `pgcrypto` and resolve its installed schema.
2. Apply the corrected migration to a clean local/Supabase-compatible database
   fixture containing representative existing draft artifacts.
3. Apply the corrected migration to the production project through the normal
   migration workflow; confirm all three key columns are non-null before
   enabling or retrying event-driven analysis.
4. If deployment fails, leave the prior schema untouched by relying on the
   migration transaction, correct the source migration or extension
   prerequisite, and rerun the deployment; do not manually mark the failed
   migration as applied.
