## Why

The event-driven menu-import migration fails before it can establish its
lineage constraints because it calls PostgreSQL's `digest` function without
resolving the schema that contains `pgcrypto`. This blocks deployments and
leaves the menu-analysis workflow unavailable even though the application code
is ready.

## What Changes

- Correct the failing, unapplied menu-import lineage migration in place before
  any deterministic idempotency-key backfill can run.
- Resolve the installed `pgcrypto` schema explicitly so the migration works
  with either local `public` placement or Supabase `extensions` placement.
- Add a migration preflight and test coverage that distinguish an unavailable
  extension from a schema-resolution error and stop before applying partial
  lineage constraints.
- Preserve deterministic, job-scoped idempotency keys for draft items, source
  evidence, and image suggestions.

## Capabilities

### New Capabilities

- `menu-import-migration-reliability`: Portable, deterministic schema setup and
  backfill behavior required before menu-import analysis lineage is enabled.

### Modified Capabilities

<!-- No existing main capability spec is modified. -->

## Impact

- Affected database: the failed event-driven menu-import migration and its
  pgcrypto dependency/backfill order; no later migration can repair an earlier
  migration that the runner cannot apply.
- Affected verification: a clean Supabase-compatible migration run and an
  assertion that all generated idempotency keys are populated deterministically.
- No browser API, upload protocol, analysis behavior, or public menu data
  changes.
