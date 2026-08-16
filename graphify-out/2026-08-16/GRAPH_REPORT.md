# Graph Report - teburuapp  (2026-08-16)

## Corpus Check
- 151 files · ~66,036 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 675 nodes · 1164 edges · 72 communities (46 shown, 26 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c960987`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admin/page.tsx
- isAuthorizationFailure
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
- images/route.ts
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
- menu-import.ts
- openspec-explore/SKILL.md
- Decisions
- session_tables
- proposal.md
- menu_import_draft_items
- menu_categories
- menu_items
- order_items
- orders
- tables
- tasks.md
- guest-sessions/route.ts
- health/route.ts
- bulk/route.ts

## God Nodes (most connected - your core abstractions)
1. `isAuthorizationFailure()` - 77 edges
2. `requireRole()` - 69 edges
3. `query()` - 65 edges
4. `getPoolClient()` - 35 edges
5. `staffFetch()` - 25 edges
6. `compilerOptions` - 16 edges
7. `requireGuestSession()` - 15 edges
8. `isGuestFailure()` - 14 edges
9. `isLocalDemo()` - 13 edges
10. `What You Must Do When Invoked` - 12 edges

## Surprising Connections (you probably didn't know these)
- `TablesManagerPanel()` --references--> `jspdf`  [EXTRACTED]
  src/components/admin/TablesManagerPanel.tsx → package.json
- `GET()` --calls--> `query()`  [EXTRACTED]
  src/app/api/health/route.ts → src/lib/db.ts
- `AdminDashboard()` --calls--> `isLocalDemo()`  [EXTRACTED]
  src/app/admin/page.tsx → src/lib/demo.ts
- `POST()` --calls--> `isAuthorizationFailure()`  [EXTRACTED]
  src/app/api/admin/menu/images/route.ts → src/lib/auth.ts
- `POST()` --calls--> `requireRole()`  [EXTRACTED]
  src/app/api/admin/menu/images/route.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (72 total, 26 thin omitted)

### Community 0 - "admin/page.tsx"
Cohesion: 0.05
Nodes (56): accessDestination(), AdminLogin(), AuthStep, AdminDashboard(), MenuRow, OnboardingPage(), parseMenu(), emptyForm (+48 more)

### Community 1 - "isAuthorizationFailure"
Cohesion: 0.05
Nodes (78): POST(), { requireRole, query }, DELETE(), PATCH(), POST(), GET(), GET(), GET() (+70 more)

### Community 2 - "dependencies"
Cohesion: 0.10
Nodes (21): html2canvas, jspdf, lucide-react, next, dependencies, html2canvas, jspdf, lucide-react (+13 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 4 - "devDependencies"
Cohesion: 0.06
Nodes (31): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, @playwright/test, @types/node, @types/pg (+23 more)

### Community 5 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "activate/route.ts"
Cohesion: 0.23
Nodes (10): messages, POST(), { requireRole, getPoolClient, activateTables, client }, POST(), StaffSession, activateTables(), newAccessCode(), normalizeTableIds() (+2 more)

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

### Community 25 - "images/route.ts"
Cohesion: 0.38
Nodes (4): extensions, POST(), storageAdmin(), { requireRole, createClient, getBucket, createBucket, updateBucket, upload, getPublicUrl }

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
Cohesion: 0.12
Nodes (21): analyzePdf(), confidence(), configuredOcr(), createPdfAnalysisProvider(), parseMenuText(), AnalysisResult, Confidence, ExtractedImage (+13 more)

### Community 42 - "Operación de Teburu"
Cohesion: 0.29
Nodes (6): Ambientes, Backup y restauración, Despliegue y rollback, Operación de Teburu, Respuesta a fallos, Salud, logs y alertas

### Community 46 - "ADDED Requirements"
Cohesion: 0.10
Nodes (19): ADDED Requirements, Purpose, Requirement: Controlled publication to the restaurant menu, Requirement: Menu structure extraction, Requirement: Restaurant-scoped PDF import submission, Requirement: Review before live-menu publication, Requirement: Source visual preservation and image suggestions, Scenario: Administrator appends an approved draft (+11 more)

### Community 49 - "menu-import.ts"
Cohesion: 0.33
Nodes (5): DraftReviewStatus, draftReviewStatuses, PDF_MENU_MAX_BYTES, PdfMenuImportStatus, pdfMenuImportStatuses

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

### Community 57 - "menu_import_draft_items"
Cohesion: 0.29
Nodes (12): bill_split_participants, bill_splits, platform_admins, restaurants, session_users, sessions, menu_import_draft_categories, menu_import_draft_items (+4 more)

### Community 63 - "tasks.md"
Cohesion: 0.40
Nodes (4): 1. Import foundation and storage, 2. Document analysis pipeline, 3. Draft review experience, 4. Publication and verification

### Community 64 - "guest-sessions/route.ts"
Cohesion: 0.67
Nodes (3): authorized(), GET(), POST

### Community 70 - "health/route.ts"
Cohesion: 0.33
Nodes (4): dynamic, GET(), LogFields, logger

### Community 71 - "bulk/route.ts"
Cohesion: 0.33
Nodes (4): BulkItem, POST(), { getPoolClient, requireRole, client }, transitions

## Knowledge Gaps
- **246 isolated node(s):** `required`, `missing`, `eslintConfig`, `name`, `version` (+241 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `query()` connect `isAuthorizationFailure` to `guest-sessions/route.ts`, `guest-session.ts`, `health/route.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `jspdf` connect `dependencies` to `admin/page.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `required`, `missing`, `eslintConfig` to the rest of the system?**
  _246 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admin/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.050200803212851405 - nodes in this community are weakly interconnected._
- **Should `isAuthorizationFailure` be split into smaller, more focused modules?**
  _Cohesion score 0.052258064516129035 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._