# Graph Report - teburuapp  (2026-08-05)

## Corpus Check
- 65 files · ~26,363 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 272 nodes · 301 edges · 39 communities (20 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `010c26b3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admin/page.tsx
- query
- dependencies
- compilerOptions
- devDependencies
- What You Must Do When Invoked
- include
- schema.sql
- package.json
- eslint.config.mjs
- migrate.js
- update_legacy_staff.js
- add_access_code.js
- add_email_staff.js
- add_password_hash.js
- add_waiter_fields.js
- fix_passwords.js
- migrate_ingredients.js
- migrate_settings.js
- migrate_staff.js
- reset_mfa.js
- seed_menu.js
- setup_master_admin.js
- database.types.ts
- next.config.ts
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
- update/route.ts

## God Nodes (most connected - your core abstractions)
1. `query()` - 17 edges
2. `compilerOptions` - 16 edges
3. `getPoolClient()` - 12 edges
4. `supabase` - 12 edges
5. `What You Must Do When Invoked` - 12 edges
6. `/graphify` - 10 edges
7. `graphify reference: extra exports and benchmark` - 8 edges
8. `scripts` - 6 edges
9. `include` - 6 edges
10. `graphify reference: query, path, explain` - 5 edges

## Surprising Connections (you probably didn't know these)
- `TablesManagerPanel()` --references--> `jspdf`  [EXTRACTED]
  src/components/admin/TablesManagerPanel.tsx → package.json
- `GET()` --calls--> `query()`  [EXTRACTED]
  src/app/api/history/route.ts → src/lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  src/app/api/kds/route.ts → src/lib/db.ts
- `POST()` --calls--> `query()`  [EXTRACTED]
  src/app/api/kds/update/route.ts → src/lib/db.ts
- `POST()` --calls--> `getPoolClient()`  [EXTRACTED]
  src/app/api/order/create/route.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (39 total, 19 thin omitted)

### Community 0 - "admin/page.tsx"
Cohesion: 0.09
Nodes (15): jspdf, jspdf, AuthStep, metadata, CartItem, HistoryPanel(), KitchenPanel(), MenuPanel() (+7 more)

### Community 1 - "query"
Cohesion: 0.16
Nodes (14): GET(), GET(), POST(), POST(), GET(), POST(), POST(), POST() (+6 more)

### Community 2 - "dependencies"
Cohesion: 0.12
Nodes (17): html2canvas, lucide-react, next, dependencies, html2canvas, lucide-react, next, pg (+9 more)

### Community 3 - "compilerOptions"
Cohesion: 0.11
Nodes (19): dom, dom.iterable, esnext, compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules (+11 more)

### Community 4 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, @types/node, @types/pg, @types/react (+9 more)

### Community 5 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "include"
Cohesion: 0.22
Nodes (8): .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx, exclude, include

### Community 7 - "schema.sql"
Cohesion: 0.50
Nodes (7): menu_categories, menu_items, order_items, orders, session_users, sessions, tables

### Community 8 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, test (+1 more)

### Community 10 - "migrate.js"
Cohesion: 0.40
Nodes (3): { Client }, fs, path

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

### Community 37 - "update/route.ts"
Cohesion: 0.29
Nodes (5): POST(), { query }, expectedOrderStatusForKitchenUpdate(), KitchenOrderStatus, kitchenStatusTransitions

## Knowledge Gaps
- **120 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+115 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`, `admin/page.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `jspdf` connect `admin/page.tsx` to `dependencies`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _120 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admin/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0915915915915916 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._