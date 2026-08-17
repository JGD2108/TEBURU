# Graph Report - teburuapp  (2026-08-16)

## Corpus Check
- 190 files · ~86,187 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 962 nodes · 1645 edges · 109 communities (76 shown, 33 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a00dfda8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- isLocalDemo
- ADDED Requirements
- dependencies
- compilerOptions
- devDependencies
- What You Must Do When Invoked
- activate/route.ts
- schema.sql
- orders
- eslint.config.mjs
- migrate.js
- update_legacy_staff.js
- add_access_code.js
- add_email_staff.js
- add_password_hash.js
- add_waiter_fields.js
- verify-migrations.mjs
- migrate_ingredients.js
- migrate_settings.js
- migrate_staff.js
- reset_mfa.js
- seed_menu.js
- guest_access_tokens
- database.types.ts
- ADDED Requirements
- graphify reference: extra exports and benchmark
- graphify reference: query, path, explain
- Teburu (テーブル) Restaurant OS
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- Subagents for OpenSpec changes
- extraction-spec.md
- guest-session.ts
- 202608050000_initial_schema.sql
- order_items
- worker.ts
- Operación de Teburu
- layout.tsx
- 202608060300_rls_and_browser_lockdown.sql
- restaurant-flow.spec.ts
- ADDED Requirements
- vercel.json
- verify-remote-security.mjs
- isAuthorizationFailure
- openspec-explore/SKILL.md
- Decisions
- session_tables
- proposal.md
- menu_import_jobs
- menu_categories
- menu_items
- order_items
- orders
- tables
- tasks.md
- admin/page.tsx
- KitchenPanel.tsx
- MenuImportPanel.tsx
- ADDED Requirements
- harden-menu-import-deployment/design.md
- scripts
- api-client.ts
- harden-menu-import-deployment/proposal.md
- ADDED Requirements
- harden-menu-import-deployment/tasks.md
- package.json
- fix-menu-import-upload-finalize/proposal.md
- fix-menu-import-upload-finalize/design.md
- fix-menu-import-upload-finalize/tasks.md
- auth.ts
- Decisions
- supabase.ts
- Decisions
- event-driven-menu-import-analysis/proposal.md
- orchestrate-menu-import-analysis/proposal.md
- orchestrate-menu-import-analysis/tasks.md
- event-driven-menu-import-analysis/tasks.md
- images/route.ts
- error-context.md
- verify-menu-import-pgcrypto-migration.mjs
- fix-menu-import-pgcrypto-migration/design.md
- db.ts
- staff/route.ts
- restaurants/route.ts
- bulk/route.ts
- update/route.ts
- index.ts
- menu-import-analysis.md
- deliver/route.ts
- Requirement: Lineage backfills resolve cryptographic functions deterministically
- fix-menu-import-pgcrypto-migration/proposal.md
- menu-import-analysis/route.test.ts
- fix-menu-import-pgcrypto-migration/tasks.md
- menu-import-migration-recovery.md
- @supabase/supabase-js

## God Nodes (most connected - your core abstractions)
1. `isAuthorizationFailure()` - 83 edges
2. `requireRole()` - 75 edges
3. `query()` - 68 edges
4. `getPoolClient()` - 40 edges
5. `staffFetch()` - 25 edges
6. `jsonSuccess()` - 24 edges
7. `jsonError()` - 23 edges
8. `jsonAuthorizationError()` - 18 edges
9. `compilerOptions` - 16 edges
10. `requireGuestSession()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `TablesManagerPanel()` --references--> `jspdf`  [EXTRACTED]
  src/components/admin/TablesManagerPanel.tsx → package.json
- `AdminDashboard()` --calls--> `isLocalDemo()`  [EXTRACTED]
  src/app/admin/page.tsx → src/lib/demo.ts
- `POST()` --calls--> `getPoolClient()`  [EXTRACTED]
  src/app/api/admin/menu-import/[id]/publish/route.ts → src/lib/db.ts
- `POST()` --calls--> `getPoolClient()`  [EXTRACTED]
  src/app/api/admin/menu-import/finalize/route.ts → src/lib/db.ts
- `POST()` --calls--> `isAuthorizationFailure()`  [EXTRACTED]
  src/app/api/admin/menu/images/route.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (109 total, 33 thin omitted)

### Community 0 - "isLocalDemo"
Cohesion: 0.17
Nodes (15): accessDestination(), AdminLogin(), AuthStep, AdminDashboard(), emptyForm, PlatformPage(), Restaurant, CartItem (+7 more)

### Community 1 - "ADDED Requirements"
Cohesion: 0.08
Nodes (24): ADDED Requirements, Purpose, Requirement: Admin status polling reflects terminal outcomes, Requirement: Analysis failures are observable and safe, Requirement: Finalized imports are eventually processed, Requirement: Internal processing is authenticated and bounded, Requirement: Job claims are exclusive and recoverable, Requirement: Retries terminate deterministically (+16 more)

### Community 2 - "dependencies"
Cohesion: 0.11
Nodes (19): html2canvas, jspdf, lucide-react, next, dependencies, html2canvas, jspdf, lucide-react (+11 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, supabase/functions (+20 more)

### Community 4 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, @playwright/test, @types/node, @types/pg (+11 more)

### Community 5 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "activate/route.ts"
Cohesion: 0.25
Nodes (9): messages, POST(), { requireRole, getPoolClient, activateTables, client }, POST(), activateTables(), newAccessCode(), normalizeTableIds(), TableActivationError (+1 more)

### Community 7 - "schema.sql"
Cohesion: 0.50
Nodes (7): menu_categories, menu_items, order_items, orders, session_users, sessions, tables

### Community 10 - "migrate.js"
Cohesion: 0.40
Nodes (3): { Client }, fs, path

### Community 16 - "verify-migrations.mjs"
Cohesion: 0.50
Nodes (3): client, migrationsDir, root

### Community 22 - "guest_access_tokens"
Cohesion: 0.50
Nodes (3): guest_access_tokens, session_users, sessions

### Community 23 - "database.types.ts"
Cohesion: 0.22
Nodes (8): BillSplit, BillSplitParticipant, BillSplitStatus, Database, Json, Restaurant, RestaurantMembership, RestaurantStatus

### Community 25 - "ADDED Requirements"
Cohesion: 0.09
Nodes (21): ADDED Requirements, Purpose, Requirement: Analysis completion is atomic and reviewable, Requirement: Analysis executions are identifiable and idempotent, Requirement: Every detected menu element has execution lineage, Requirement: Execution ownership and retries are durable, Requirement: Finalized PDF insertion starts one analysis execution, Requirement: Processing is independent of Vercel hosting (+13 more)

### Community 26 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 27 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 28 - "Teburu (テーブル) Restaurant OS"
Cohesion: 0.33
Nodes (5): Ejecución en Desarrollo, Funcionalidades, Recorrido visual local (sin Vercel ni Supabase), Requisitos de Configuración, Teburu (テーブル) Restaurant OS

### Community 29 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 30 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 31 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 34 - "Subagents for OpenSpec changes"
Cohesion: 0.29
Nodes (6): Available subagents, graphify, Subagents for OpenSpec changes, This is NOT the Next.js you know, Using subagents with `openspec apply`, When to spawn each subagent

### Community 37 - "guest-session.ts"
Cohesion: 0.15
Nodes (21): POST(), POST(), GET(), GET(), POST(), POST(), GET(), GET() (+13 more)

### Community 39 - "202608050000_initial_schema.sql"
Cohesion: 0.13
Nodes (22): snapshot_order_item_stations, menu_categories, menu_items, order_items, orders, restaurant_settings, session_users, sessions (+14 more)

### Community 41 - "worker.ts"
Cohesion: 0.07
Nodes (35): analyzePdf(), confidence(), configuredOcr(), createPdfAnalysisProvider(), parseMenuText(), AnalysisResult, Confidence, ExtractedImage (+27 more)

### Community 42 - "Operación de Teburu"
Cohesion: 0.29
Nodes (6): Ambientes, Backup y restauración, Despliegue y rollback, Operación de Teburu, Respuesta a fallos, Salud, logs y alertas

### Community 46 - "ADDED Requirements"
Cohesion: 0.10
Nodes (19): ADDED Requirements, Purpose, Requirement: Controlled publication to the restaurant menu, Requirement: Menu structure extraction, Requirement: Restaurant-scoped PDF import submission, Requirement: Review before live-menu publication, Requirement: Source visual preservation and image suggestions, Scenario: Administrator appends an approved draft (+11 more)

### Community 49 - "isAuthorizationFailure"
Cohesion: 0.07
Nodes (78): POST(), { requireRole, query }, Authorization, POST(), StorageObjectInfo, validateStoredPdf(), verifyAuthorizedUpload(), DELETE() (+70 more)

### Community 52 - "openspec-explore/SKILL.md"
Cohesion: 0.18
Nodes (10): Check for context, Ending Discovery, Guardrails, Handling Different Entry Points, OpenSpec Awareness, The Stance, What You Don't Have To Do, What You Might Do (+2 more)

### Community 53 - "Decisions"
Cohesion: 0.18
Nodes (10): Context, Decisions, Goals / Non-Goals, Migration Plan, Publish approved entries atomically without replacing the live menu, Risks / Trade-offs, Separate document ingestion from analysis execution, Treat the original PDF as canonical visual evidence (+2 more)

### Community 54 - "session_tables"
Cohesion: 0.50
Nodes (3): session_tables, sessions, tables

### Community 56 - "proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 57 - "menu_import_jobs"
Cohesion: 0.19
Nodes (14): bill_split_participants, bill_splits, platform_admins, restaurants, session_users, sessions, menu_import_draft_categories, menu_import_draft_items (+6 more)

### Community 63 - "tasks.md"
Cohesion: 0.40
Nodes (4): 1. Import foundation and storage, 2. Document analysis pipeline, 3. Draft review experience, 4. Publication and verification

### Community 64 - "admin/page.tsx"
Cohesion: 0.15
Nodes (16): HistoryPanel(), MenuPanel(), OverviewPanel(), SettingsPanel(), StaffPanel(), Draft, MenuItem, Station (+8 more)

### Community 70 - "KitchenPanel.tsx"
Cohesion: 0.18
Nodes (10): ConnectionState, KitchenItem, KitchenPanel(), KitchenStatus, lanes, nextPriority, Priority, priorityLabels (+2 more)

### Community 71 - "MenuImportPanel.tsx"
Cohesion: 0.13
Nodes (17): AnalysisRun, CompletedUpload, DraftCategory, DraftItem, DraftItemCard(), Evidence, fieldProblems(), ImportJob (+9 more)

### Community 72 - "ADDED Requirements"
Cohesion: 0.17
Nodes (11): ADDED Requirements, Purpose, Requirement: Configuration readiness reporting, Requirement: Deployment-safe document submission, Requirement: Predictable API outcome contract, Scenario: Administrator submits a PDF larger than the application request-body limit, Scenario: Configuration is valid, Scenario: Import request fails during processing setup (+3 more)

### Community 73 - "harden-menu-import-deployment/design.md"
Cohesion: 0.20
Nodes (9): Context, Decisions, Goals / Non-Goals, Instrument the upload-to-job handoff, Make public settings a readiness contract, Migration Plan, Risks / Trade-offs, Standardize application errors and defensively consume intermediary responses (+1 more)

### Community 74 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, lint, start, test, test:e2e, test:integration (+2 more)

### Community 75 - "api-client.ts"
Cohesion: 0.26
Nodes (7): ApiClientError, ApiErrorBody, isJsonResponse(), readApiResponse(), { getSession, signOut }, IMPORT_UPLOAD_INCOMPLETE, uploadRecoveryMessage()

### Community 76 - "harden-menu-import-deployment/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 77 - "ADDED Requirements"
Cohesion: 0.18
Nodes (10): ADDED Requirements, Purpose, Requirement: finalize only accepts a visible uploaded PDF, Requirement: finalize preserves authorization boundaries, Requirement: incomplete uploads are diagnosable, Scenario: authorization is reused after a successful finalize, Scenario: storage object has the wrong attributes, Scenario: storage object is not yet visible (+2 more)

### Community 78 - "harden-menu-import-deployment/tasks.md"
Cohesion: 0.50
Nodes (3): 1. API and configuration reliability, 2. Direct document upload flow, 3. Diagnostics and verification

### Community 79 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 80 - "fix-menu-import-upload-finalize/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 81 - "fix-menu-import-upload-finalize/design.md"
Cohesion: 0.33
Nodes (5): Context, Decisions, Goals / Non-Goals, Migration Plan, Risks / Trade-offs

### Community 82 - "fix-menu-import-upload-finalize/tasks.md"
Cohesion: 0.50
Nodes (3): 1. Finalize contract, 2. UI recovery, 3. Verification

### Community 83 - "auth.ts"
Cohesion: 0.26
Nodes (9): AccessRow, GET(), { requireAuthenticatedUser, query }, GET(), authClient(), requireAuthenticatedUser(), requireStaff(), StaffRole (+1 more)

### Community 84 - "Decisions"
Cohesion: 0.17
Nodes (11): 1. Supabase Database Webhook is the start signal, 2. Separate import identity from attempt identity, 3. Use source fingerprinting for safe re-analysis detection, 4. Enforce lineage in the database, not only in application code, 5. Keep the worker portable and bounded, 6. Recovery is explicit and observable, Context, Decisions (+3 more)

### Community 85 - "supabase.ts"
Cohesion: 0.36
Nodes (4): MenuRow, OnboardingPage(), parseMenu(), supabase

### Community 86 - "Decisions"
Cohesion: 0.18
Nodes (10): 1. Use a protected internal route invoked by Vercel Cron, 2. Extend the existing job row with lease and retry metadata, 3. Separate source reading, analysis, and persistence, 4. Keep the API envelope and admin polling contract stable, 5. Test the worker as a state machine, Context, Decisions, Goals / Non-Goals (+2 more)

### Community 87 - "event-driven-menu-import-analysis/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 88 - "orchestrate-menu-import-analysis/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 89 - "orchestrate-menu-import-analysis/tasks.md"
Cohesion: 0.29
Nodes (6): 1. Queue schema and storage boundaries, 2. Durable worker state machine, 3. Internal trigger and deployment configuration, 4. Admin status experience, 5. Automated verification, 6. Migration and operational validation

### Community 90 - "event-driven-menu-import-analysis/tasks.md"
Cohesion: 0.33
Nodes (5): 1. Execution identity and lineage schema, 2. Supabase event trigger and secure consumer, 3. Analysis, reuse, and durable state machine, 4. Retry and operator controls, 5. Verification and lineage proof

### Community 91 - "images/route.ts"
Cohesion: 0.38
Nodes (4): extensions, POST(), storageAdmin(), { requireRole, createClient, getBucket, createBucket, updateBucket, upload, getPublicUrl }

### Community 92 - "error-context.md"
Cohesion: 0.40
Nodes (4): Error details, Instructions, Test info, Test source

### Community 93 - "verify-menu-import-pgcrypto-migration.mjs"
Cohesion: 0.20
Nodes (7): applyAndAssertBackfill(), assertFailureRollsBack(), client, migrationsDir, placePgcryptoIn(), root, sha256()

### Community 94 - "fix-menu-import-pgcrypto-migration/design.md"
Cohesion: 0.20
Nodes (9): 1. Repair the failing migration in place, 2. Resolve the installed extension schema from catalog metadata, 3. Guard the backfill before constraints, 4. Verify on a transactionally clean database state, Context, Decisions, Goals / Non-Goals, Migration Plan (+1 more)

### Community 95 - "db.ts"
Cohesion: 0.21
Nodes (9): POST(), POST(), ImportedItem, POST(), POST(), { getPoolClient, requireRole, client }, getPoolClient(), isSupabase (+1 more)

### Community 96 - "staff/route.ts"
Cohesion: 0.36
Nodes (5): adminClient(), DELETE(), POST(), { query, requireRole, createUser, deleteUser }, staffRoles

### Community 97 - "restaurants/route.ts"
Cohesion: 0.43
Nodes (6): PATCH(), authAdmin(), GET(), POST(), slugify(), requirePlatformAdmin()

### Community 98 - "bulk/route.ts"
Cohesion: 0.33
Nodes (4): BulkItem, POST(), { getPoolClient, requireRole, client }, transitions

### Community 99 - "update/route.ts"
Cohesion: 0.33
Nodes (4): nextStatuses, POST(), priorities, { getPoolClient, requireRole, client }

### Community 103 - "Requirement: Lineage backfills resolve cryptographic functions deterministically"
Cohesion: 0.20
Nodes (9): ADDED Requirements, Purpose, Requirement: Lineage backfills resolve cryptographic functions deterministically, Requirement: Lineage migration remains atomic and repeatable, Scenario: Backfill failure, Scenario: Cryptographic capability unavailable, Scenario: Earlier migration is rejected, Scenario: Existing menu-import draft data (+1 more)

### Community 104 - "fix-menu-import-pgcrypto-migration/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

## Knowledge Gaps
- **409 isolated node(s):** `required`, `missing`, `eslintConfig`, `name`, `version` (+404 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getPoolClient()` connect `db.ts` to `staff/route.ts`, `restaurants/route.ts`, `bulk/route.ts`, `update/route.ts`, `guest-session.ts`, `deliver/route.ts`, `activate/route.ts`, `worker.ts`, `isAuthorizationFailure`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `@supabase/supabase-js`, `package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `jspdf` connect `dependencies` to `admin/page.tsx`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `required`, `missing`, `eslintConfig` to the rest of the system?**
  _409 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ADDED Requirements` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._