# Graph Report - teburuapp  (2026-08-09)

## Corpus Check
- 106 files · ~39,309 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 450 nodes · 729 edges · 55 communities (31 shown, 24 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fdc4200a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admin/page.tsx
- isAuthorizationFailure
- dependencies
- compilerOptions
- devDependencies
- What You Must Do When Invoked
- 202608050000_initial_schema.sql
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
- graphify reference: extra exports and benchmark
- graphify reference: query, path, explain
- Teburu (テーブル) Restaurant OS
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- AGENTS.md
- extraction-spec.md
- guest-session.ts
- 202608060100_kitchen_stations_and_item_workflow.sql
- order_items
- db.ts
- Operación de Teburu
- layout.tsx
- 202608060300_rls_and_browser_lockdown.sql
- restaurant-flow.spec.ts
- menu/page.tsx
- vercel.json
- verify-remote-security.mjs
- bulk/route.ts
- update/route.ts
- session_tables

## God Nodes (most connected - your core abstractions)
1. `isAuthorizationFailure()` - 51 edges
2. `requireRole()` - 50 edges
3. `query()` - 47 edges
4. `getPoolClient()` - 24 edges
5. `staffFetch()` - 20 edges
6. `compilerOptions` - 16 edges
7. `What You Must Do When Invoked` - 12 edges
8. `requireGuestSession()` - 10 edges
9. `/graphify` - 10 edges
10. `scripts` - 9 edges

## Surprising Connections (you probably didn't know these)
- `TablesManagerPanel()` --references--> `jspdf`  [EXTRACTED]
  src/components/admin/TablesManagerPanel.tsx → package.json
- `GET()` --calls--> `query()`  [EXTRACTED]
  src/app/api/health/route.ts → src/lib/db.ts
- `POST()` --calls--> `isAuthorizationFailure()`  [EXTRACTED]
  src/app/api/kds/bulk/route.ts → src/lib/auth.ts
- `POST()` --calls--> `requireRole()`  [EXTRACTED]
  src/app/api/kds/bulk/route.ts → src/lib/auth.ts
- `POST()` --calls--> `getPoolClient()`  [EXTRACTED]
  src/app/api/kds/bulk/route.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (55 total, 24 thin omitted)

### Community 0 - "admin/page.tsx"
Cohesion: 0.10
Nodes (24): AuthStep, HistoryPanel(), ConnectionState, KitchenItem, KitchenPanel(), KitchenStatus, lanes, nextPriority (+16 more)

### Community 1 - "isAuthorizationFailure"
Cohesion: 0.11
Nodes (38): POST(), { requireRole, query }, DELETE(), GET(), POST(), GET(), PATCH(), { requireRole, query } (+30 more)

### Community 2 - "dependencies"
Cohesion: 0.11
Nodes (19): html2canvas, jspdf, lucide-react, next, dependencies, html2canvas, jspdf, lucide-react (+11 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 4 - "devDependencies"
Cohesion: 0.06
Nodes (31): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, @playwright/test, @types/node, @types/pg (+23 more)

### Community 5 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "202608050000_initial_schema.sql"
Cohesion: 0.40
Nodes (9): menu_categories, menu_items, order_items, orders, restaurant_settings, session_users, sessions, staff (+1 more)

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
Nodes (3): session_users, guest_access_tokens, sessions

### Community 26 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 27 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 28 - "Teburu (テーブル) Restaurant OS"
Cohesion: 0.40
Nodes (4): Ejecución en Desarrollo, Funcionalidades, Requisitos de Configuración, Teburu (テーブル) Restaurant OS

### Community 29 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 30 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 31 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 37 - "guest-session.ts"
Cohesion: 0.23
Nodes (14): POST(), POST(), POST(), GET(), GET(), { requireGuestSession, setGuestCookie, clearGuestCookie }, clearGuestCookie(), guestCookieName (+6 more)

### Community 39 - "202608060100_kitchen_stations_and_item_workflow.sql"
Cohesion: 0.20
Nodes (13): menu_items, snapshot_order_item_stations, kitchen_stations, menu_item_stations, order_events, order_item_stations, order_items_snapshot_stations, order_items_sync_order_status (+5 more)

### Community 41 - "db.ts"
Cohesion: 0.08
Nodes (25): dynamic, GET(), authorized(), GET(), POST, POST(), POST(), { getPoolClient, requireRole, client } (+17 more)

### Community 42 - "Operación de Teburu"
Cohesion: 0.29
Nodes (6): Ambientes, Backup y restauración, Despliegue y rollback, Operación de Teburu, Respuesta a fallos, Salud, logs y alertas

### Community 52 - "bulk/route.ts"
Cohesion: 0.33
Nodes (4): BulkItem, POST(), { getPoolClient, requireRole, client }, transitions

### Community 53 - "update/route.ts"
Cohesion: 0.33
Nodes (4): nextStatuses, POST(), priorities, { getPoolClient, requireRole, client }

### Community 54 - "session_tables"
Cohesion: 0.50
Nodes (3): session_tables, sessions, tables

## Knowledge Gaps
- **166 isolated node(s):** `required`, `missing`, `eslintConfig`, `name`, `version` (+161 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `jspdf` connect `dependencies` to `admin/page.tsx`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `TablesManagerPanel()` connect `admin/page.tsx` to `dependencies`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `required`, `missing`, `eslintConfig` to the rest of the system?**
  _166 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admin/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1024390243902439 - nodes in this community are weakly interconnected._
- **Should `isAuthorizationFailure` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._