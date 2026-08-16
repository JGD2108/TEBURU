## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Subagents for OpenSpec changes

This project uses OpenSpec for spec-driven development. For any active change under `openspec/changes/`, use specialized subagents instead of doing everything in one conversation.

### Available subagents

- `backend` – Database migrations, storage config, shared types, admin/import APIs, background jobs, and transactional publication logic.
- `analysis` – PDF text/OCR extraction pipeline, structured analysis, confidence logic, and mapping results to draft categories/items with source-page evidence.
- `frontend` – Admin import entry point, draft review UI, edit/approve flows, validation feedback, and component/route tests.
- `qa` – Cross-cutting unit/integration/E2E tests, lint, migration verification, and end-to-end admin upload/review/publish flow validation.
- `security_reviewer` (read-only) – Review storage auth, authorized source access, tenant isolation, transaction safety, and file-upload handling.

### When to spawn each subagent

Use these rules when working on an OpenSpec change (e.g. `add-menu-pdf-import`):

- **Schema, storage, APIs, jobs, publication logic**  
  When you need to:
  - define or modify database tables/migrations,
  - configure private storage and authorization rules,
  - implement admin/import/publication APIs,
  - implement background job orchestration or retry logic,  
  → spawn the `backend` subagent.

- **PDF/OCR pipeline and draft generation**  
  When you need to:
  - configure PDF text extraction, page rendering, OCR, and structured extraction,
  - implement durable background analysis jobs,
  - convert analysis results into draft categories/items with confidence and source-page references,
  - apply image-association confidence policy,  
  → spawn the `analysis` subagent.

- **Admin UI for import, review, and validation**  
  When you need to:
  - add a PDF import entry point and import-status view,
  - build the draft review interface (categories, items, prices, descriptions, confidence, images, source evidence),
  - add edit/remove/approve actions and validation feedback,  
  → spawn the `frontend` subagent.

- **Testing and end-to-end validation**  
  When you need to:
  - add unit/integration tests for PDFs, uploads, analysis, review, and publication,
  - add component/route tests for the review flow,
  - run lint, unit tests, migration verification, and an E2E admin upload/review/publish flow,  
  → spawn the `qa` subagent.

- **Security and isolation review**  
  When you need to:
  - review storage authorization and lifecycle rules,
  - review authorized source-document access and tenant isolation,
  - review transactional safety and public image delivery,
  - review file-upload handling for safety,  
  → spawn the `security_reviewer` subagent (read-only).

### Using subagents with `openspec apply`

For each OpenSpec change:
1. **Delegate work to subagents**  
   In your main agent session, instruct it like this (example):

   > We are implementing the OpenSpec change `add-menu-pdf-import`.  
   > Read the proposal and spec deltas under `openspec/changes/add-menu-pdf-import/`.  
   >  
   > - Spawn `backend` to implement migrations, storage config, shared types, admin/import APIs, background job orchestration, and the append-publication API.  
   > - Spawn `analysis` to implement the PDF/OCR extraction pipeline, confidence logic, and draft category/item generation.  
   > - Spawn `frontend` to implement the admin import entry point, draft review UI, edit/approve flows, and validation feedback.  
   > - Spawn `qa` to add unit/integration/component/E2E tests and run lint + migration verification + an end-to-end admin upload/review/publish flow.  
   > - Optionally spawn `security_reviewer` to review storage auth, tenant isolation, and file-upload handling.  
   >  
   > Each subagent must:
   > - Read the OpenSpec change first.
   > - Keep implementation scoped to the approved proposal/spec deltas.
   > - Run relevant tests and report deviations from the spec.

2. **Archive the change**  
   When tests and validation are green:

   ```bash
  $openspec-archive-change
   ```

This pattern ensures that every OpenSpec change is implemented by specialized subagents with clear boundaries, while `AGENTS.md` encodes when and how to call them.
