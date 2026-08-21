# Graph Report - teburuapp  (2026-08-20)

## Corpus Check
- 194 files · ~98,506 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1110 nodes · 2016 edges · 138 communities (94 shown, 44 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a3b8da77`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- Decisions
- dependencies
- compilerOptions
- devDependencies
- What You Must Do When Invoked
- isAuthorizationFailure
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
- MODIFIED Requirements
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
- menu-import-v3-visual-architecture/tasks.md
- vercel.json
- verify-remote-security.mjs
- jsonSuccess
- openspec-explore/SKILL.md
- finalize/route.ts
- session_tables
- ADDED Requirements
- menu_import_jobs
- menu_categories
- menu_items
- order_items
- orders
- tables
- menu-import-v3-visual-architecture/proposal.md
- admin/page.tsx
- api-client.ts
- MenuImportPanel.tsx
- Requirement: Controlled auxiliary text
- Requirement: Review-aware persistence and UI
- scripts
- public.menu_import_analysis_lineage_events
- Requirement: Server-generated identity and canonical bounding boxes
- Requirement: Bounded and observable call budgets
- Requirement: Canonical visual document extraction
- package.json
- Requirement: Centralized generic deduplication policy
- Requirement: Conservative document-level reconciliation
- Requirement: Deterministic and live evaluation separation
- createPdfAnalysisProvider
- Requirement: Durable extraction lineage
- provider.ts
- KitchenPanel.tsx
- Requirement: Retry outcomes are not automatically accepted
- Requirement: Structured semantic validation states
- Requirement: Targeted and spatially reconciled retries
- Requirement: Text fallback isolation
- images/route.ts
- Requirement: Versioned analyzer availability
- verify-menu-import-pgcrypto-migration.mjs
- verify-menu-import-deterministic.mjs
- verify-menu-import-pg-net-migration.mjs
- ADDED Requirements
- activate/route.ts
- Requirements
- Decisions
- index.ts
- Event-driven menu analysis
- visual-analysis.ts
- isLocalDemo
- staff/route.test.ts
- lineage.test.ts
- menu-import-migration-recovery.md
- createGeminiVisualStructurer
- guest-sessions/route.ts
- types.ts
- provider.test.ts
- @supabase/supabase-js
- pdfjs-worker.d.ts
- auth.ts
- 2026-08-17-improve-menu-import-with-gemini/proposal.md
- jspdf
- decodeGeminiVisualDocument
- 2026-08-17-improve-menu-import-with-gemini/tasks.md
- worker.test.ts
- Requirement: Lineage retention policy
- checkout/route.test.ts
- PdfAnalysisProvider
- 20260820223937_add_visual_menu_import_drafts.sql
- error-context.md
- public.menu_import_draft_items
- public.menu_import_draft_categories
- public.menu_import_source_evidence
- public.menu_import_jobs
- public.menu_import_analysis_runs
- public.menu_import_analysis_runs
- categories/route.test.ts
- deliver/route.test.ts
- server-only

## God Nodes (most connected - your core abstractions)
1. `isAuthorizationFailure()` - 84 edges
2. `requireRole()` - 76 edges
3. `query()` - 68 edges
4. `getPoolClient()` - 42 edges
5. `jsonSuccess()` - 27 edges
6. `jsonError()` - 26 edges
7. `staffFetch()` - 25 edges
8. `jsonAuthorizationError()` - 19 edges
9. `ADDED Requirements` - 18 edges
10. `menuImportStorage()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `TablesManagerPanel()` --references--> `jspdf`  [EXTRACTED]
  src/components/admin/TablesManagerPanel.tsx → package.json
- `AdminDashboard()` --calls--> `isLocalDemo()`  [EXTRACTED]
  src/app/admin/page.tsx → src/lib/demo.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  src/app/api/health/route.ts → src/lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  src/app/api/public/catalog/route.ts → src/lib/db.ts
- `AdminLogin()` --calls--> `isLocalDemo()`  [EXTRACTED]
  src/app/admin/login/page.tsx → src/lib/demo.ts

## Import Cycles
- None detected.

## Communities (138 total, 44 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.10
Nodes (18): BulkItem, POST(), { getPoolClient, requireRole, client }, transitions, nextStatuses, POST(), priorities, { getPoolClient, requireRole, client } (+10 more)

### Community 1 - "Decisions"
Cohesion: 0.11
Nodes (18): 10. Persistence and storage strategy, 11. Compatibility and versioning, 12. Architecture diagrams, 1. Two-stage rollout: lineage before behavior, 2. Image-only primary Gemini contract with controlled text, 3. Server-generated IDs and one canonical bbox system, 4. Structured validation as a gate, not a boolean, 5. Explicit call budgets and reason-specific retries (+10 more)

### Community 2 - "dependencies"
Cohesion: 0.11
Nodes (19): html2canvas, lucide-react, @napi-rs/canvas, next, dependencies, html2canvas, lucide-react, @napi-rs/canvas (+11 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, supabase/functions (+20 more)

### Community 4 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, @playwright/test, @types/node, @types/pg (+11 more)

### Community 5 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "isAuthorizationFailure"
Cohesion: 0.15
Nodes (31): POST(), DELETE(), GET(), POST(), GET(), PATCH(), { requireRole, query }, GET() (+23 more)

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

### Community 25 - "MODIFIED Requirements"
Cohesion: 0.13
Nodes (14): MODIFIED Requirements, Requirement: Provider lineage, Requirement: Safe fallback and bounded provider use, Requirement: Structured and validated menu output, Requirement: Text-only Gemini structuring, Scenario: Gemini response fails validation, Scenario: Gemini unavailable, Scenario: Local fallback is used (+6 more)

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
Cohesion: 0.11
Nodes (30): AnalysisMetrics, AnalysisResult, Confidence, ExtractedImage, ALLOWED_ASSET_TYPES, analysisMetrics(), AnalysisResultWithStructureLineage, ANALYZER_VERSION (+22 more)

### Community 42 - "Operación de Teburu"
Cohesion: 0.29
Nodes (6): Ambientes, Backup y restauración, Despliegue y rollback, Operación de Teburu, Respuesta a fallos, Salud, logs y alertas

### Community 46 - "menu-import-v3-visual-architecture/tasks.md"
Cohesion: 0.15
Nodes (12): 1. Contracts and compatibility baseline, 2. Stage 1 — lineage and observability foundation, 3. Visual-first page extraction, 4. Semantic validation and persistence gates, 5. Targeted page and regional retries, 6. Fallback isolation and document reconciliation, 7. Persistence, APIs, and review UI, 8. Regression fixtures and quality metrics (+4 more)

### Community 49 - "jsonSuccess"
Cohesion: 0.19
Nodes (27): POST(), DELETE(), PATCH(), POST(), POST(), DELETE(), GET(), GET() (+19 more)

### Community 52 - "openspec-explore/SKILL.md"
Cohesion: 0.18
Nodes (10): Check for context, Ending Discovery, Guardrails, Handling Different Entry Points, OpenSpec Awareness, The Stance, What You Don't Have To Do, What You Might Do (+2 more)

### Community 53 - "finalize/route.ts"
Cohesion: 0.09
Nodes (25): Authorization, StorageObjectInfo, validateStoredPdf(), verifyAuthorizedUpload(), dynamic, GET(), authorized(), POST() (+17 more)

### Community 54 - "session_tables"
Cohesion: 0.50
Nodes (3): session_tables, sessions, tables

### Community 56 - "ADDED Requirements"
Cohesion: 0.25
Nodes (7): ADDED Requirements, Purpose, Requirement: Independent item and price contract, Requirement: Provenance survives normalization and persistence, Scenario: Multiple prices, Scenario: Review of a rejected or ambiguous item, Scenario: Single price

### Community 57 - "menu_import_jobs"
Cohesion: 0.19
Nodes (14): bill_split_participants, bill_splits, platform_admins, restaurants, session_users, sessions, menu_import_draft_categories, menu_import_draft_items (+6 more)

### Community 63 - "menu-import-v3-visual-architecture/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 64 - "admin/page.tsx"
Cohesion: 0.14
Nodes (17): AdminDashboard(), HistoryPanel(), MenuPanel(), OverviewPanel(), SettingsPanel(), StaffPanel(), Draft, MenuItem (+9 more)

### Community 70 - "api-client.ts"
Cohesion: 0.18
Nodes (12): accessDestination(), AdminLogin(), AuthStep, staffJson(), ApiClientError, ApiErrorBody, isJsonResponse(), readApiResponse() (+4 more)

### Community 71 - "MenuImportPanel.tsx"
Cohesion: 0.08
Nodes (33): explicitStatus(), ExtractionIssue, ExtractionStatus, issueLabel(), issueReasons(), MenuImportProjection, ProjectableDraftItem, ProjectionInput (+25 more)

### Community 72 - "Requirement: Controlled auxiliary text"
Cohesion: 0.50
Nodes (4): Requirement: Controlled auxiliary text, Scenario: Primary extraction with available OCR, Scenario: Text-assisted targeted retry, Scenario: Text evidence is needed

### Community 73 - "Requirement: Review-aware persistence and UI"
Cohesion: 0.50
Nodes (4): Requirement: Review-aware persistence and UI, Scenario: Fragment presentation, Scenario: Human correction of review candidate, Scenario: Normal draft persistence

### Community 74 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, lint, start, test, test:e2e, test:integration (+5 more)

### Community 75 - "public.menu_import_analysis_lineage_events"
Cohesion: 0.50
Nodes (3): public.menu_import_analysis_lineage_events, public.menu_import_analysis_runs, public.menu_import_jobs

### Community 76 - "Requirement: Server-generated identity and canonical bounding boxes"
Cohesion: 0.50
Nodes (4): Requirement: Server-generated identity and canonical bounding boxes, Scenario: Model repeats or changes an ID, Scenario: Provider bbox uses another coordinate system, Scenario: Regional bbox conversion

### Community 77 - "Requirement: Bounded and observable call budgets"
Cohesion: 0.67
Nodes (3): Requirement: Bounded and observable call budgets, Scenario: Provider transient failure, Scenario: Semantic budget is exhausted

### Community 78 - "Requirement: Canonical visual document extraction"
Cohesion: 0.67
Nodes (3): Requirement: Canonical visual document extraction, Scenario: Multimodal page extraction, Scenario: Multiple visual layouts

### Community 79 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 80 - "Requirement: Centralized generic deduplication policy"
Cohesion: 0.67
Nodes (3): Requirement: Centralized generic deduplication policy, Scenario: Deduplication is configured, Scenario: New layout is evaluated

### Community 81 - "Requirement: Conservative document-level reconciliation"
Cohesion: 0.67
Nodes (3): Requirement: Conservative document-level reconciliation, Scenario: Adjacent continuation, Scenario: Distant prior section

### Community 82 - "Requirement: Deterministic and live evaluation separation"
Cohesion: 0.67
Nodes (3): Requirement: Deterministic and live evaluation separation, Scenario: CI deterministic test run, Scenario: Live evaluation run

### Community 83 - "createPdfAnalysisProvider"
Cohesion: 0.32
Nodes (8): boundedEnv(), configuredOcr(), configuredRenderLimits(), createGeminiTextStructurer(), createPdfAnalysisProvider(), decodeGeminiItems(), serverGeminiConfig(), flattenVisualDocument()

### Community 84 - "Requirement: Durable extraction lineage"
Cohesion: 0.67
Nodes (3): Requirement: Durable extraction lineage, Scenario: Defective item investigation, Scenario: Privacy and cost bounds

### Community 85 - "provider.ts"
Cohesion: 0.09
Nodes (27): BOX_SCHEMA, CanvasModule, confidence(), cropVisualPage(), extractEmbeddedImages(), GeminiConfig, GeminiFetch, GeminiTextStructurer (+19 more)

### Community 86 - "KitchenPanel.tsx"
Cohesion: 0.13
Nodes (14): MenuRow, OnboardingPage(), parseMenu(), ConnectionState, KitchenItem, KitchenPanel(), KitchenStatus, lanes (+6 more)

### Community 87 - "Requirement: Retry outcomes are not automatically accepted"
Cohesion: 0.67
Nodes (3): Requirement: Retry outcomes are not automatically accepted, Scenario: Retries exhausted with invalid fragment, Scenario: Retries exhausted with unresolved ambiguity

### Community 88 - "Requirement: Structured semantic validation states"
Cohesion: 0.67
Nodes (3): Requirement: Structured semantic validation states, Scenario: Ambiguous real product, Scenario: Likely non-product fragment

### Community 89 - "Requirement: Targeted and spatially reconciled retries"
Cohesion: 0.67
Nodes (3): Requirement: Targeted and spatially reconciled retries, Scenario: Merged item retry, Scenario: Regional repair

### Community 90 - "Requirement: Text fallback isolation"
Cohesion: 0.67
Nodes (3): Requirement: Text fallback isolation, Scenario: Page-local fallback, Scenario: Renderable page with visual failure

### Community 91 - "images/route.ts"
Cohesion: 0.38
Nodes (4): extensions, POST(), storageAdmin(), { requireRole, createClient, getBucket, createBucket, updateBucket, upload, getPublicUrl }

### Community 92 - "Requirement: Versioned analyzer availability"
Cohesion: 0.67
Nodes (3): Requirement: Versioned analyzer availability, Scenario: Rollback, Scenario: Version comparison

### Community 93 - "verify-menu-import-pgcrypto-migration.mjs"
Cohesion: 0.20
Nodes (7): applyAndAssertBackfill(), assertFailureRollsBack(), client, migrationsDir, placePgcryptoIn(), root, sha256()

### Community 95 - "verify-menu-import-pg-net-migration.mjs"
Cohesion: 0.40
Nodes (4): disabledAt, enabledAt, required, root

### Community 96 - "ADDED Requirements"
Cohesion: 0.11
Nodes (17): ADDED Requirements, Purpose, Requirement: Provider lineage, Requirement: Safe fallback and bounded provider use, Requirement: Server-only credentials and text privacy, Requirement: Structured and validated menu output, Requirement: Text-only Gemini structuring, Scenario: Browser accesses the admin import UI (+9 more)

### Community 97 - "activate/route.ts"
Cohesion: 0.23
Nodes (10): messages, POST(), { requireRole, getPoolClient, activateTables, client }, POST(), StaffSession, activateTables(), newAccessCode(), normalizeTableIds() (+2 more)

### Community 98 - "Requirements"
Cohesion: 0.11
Nodes (17): Provider lineage, Purpose, Requirements, Safe fallback and bounded provider use, Scenario: Browser accesses the admin import UI, Scenario: Gemini is not configured, Scenario: Gemini request fails, Scenario: Gemini returns invalid output (+9 more)

### Community 99 - "Decisions"
Cohesion: 0.18
Nodes (10): Context, Decisions, Goals / Non-Goals, Keep local parsing as the first safety net, Migration Plan, Record lineage without changing publication semantics, Risks / Trade-offs, Treat configuration and quota as operational concerns (+2 more)

### Community 101 - "Event-driven menu analysis"
Cohesion: 0.50
Nodes (3): Event-driven menu analysis, Visual architecture rollout and provider boundary, Visual Gemini extraction and operational controls

### Community 102 - "visual-analysis.ts"
Cohesion: 0.08
Nodes (33): ExtractedMenuItem, PageText, ANALYZER_PROMPT_VERSION, applyValidation(), bboxIoU(), bboxOverlap(), DeduplicationPolicy, DEFAULT_DEDUPLICATION_POLICY (+25 more)

### Community 103 - "isLocalDemo"
Cohesion: 0.22
Nodes (11): emptyForm, PlatformPage(), Restaurant, CartItem, TableMenu(), TableLogin(), DemoBar(), links (+3 more)

### Community 106 - "lineage.test.ts"
Cohesion: 0.24
Nodes (10): MENU_IMPORT_ANALYZER_V3, MENU_IMPORT_ANALYZER_V4, MenuImportAnalyzerVersion, resolveAnalyzerVersion(), contentHash(), createMenuImportIdFactory(), isServerLineageId(), safeLineageProjection() (+2 more)

### Community 108 - "createGeminiVisualStructurer"
Cohesion: 0.18
Nodes (12): buildGeminiRequestBody(), callGemini(), createGeminiVisualStructurer(), pageAuxiliaryText(), sha256Text(), assignServerIds(), createServerIdFactory(), difficultRegions() (+4 more)

### Community 109 - "guest-sessions/route.ts"
Cohesion: 0.67
Nodes (3): authorized(), GET(), POST

### Community 110 - "types.ts"
Cohesion: 0.07
Nodes (31): MenuImportIdFactory, AnalysisAttemptId, AnalysisRunId, AuxiliaryTextEvidence, DocumentMetadata, ExtractedItemId, ExtractedModifier, ExtractedOption (+23 more)

### Community 112 - "provider.test.ts"
Cohesion: 0.21
Nodes (12): analyzePdf(), installNodeCanvasGlobals(), installPdfJsWorkerHandler(), loadNodePdfJs(), selectPageEvidence(), renderedPage, visualOutput, clipNormalizedBox() (+4 more)

### Community 117 - "auth.ts"
Cohesion: 0.18
Nodes (14): AccessRow, GET(), { requireAuthenticatedUser, query, logger }, PATCH(), authAdmin(), GET(), POST(), slugify() (+6 more)

### Community 118 - "2026-08-17-improve-menu-import-with-gemini/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 120 - "decodeGeminiVisualDocument"
Cohesion: 0.47
Nodes (6): CONFIDENCE_VALUES, decodedPrice(), decodeGeminiVisualDocument(), record(), stringArray(), stringRecord()

### Community 121 - "2026-08-17-improve-menu-import-with-gemini/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Configuration and provider boundary, 2. Validation and fallback, 3. Lineage and persistence, 4. Verification and rollout

### Community 122 - "worker.test.ts"
Cohesion: 0.40
Nodes (3): { getPoolClient }, job, provider

### Community 123 - "Requirement: Lineage retention policy"
Cohesion: 0.67
Nodes (3): Requirement: Lineage retention policy, Scenario: Lineage is inspected, Scenario: Raw payload expires

### Community 127 - "20260820223937_add_visual_menu_import_drafts.sql"
Cohesion: 0.40
Nodes (4): public.menu_import_document_metadata, public.menu_import_draft_price_variants, public.menu_import_draft_items, public.menu_import_jobs

### Community 128 - "error-context.md"
Cohesion: 0.40
Nodes (4): Error details, Instructions, Test info, Test source

## Knowledge Gaps
- **431 isolated node(s):** `required`, `missing`, `eslintConfig`, `name`, `version` (+426 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getPoolClient()` connect `db.ts` to `activate/route.ts`, `guest-session.ts`, `isAuthorizationFailure`, `worker.ts`, `jsonSuccess`, `auth.ts`, `finalize/route.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `@supabase/supabase-js`, `server-only`, `jspdf`, `package.json`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `jspdf` connect `jspdf` to `admin/page.tsx`, `dependencies`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `required`, `missing`, `eslintConfig` to the rest of the system?**
  _431 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1010752688172043 - nodes in this community are weakly interconnected._
- **Should `Decisions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._