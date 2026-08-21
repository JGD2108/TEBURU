# Graph Report - teburuapp  (2026-08-21)

## Corpus Check
- 245 files · ~138,425 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1743 nodes · 3014 edges · 167 communities (118 shown, 49 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `817c5d14`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- full-document-evaluation.ts
- Decisions
- dependencies
- compilerOptions
- devDependencies
- What You Must Do When Invoked
- finalize/route.ts
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
- openspec-explore/SKILL.md
- live-gemini-evaluation.test.ts
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
- Requirements
- MenuImportPanel.tsx
- Requirement: Controlled auxiliary text
- Requirement: Review-aware persistence and UI
- scripts
- public.menu_import_analysis_lineage_events
- Requirement: Server-generated identity and canonical bounding boxes
- Requirement: Retry outcomes are not automatically accepted
- Requirement: Canonical visual document extraction
- package.json
- Requirement: Centralized generic deduplication policy
- Requirement: Conservative document-level reconciliation
- Requirement: Deterministic and live evaluation separation
- adapter.ts
- ADDED Requirements
- provider.ts
- approve-all/route.ts
- isAuthorizationFailure
- Requirement: Structured semantic validation states
- Requirement: Targeted and spatially reconciled retries
- Requirement: Text fallback isolation
- images/route.ts
- Requirement: Versioned analyzer availability
- verify-menu-import-pgcrypto-migration.mjs
- verify-menu-import-deterministic.mjs
- verify-menu-import-pg-net-migration.mjs
- ADDED Requirements
- getPoolClient
- Requirements
- Decisions
- index.ts
- Event-driven menu analysis
- visual-analysis.ts
- PdfAnalysisProvider
- run-menu-import-live-evaluation.mjs
- public.menu_import_analysis_runs
- ADDED Requirements
- menu-import-migration-recovery.md
- ADDED Requirements
- Decisions
- types.ts
- Decisions
- db.ts
- pdfjs-worker.d.ts
- ADDED Requirements
- 2026-08-17-improve-menu-import-with-gemini/proposal.md
- text-only-evaluation.ts
- menu-import-full-document-evaluation-spike/tasks.md
- 2026-08-17-improve-menu-import-with-gemini/tasks.md
- 2026-08-21-menu-import-text-only-evaluation-spike/tasks.md
- Decisions
- GeminiRateScheduler
- auth.ts
- 20260820223937_add_visual_menu_import_drafts.sql
- error-context.md
- public.menu_import_draft_items
- public.menu_import_draft_categories
- public.menu_import_source_evidence
- public.menu_import_jobs
- public.menu_import_analysis_runs
- public.menu_import_analysis_runs
- menu-import-full-document-evaluation-spike/proposal.md
- deliver/route.ts
- text-only-evaluation.test.ts
- TextOnlyRequestBudget
- menu-import-v5-assisted-approval-ui/tasks.md
- text-only-gemini-experiment.test.ts
- restaurants/route.ts
- run-menu-import-full-pdf-experiment.mjs
- 2026-08-21-menu-import-text-only-evaluation-spike/proposal.md
- MODIFIED Requirements
- menu-import-text-only-production/tasks.md
- executeTextOnlyEvaluation
- menu-import-v5-assisted-approval-ui/proposal.md
- Decisions
- v5-text.adapter.test.ts
- bulk/route.ts
- update/route.ts
- extractTextDocument
- categories/route.ts
- menu-import-text-only-production/proposal.md
- Requirement: Independent item and price contract
- v5-v4-comparison.ts
- run-menu-import-text-only-evaluation.mjs
- jspdf
- Requirement: Advisory V5 decision metadata
- run-menu-import-v5-text-live.mjs
- Requirement: Bounded and observable call budgets
- pdfjs-dist
- Requirement: Durable extraction lineage
- menu-import-text-fixtures.md
- menu-import-v5-rollout.md

## God Nodes (most connected - your core abstractions)
1. `isAuthorizationFailure()` - 87 edges
2. `requireRole()` - 79 edges
3. `query()` - 68 edges
4. `getPoolClient()` - 45 edges
5. `analyzeV5Text()` - 32 edges
6. `jsonSuccess()` - 30 edges
7. `jsonError()` - 29 edges
8. `staffFetch()` - 25 edges
9. `jsonAuthorizationError()` - 22 edges
10. `createGeminiVisualStructurer()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `TablesManagerPanel()` --references--> `jspdf`  [EXTRACTED]
  src/components/admin/TablesManagerPanel.tsx → package.json
- `GET()` --calls--> `query()`  [EXTRACTED]
  src/app/api/health/route.ts → src/lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  src/app/api/public/catalog/route.ts → src/lib/db.ts
- `AdminDashboard()` --calls--> `isLocalDemo()`  [EXTRACTED]
  src/app/admin/page.tsx → src/lib/demo.ts
- `POST()` --calls--> `jsonAuthorizationError()`  [EXTRACTED]
  src/app/api/admin/menu-import/[id]/approve-all/route.ts → src/lib/api-response.ts

## Import Cycles
- None detected.

## Communities (167 total, 49 thin omitted)

### Community 0 - "full-document-evaluation.ts"
Cohesion: 0.08
Nodes (35): baseReport(), buildFullDocumentRequest(), classifyFullDocument(), countFullDocumentPdfPages(), emptyMetrics(), errorClass(), EvaluationClassification, executeFullDocumentEvaluation() (+27 more)

### Community 1 - "Decisions"
Cohesion: 0.11
Nodes (18): 10. Persistence and storage strategy, 11. Compatibility and versioning, 12. Architecture diagrams, 1. Two-stage rollout: lineage before behavior, 2. Image-only primary Gemini contract with controlled text, 3. Server-generated IDs and one canonical bbox system, 4. Structured validation as a gate, not a boolean, 5. Explicit call budgets and reason-specific retries (+10 more)

### Community 2 - "dependencies"
Cohesion: 0.10
Nodes (21): html2canvas, lucide-react, @napi-rs/canvas, next, dependencies, html2canvas, lucide-react, @napi-rs/canvas (+13 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, supabase/functions (+20 more)

### Community 4 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, @playwright/test, @types/node, @types/pg (+11 more)

### Community 5 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "finalize/route.ts"
Cohesion: 0.07
Nodes (70): Authorization, POST(), StorageObjectInfo, validateStoredPdf(), verifyAuthorizedUpload(), DELETE(), PATCH(), POST() (+62 more)

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
Cohesion: 0.07
Nodes (44): isServerLineageId(), ExtractedImage, ExtractedSection, V5TextFailureResult, { analyzeV5Text }, { getPoolClient }, projectionOutcome(), successOutcome() (+36 more)

### Community 42 - "Operación de Teburu"
Cohesion: 0.29
Nodes (6): Ambientes, Backup y restauración, Despliegue y rollback, Operación de Teburu, Respuesta a fallos, Salud, logs y alertas

### Community 46 - "menu-import-v3-visual-architecture/tasks.md"
Cohesion: 0.15
Nodes (12): 1. Contracts and compatibility baseline, 2. Stage 1 — lineage and observability foundation, 3. Visual-first page extraction, 4. Semantic validation and persistence gates, 5. Targeted page and regional retries, 6. Fallback isolation and document reconciliation, 7. Persistence, APIs, and review UI, 8. Regression fixtures and quality metrics (+4 more)

### Community 52 - "openspec-explore/SKILL.md"
Cohesion: 0.18
Nodes (10): Check for context, Ending Discovery, Guardrails, Handling Different Entry Points, OpenSpec Awareness, The Stance, What You Don't Have To Do, What You Might Do (+2 more)

### Community 53 - "live-gemini-evaluation.test.ts"
Cohesion: 0.13
Nodes (15): createGeminiRateScheduler(), GeminiRateSchedulerOptions, QueueEntry, LiveEvaluationCheckpoint, liveEvaluationCheckpointKey(), readLiveEvaluationCheckpoints(), writeLiveEvaluationCheckpoint(), hasGemini (+7 more)

### Community 54 - "session_tables"
Cohesion: 0.50
Nodes (3): session_tables, sessions, tables

### Community 56 - "ADDED Requirements"
Cohesion: 0.25
Nodes (7): ADDED Requirements, Purpose, Requirement: Lineage retention policy, Requirement: Provenance survives normalization and persistence, Scenario: Lineage is inspected, Scenario: Raw payload expires, Scenario: Review of a rejected or ambiguous item

### Community 57 - "menu_import_jobs"
Cohesion: 0.19
Nodes (14): bill_split_participants, bill_splits, platform_admins, restaurants, session_users, sessions, menu_import_draft_categories, menu_import_draft_items (+6 more)

### Community 63 - "menu-import-v3-visual-architecture/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 64 - "admin/page.tsx"
Cohesion: 0.05
Nodes (55): accessDestination(), AdminLogin(), AuthStep, AdminDashboard(), MenuRow, OnboardingPage(), parseMenu(), emptyForm (+47 more)

### Community 70 - "Requirements"
Cohesion: 0.06
Nodes (32): menu-import-text-only-evaluation Specification, Purpose, Requirement: Adjacent-only category continuity, Requirement: Deterministic and opt-in live verification, Requirement: Ephemeral evaluation report and fixture assessment, Requirement: Geometry-independent text-semantic validation, Requirement: Isolated native-text document evaluation, Requirement: One-request hard invariant (+24 more)

### Community 71 - "MenuImportPanel.tsx"
Cohesion: 0.06
Nodes (53): CategoryGroup, explicitStatus(), ExtractionIssue, ExtractionStatus, groupProjectedItems(), issueLabel(), issueReasons(), isTextOnlyV5Analyzer() (+45 more)

### Community 72 - "Requirement: Controlled auxiliary text"
Cohesion: 0.50
Nodes (4): Requirement: Controlled auxiliary text, Scenario: Primary extraction with available OCR, Scenario: Text-assisted targeted retry, Scenario: Text evidence is needed

### Community 73 - "Requirement: Review-aware persistence and UI"
Cohesion: 0.50
Nodes (4): Requirement: Review-aware persistence and UI, Scenario: Fragment presentation, Scenario: Human correction of review candidate, Scenario: Normal draft persistence

### Community 74 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, dev, lint, start, test, test:e2e, test:integration (+9 more)

### Community 75 - "public.menu_import_analysis_lineage_events"
Cohesion: 0.50
Nodes (3): public.menu_import_analysis_lineage_events, public.menu_import_analysis_runs, public.menu_import_jobs

### Community 76 - "Requirement: Server-generated identity and canonical bounding boxes"
Cohesion: 0.50
Nodes (4): Requirement: Server-generated identity and canonical bounding boxes, Scenario: Model repeats or changes an ID, Scenario: Provider bbox uses another coordinate system, Scenario: Regional bbox conversion

### Community 77 - "Requirement: Retry outcomes are not automatically accepted"
Cohesion: 0.67
Nodes (3): Requirement: Retry outcomes are not automatically accepted, Scenario: Retries exhausted with invalid fragment, Scenario: Retries exhausted with unresolved ambiguity

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

### Community 83 - "adapter.ts"
Cohesion: 0.10
Nodes (37): contentHash(), createMenuImportIdFactory(), safeLineageProjection(), sanitizeLineageEvent(), TEXT_ONLY_ASSISTED_APPROVAL_PROMPT_VERSION, TEXT_ONLY_ASSISTED_APPROVAL_SCHEMA_VERSION, TEXT_ONLY_TIMEOUT_MS, textMetrics (+29 more)

### Community 84 - "ADDED Requirements"
Cohesion: 0.07
Nodes (26): ADDED Requirements, Purpose, Requirement: Canonical document decoding and server identity, Requirement: Deterministic and opt-in live verification, Requirement: Ephemeral evaluation report and lineage, Requirement: Evaluation-only fixture assessment and classification, Requirement: Isolated native-PDF full-document evaluation, Requirement: One-request hard invariant (+18 more)

### Community 85 - "provider.ts"
Cohesion: 0.06
Nodes (58): boundedEnv(), BOX_SCHEMA, buildGeminiRequestBody(), callGemini(), CanvasModule, confidence(), CONFIDENCE_VALUES, configuredOcr() (+50 more)

### Community 86 - "approve-all/route.ts"
Cohesion: 0.07
Nodes (44): ApproveAllContext, DraftRow, DraftVersionMap, draftVersions(), GET(), hasValidationReasons(), ImportRow, object() (+36 more)

### Community 87 - "isAuthorizationFailure"
Cohesion: 0.19
Nodes (25): DELETE(), GET(), POST(), GET(), PATCH(), { requireRole, query }, GET(), PATCH() (+17 more)

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

### Community 97 - "getPoolClient"
Cohesion: 0.16
Nodes (14): POST(), POST(), ImportedItem, POST(), messages, POST(), { requireRole, getPoolClient, activateTables, client }, POST() (+6 more)

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
Cohesion: 0.09
Nodes (37): analyzePdf(), selectPageEvidence(), renderedPage, visualOutput, applyValidation(), bboxIoU(), bboxOverlap(), clipNormalizedBox() (+29 more)

### Community 104 - "run-menu-import-live-evaluation.mjs"
Cohesion: 0.25
Nodes (5): args, childEnv, fixture, loaded, pages

### Community 106 - "ADDED Requirements"
Cohesion: 0.06
Nodes (31): ADDED Requirements, Purpose, Requirement: Adjacent-only category continuity, Requirement: Deterministic and opt-in live verification, Requirement: Ephemeral evaluation report and fixture assessment, Requirement: Geometry-independent text-semantic validation, Requirement: Isolated native-text document evaluation, Requirement: One-request hard invariant (+23 more)

### Community 108 - "ADDED Requirements"
Cohesion: 0.08
Nodes (23): ADDED Requirements, Purpose, Requirement: Advisory model decision with server authority, Requirement: Category-grouped draft view and All filter, Requirement: Explicit publication and immediate refresh, Requirement: Safe audit and compatibility, Requirement: Server-derived bulk-approval eligibility, Requirement: Transactional approve-all action (+15 more)

### Community 109 - "Decisions"
Cohesion: 0.14
Nodes (13): 1. Dedicated text-only evaluator boundary, 2. TextDocument preserves extraction evidence, not inferred layout, 3. Text-only transport DTO, canonical domain adapter, 4. One consumable request budget, 5. Structure before semantics and reconciliation, 6. Conservative uncertainty policy, 7. Evaluation-only scoring, Context (+5 more)

### Community 110 - "types.ts"
Cohesion: 0.06
Nodes (36): MenuImportIdFactory, computeMenuImportMetrics(), AnalysisAttemptId, AnalysisMetrics, AnalysisResult, AnalysisRunId, AuxiliaryTextEvidence, Confidence (+28 more)

### Community 112 - "Decisions"
Cohesion: 0.14
Nodes (13): 1. Dedicated evaluation boundary, 2. A consumable request-budget guard, 3. Preflight treats the payload as an artifact, 4. V4-compatible schema projection, 5. Structural result precedes semantic result, 6. Ephemeral, safe evaluation lineage, 7. Classification is evidence, not rollout control, Context (+5 more)

### Community 113 - "db.ts"
Cohesion: 0.17
Nodes (7): dynamic, GET(), GET(), POST(), { getPoolClient, requireRole, client }, isSupabase, pool

### Community 117 - "ADDED Requirements"
Cohesion: 0.08
Nodes (24): ADDED Requirements, Purpose, Requirement: Explicit text-provider failure handling, Requirement: Native-text preflight and one-request extraction, Requirement: Review-aware text-only persistence, Requirement: Safe text-only lineage and metrics, Requirement: Selectable text-only production analyzer, Requirement: Text-only canonical structure and validation (+16 more)

### Community 118 - "2026-08-17-improve-menu-import-with-gemini/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 119 - "text-only-evaluation.ts"
Cohesion: 0.06
Nodes (36): adaptTextMenuDocument(), assistedApprovalItemSchema, assistedApprovalPageSchema, assistedApprovalSectionSchema, associationSchema, baseReport(), baseStructural(), GeminiFetch (+28 more)

### Community 120 - "menu-import-full-document-evaluation-spike/tasks.md"
Cohesion: 0.17
Nodes (11): 10. Opt-in runner and live execution, 11. Verification and handoff, 1. Evaluation contract and compatible types, 2. Deterministic preflight and payload integrity, 3. One-request budget guard, 4. Native PDF request builder, 5. Structural document validation, 6. Canonical decode, server IDs, and semantic validation (+3 more)

### Community 121 - "2026-08-17-improve-menu-import-with-gemini/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Configuration and provider boundary, 2. Validation and fallback, 3. Lineage and persistence, 4. Verification and rollout

### Community 122 - "2026-08-21-menu-import-text-only-evaluation-spike/tasks.md"
Cohesion: 0.17
Nodes (11): 10. Opt-in live evaluation and handoff, 11. Verification and isolation proof, 1. Evaluation contracts and isolation, 2. Native TextDocument extraction, 3. Text serialization and request contract, 4. One-request execution boundary, 5. Transport decode and canonical adaptation, 6. Structural and continuity validation (+3 more)

### Community 123 - "Decisions"
Cohesion: 0.17
Nodes (11): 1. Recommendation is evidence, not authority, 2. Versioned server eligibility policy, 3. Atomic bulk endpoint, 4. Approval and publication remain separate, 5. Category-first V5 operator UI, 6. Reuse existing storage before schema changes, Context, Decisions (+3 more)

### Community 126 - "auth.ts"
Cohesion: 0.20
Nodes (10): GET(), adminClient(), DELETE(), GET(), POST(), { query, requireRole, createUser, deleteUser }, requireStaff(), StaffRole (+2 more)

### Community 127 - "20260820223937_add_visual_menu_import_drafts.sql"
Cohesion: 0.40
Nodes (4): public.menu_import_document_metadata, public.menu_import_draft_price_variants, public.menu_import_draft_items, public.menu_import_jobs

### Community 128 - "error-context.md"
Cohesion: 0.40
Nodes (4): Error details, Instructions, Test info, Test source

### Community 135 - "menu-import-full-document-evaluation-spike/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 137 - "text-only-evaluation.test.ts"
Cohesion: 0.15
Nodes (10): buildTextOnlyRequest(), serializeTextDocument(), TEXT_DOCUMENT_SERIALIZER_VERSION, TEXT_ONLY_API_VERSION, TEXT_ONLY_DEFAULT_MODEL, TEXT_ONLY_MAX_OUTPUT_TOKENS, TEXT_ONLY_RESPONSE_SCHEMA, TextMenuDocument (+2 more)

### Community 139 - "menu-import-v5-assisted-approval-ui/tasks.md"
Cohesion: 0.22
Nodes (8): 1. Existing-contract inspection, 2. Advisory provider contract, 3. Authoritative validation and eligibility, 4. Durable persistence and compatibility, 5. Transactional bulk approval API, 6. V5-focused import and category UI, 7. Cross-cutting safety and regression, 8. Controlled platform rollout

### Community 140 - "text-only-gemini-experiment.test.ts"
Cohesion: 0.18
Nodes (8): MAX_GENERATE_CONTENT_REQUESTS, pageEvaluationReport(), preflightTextDocument(), readTextOnlyPdf(), TARGET_PAGES, describeV5NativeText(), V5_TEXT_ANALYZER_VERSION, SUBARASHII_REGRESSION

### Community 141 - "restaurants/route.ts"
Cohesion: 0.43
Nodes (6): PATCH(), authAdmin(), GET(), POST(), slugify(), requirePlatformAdmin()

### Community 143 - "2026-08-21-menu-import-text-only-evaluation-spike/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 144 - "MODIFIED Requirements"
Cohesion: 0.11
Nodes (17): MODIFIED Requirements, Requirement: Provider lineage, Requirement: Safe fallback and bounded provider use, Requirement: Structured and validated menu output, Requirement: Text-only Gemini structuring, Scenario: Gemini is not configured, Scenario: Gemini request fails, Scenario: Gemini returns valid menu entries (+9 more)

### Community 145 - "menu-import-text-only-production/tasks.md"
Cohesion: 0.12
Nodes (15): 10. Deterministic integration tests, 11. Subarashii regression fixture, 12. Generic fixture suite, 13. Production-equivalent live evaluation, 14. Controlled rollout comparison, 15. Final verification, 1. Production analyzer contract, 2. Reusable native-text primitives (+7 more)

### Community 146 - "executeTextOnlyEvaluation"
Cohesion: 0.25
Nodes (15): association(), classifyTextOnly(), configuredTextOnlyModel(), decodeItem(), decodeSection(), decodeTextMenuDocument(), errorClass(), executeTextOnlyEvaluation() (+7 more)

### Community 147 - "menu-import-v5-assisted-approval-ui/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 148 - "Decisions"
Cohesion: 0.13
Nodes (14): 1. Versioned opt-in analyzer: `menu-import-v5-text`, 2. Dedicated V5 production adapter over shared text-only primitives, 3. One automatic provider request per V5 job, 4. Separate V5 server configuration, 5. Structure and semantic gates precede persistence, 6. Native-text lineage without image lineage, 7. Existing UI with text-specific review affordances, 8. Fixture ladder before wider rollout (+6 more)

### Community 149 - "v5-text.adapter.test.ts"
Cohesion: 0.17
Nodes (8): TextDocument, providerDecision(), transportDocument(), V5_TEXT_API_VERSION, V5_TEXT_DEFAULT_MODEL, V5_TEXT_MAX_OUTPUT_TOKENS, V5_TEXT_SERIALIZER_VERSION, V5_TEXT_TIMEOUT_MS

### Community 150 - "bulk/route.ts"
Cohesion: 0.33
Nodes (4): BulkItem, POST(), { getPoolClient, requireRole, client }, transitions

### Community 151 - "update/route.ts"
Cohesion: 0.33
Nodes (4): nextStatuses, POST(), priorities, { getPoolClient, requireRole, client }

### Community 152 - "extractTextDocument"
Cohesion: 0.29
Nodes (7): applyTextValidation(), candidateReasons(), extractTextDocument(), loadTextOnlyPdfJs(), normalized(), TextCanonicalDocument, extractV5NativeText()

### Community 154 - "menu-import-text-only-production/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 155 - "Requirement: Independent item and price contract"
Cohesion: 0.67
Nodes (3): Requirement: Independent item and price contract, Scenario: Multiple prices, Scenario: Single price

### Community 156 - "v5-v4-comparison.ts"
Cohesion: 0.50
Nodes (3): AnalyzerComparison, AnalyzerEvidence, compareV5WithV4()

### Community 159 - "Requirement: Advisory V5 decision metadata"
Cohesion: 0.33
Nodes (5): ADDED Requirements, Requirement: Advisory V5 decision metadata, Scenario: Advisory metadata conflicts with validation, Scenario: Advisory metadata is malformed, Scenario: Valid advisory metadata is decoded

### Community 162 - "Requirement: Bounded and observable call budgets"
Cohesion: 0.67
Nodes (3): Requirement: Bounded and observable call budgets, Scenario: Provider transient failure, Scenario: Semantic budget is exhausted

### Community 164 - "Requirement: Durable extraction lineage"
Cohesion: 0.67
Nodes (3): Requirement: Durable extraction lineage, Scenario: Defective item investigation, Scenario: Privacy and cost bounds

## Knowledge Gaps
- **753 isolated node(s):** `required`, `missing`, `eslintConfig`, `name`, `version` (+748 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getPoolClient()` connect `getPoolClient` to `guest-session.ts`, `finalize/route.ts`, `deliver/route.ts`, `worker.ts`, `restaurants/route.ts`, `db.ts`, `approve-all/route.ts`, `bulk/route.ts`, `update/route.ts`, `auth.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `isAuthorizationFailure()` connect `isAuthorizationFailure` to `getPoolClient`, `finalize/route.ts`, `deliver/route.ts`, `restaurants/route.ts`, `db.ts`, `bulk/route.ts`, `approve-all/route.ts`, `update/route.ts`, `categories/route.ts`, `images/route.ts`, `auth.ts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `requireRole()` connect `isAuthorizationFailure` to `getPoolClient`, `finalize/route.ts`, `deliver/route.ts`, `db.ts`, `bulk/route.ts`, `approve-all/route.ts`, `update/route.ts`, `categories/route.ts`, `images/route.ts`, `auth.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `required`, `missing`, `eslintConfig` to the rest of the system?**
  _753 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `full-document-evaluation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08405797101449275 - nodes in this community are weakly interconnected._
- **Should `Decisions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._