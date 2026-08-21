## Context

See `proposal.md` for motivation and the completed text-only evaluation spike for the validated request/DTO evidence. Current analyzer selection supports V3 and V4, while the worker already owns job attempts, draft persistence, review projection, lineage, and retryable failure states. The V5 path must join those durable boundaries without importing visual extraction behavior or changing historical analyzer semantics.

## Goals / Non-Goals

**Goals:**

- Promote the proven text-only contract into a server-side V5 analyzer that produces the existing durable `AnalysisResult` shape only after structural and semantic gates.
- Preserve one full-document request as a guarded production cost boundary and keep both native-text evidence and review/issue outcomes traceable.
- Reuse existing persistence and review projections where they satisfy the V5 contract, adding only an additive migration if a required distinction cannot be represented safely.

**Non-Goals:**

- Replacing, wrapping, or otherwise changing V4 visual extraction, its model configuration, image lineage, retries, or fallback behavior.
- OCR, page rendering, images, BBoxes, spatial recovery, automatic price repair, or a broad analyzer-default switch.
- Treating the successful Subarashii evaluation as sufficient evidence for global default promotion.

## Decisions

### 1. Versioned opt-in analyzer: `menu-import-v5-text`

Add V5 to the server-side analyzer-version contract. Its selection remains explicit and defaults remain unchanged for existing jobs; the initial rollout is a controlled opt-in. Job/run records remain the authority for the analyzer that produced historical or in-flight imports.

Alternative: replace V4 or make V5 the global default. Rejected because the evidence covers one menu fixture and V4 is a required independent rollback/future fallback path.

### 2. Dedicated V5 production adapter over shared text-only primitives

Extract or reuse only the spike's import-safe native-text primitives: TextDocument extraction, serialization, preflight, request builder, strict decoder, canonical adaptation, structural validation, semantic validation, and safe report mapping. A V5 adapter maps that canonical result into the existing `AnalysisResult`, sections, draft candidates, lineage, and metrics contracts. It does not call the V4 provider, fallback parser, visual schema, or rendering code.

Alternative: add a mode flag to the V4 provider. Rejected because it would make visual inputs, retries, and fallback behavior reachable from V5.

### 3. One automatic provider request per V5 job

V5 consumes a one-request budget immediately before `generateContent`. The initial production policy permits no automatic provider retry for the same import job, including a later worker retry that would create another full-document request. 429, 503, timeout, malformed JSON, and schema/structural failures become explicit retryable or diagnostic job outcomes; an authorized manual requeue is a deliberate new execution and must be recorded as such.

Alternative: reuse the worker's generic automatic attempt loop. Rejected because it can silently multiply full-document requests and defeat V5's initial cost-control objective.

### 4. Separate V5 server configuration

Use `MENU_IMPORT_TEXT_ONLY_GEMINI_MODEL` with `gemini-3.5-flash-lite` as the V5 default. Keep it server-only, sanitized from diagnostics, and independent from `MENU_IMPORT_GEMINI_MODEL` and V4's default. The V5 request retains `v1beta`, the validated JSON schema, 32,768 output-token cap, and 60-second provider timeout, all versioned in lineage.

Alternative: share V4's model variable and provider defaults. Rejected because it would couple rollout and compatibility decisions between distinct analyzers.

### 5. Structure and semantic gates precede persistence

The V5 adapter must reject malformed, incomplete, duplicate, or out-of-order response pages before reconciliation and persistence. It then assigns server IDs, performs adjacent-only reconciliation, and applies geometry-free semantic validation. `valid` maps to normal draft items, `review` maps to existing editable review drafts, and `invalid` maps only to extraction issues/diagnostics. No stage infers a missing price merely to produce `valid`.

Alternative: project all decoded candidates to drafts and rely on the UI to filter. Rejected because invalid fragments could become normal dishes and structural failures could partially persist a document.

### 6. Native-text lineage without image lineage

Emit safe lineage events for extraction/preflight, provider request/output, decode, structural and semantic validation, reconciliation, projection, persistence, and terminal failure. Events contain PDF/TextDocument hashes, page/text counts, versions, attempt/model, tokens/latency when supplied, validation and persistence links. V5 emits no image fields or storage references and never stores credentials or authorization headers.

Alternative: reuse visual-image event fields with empty values. Rejected because it obscures the authority and evidence type of this analyzer.

### 7. Existing UI with text-specific review affordances

Reuse `MenuImportPanel` and its projection boundaries. Review candidates expose raw price/variants and text validation reasons; `AMBIGUOUS_PRICE` supports editing/assigning a price, confirming the dish, or excluding it. Invalid candidates appear only in the extraction-issue view. No BBox UI is added.

Alternative: create a new V5-only review panel. Rejected because it duplicates existing approval/publish safeguards and review workflows.

### 8. Fixture ladder before wider rollout

Keep Subarashii assertions in test/evaluation code and add deterministic synthetic or recorded fixtures for one-column menus, multi-column native text, variants, poor native text, and scanned/image-only input. A production-equivalent V5 evaluation and controlled V5-vs-V4 comparison occur only after deterministic verification and an explicit live authorization.

Alternative: promote based on a single live evaluation. Rejected because native text ordering and source quality vary materially across PDFs.

## Risks / Trade-offs

- [Risk] Native text reorders multi-column menu content → Preserve source order, use explicit uncertainty/review, and keep V4 selectable rather than inferring geometry.
- [Risk] One request can produce a large output or timeout → Enforce output/timeout bounds, treat truncation as invalid, and do not retry automatically.
- [Risk] Existing draft storage may not distinguish invalid issues from review drafts completely → Inspect current schema/API projections first; add the smallest additive migration only if required.
- [Risk] Existing worker retries can exceed the V5 request contract → Make V5 attempt policy explicit and cover it with deterministic worker tests.
- [Risk] Broad analyzer setting could route jobs unexpectedly → Restrict V5 to explicit opt-in selection and test V3/V4 compatibility/rollback.
- [Risk] Native text can contain sensitive menu content → Retain only bounded sanitized lineage metadata and existing authorized evidence controls; never retain credentials.

## Migration Plan

1. Inspect existing draft, issue, lineage, run, and analyzer-version storage; reuse it if it represents V5 statuses and provenance without ambiguity.
2. If necessary, add a single additive migration for the missing distinction, with no rewrite of historical V3/V4 records.
3. Deploy V5 disabled by default. Enable only explicit opt-in jobs/controlled operators with the dedicated model configuration.
4. Validate deterministic fixtures, then one authorized production-equivalent V5 evaluation and an evidence-only V5/V4 comparison.
5. Roll back by selecting V3 or V4 for new jobs; no destructive migration or reinterpretation of completed imports is required.

## Open Questions

- Whether the current extraction-issue persistence/API projection already preserves every invalid V5 candidate with the required edit/reject linkage will be resolved by schema inspection during Apply. This does not change the gate: invalid candidates must never become normal drafts.
