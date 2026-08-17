## 1. Correct deterministic backfills

- [ ] 1.1 Verify the failed migration version is absent from target history and
  correct `20260816200000_event_driven_menu_import_analysis.sql` in place with
  a `pgcrypto` digest-capability preflight.
- [x] 1.2 Resolve the installed `pgcrypto` schema from PostgreSQL catalog
  metadata and replace search-path-dependent digest expressions for draft
  items, source evidence, and image suggestions while retaining hash inputs.
- [x] 1.3 Preserve transactional ordering: complete the three backfills before
  enforcing non-null, uniqueness, and lineage constraints.

## 2. Verification and deployment safety

- [x] 2.1 Add migration verification for both a local `public` and
  Supabase-compatible `extensions` installation, with representative existing
  rows with null idempotency keys.
- [x] 2.2 Add a failure-path verification proving an unavailable digest
  capability aborts without partially committing schema or backfill changes;
  make its unavailable-extension fixture self-contained.
- [ ] 2.3 Run the migration verification suite and document the normal
  production re-apply procedure after the failed transactional deployment.
