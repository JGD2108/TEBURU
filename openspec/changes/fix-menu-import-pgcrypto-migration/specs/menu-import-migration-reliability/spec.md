## Purpose

Ensure that menu-import lineage migrations run reliably on Supabase and create
deterministic idempotency keys before analysis processing is enabled.

## ADDED Requirements

### Requirement: Lineage backfills resolve cryptographic functions deterministically

Before a menu-import migration backfills idempotency keys, the system MUST
verify the PostgreSQL schema where the installed `pgcrypto` extension provides
the cryptographic digest capability and MUST invoke it with an unambiguous
schema-qualified reference. The migration MUST use the same digest semantics
for draft items, source evidence, and image suggestions.

#### Scenario: Supported extension-schema installation
- **WHEN** `pgcrypto` is available in either a local `public` schema or
  Supabase's `extensions` schema and the lineage migration is applied
- **THEN** every required idempotency-key backfill completes without a
  `digest(text, unknown)` resolution error

#### Scenario: Cryptographic capability unavailable
- **WHEN** the required digest capability is not available before the backfill
- **THEN** the migration stops with a clear dependency diagnostic before it
  exposes partially established lineage constraints

#### Scenario: Earlier migration is rejected
- **WHEN** the lineage migration itself has failed and is not recorded as
  applied by the target database
- **THEN** the deployment repairs that same unapplied migration rather than
  relying on a later migration that the runner cannot reach

### Requirement: Lineage migration remains atomic and repeatable

The system MUST apply the menu-import lineage migration as one transactional
unit. A failed backfill MUST leave no partially committed idempotency-key or
foreign-key state, and a successful run MUST produce non-null deterministic
keys for all pre-existing applicable draft items, source-evidence records, and
image suggestions.

#### Scenario: Existing menu-import draft data
- **WHEN** the migration is applied to a database containing existing draft
  artifacts with null idempotency keys
- **THEN** it commits with a deterministic non-null key for each artifact and
  preserves their existing job and restaurant lineage

#### Scenario: Backfill failure
- **WHEN** any prerequisite or backfill statement fails
- **THEN** the database retains the schema state from before that migration
  transaction and can be safely corrected and re-applied
