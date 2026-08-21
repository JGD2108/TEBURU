## Context

See `proposal.md` for the confirmed Explore findings and motivation. The current visual path already renders each PDF page to JPEG and sends it to Gemini, while also sending substantial native/OCR/selected text. The current system also has a separate `parseMenuText()` fallback, page retries and regional retries, a global `previousSection` reconciliation value, and a flattening step that removes useful item context.

The design must preserve the existing server-only provider boundary and page-by-page Gemini operation. It must work for arbitrary menu layouts and languages; `Menu Subarashii.pdf` is only a regression fixture.

## Goals / Non-Goals

**Goals:**

- Establish durable lineage first, then change behavior behind the same import workflow.
- Make page-level Gemini perception image-led while preserving OCR/text as controlled evidence.
- Keep a canonical hierarchical document through validation and reconciliation.
- Make invalid fragments non-persistable, while preserving plausible ambiguity for review.
- Make retries reason-specific and region-aware, with deterministic deduplication and provenance.
- Reconcile only adjacent page continuity conservatively and preserve section identity.
- Support raw and normalized prices, including multiple variants and unknown currencies.
- Provide measurable evidence for regression and rollout decisions.

**Non-Goals:**

- Sending the entire PDF or all 28 pages in one Gemini request.
- Replacing Gemini with OCR, redesigning the whole admin panel, or changing catalog publication rules.
- Adding restaurant-, language-, category-, page-, dish-, or currency-specific production heuristics.
- Making every bbox mandatory for every successful extraction.
- Solving previously unconfirmed causes beyond the Explore findings.

## Decisions

### 1. Two-stage rollout: lineage before behavior

Stage 1 instruments the current pipeline at each boundary without changing acceptance semantics. Every attempt receives an `analysisRunId`, `pageNumber`, `attemptId`, `sourceKind`, extractor version, and optional region ID. Raw provider output is stored by bounded policy or content-addressed reference; decoded, validated, reconciled, normalized, and persistence events reference the same lineage.

Stage 2 changes input composition, semantic gates, retry selection, fallback isolation, reconciliation, and delayed flattening. This ordering lets fixture tests and operators prove whether a bad item came from Gemini, fallback, retry, regional retry, or post-processing.

### 2. Image-only primary Gemini contract with controlled text

The primary page request contains only the rendered image, extractor instructions/schema, page number, and minimum technical metadata required by the provider. The prompt explicitly labels the image as `VISUAL SOURCE OF TRUTH`. Native text/OCR/selected-text page dumps are never included in this request. If a future provider requires documentary context, it must be structured metadata (for example document/page identity), not page text.

Text remains available in a separate evidence object. It can be used in a targeted retry for transcription or price clarification, with `AUXILIARY TEXT` labels and source type, length, reason, attempt, page, and region metadata. The retry must still ask Gemini to preserve image-derived boundaries. This retains OCR's benefit for low-resolution or difficult text without allowing linear text to dictate layout.

Alternatives rejected: removing OCR entirely loses useful transcription evidence; continuing to send all text in the primary request preserves the confirmed architectural risk; using text as an independent equivalent extractor makes source precedence ambiguous.

### 3. Server-generated IDs and one canonical bbox system

Gemini returns visual structure, not trusted identifiers. After decode, server code assigns every item, section, candidate, attempt, lineage event, and reconciled section a unique ID scoped by analysis run, page, attempt, local ordinal/source, or the equivalent deterministic strategy. A retry never depends on the model repeating an ID. Cross-attempt association uses provenance, bbox/evidence, and reconciliation signals.

The canonical bbox is:

```ts
interface NormalizedBBox {
  x: number;      // 0..1, left edge
  y: number;      // 0..1, top edge
  width: number;  // 0..1
  height: number; // 0..1
}
```

The origin is the top-left corner of the exact image sent to the model. The provider adapter converts any provider coordinates during decode. Regional retries may use rendered-image pixels internally, but conversion to/from the normalized form uses the stored image width/height, MIME, and image hash. Conversion clips to the image bounds and is deterministic. Regional merge uses explicit IoU/overlap helpers and never compares incompatible coordinate systems.

The analyzer returns a page result containing `sections[]` and `items[]`; it does not flatten until the persistence adapter or UI projection requires it. A logical reconciled section identity is separate from a page-attempt section ID. Raw fields and extraction metadata remain alongside normalized fields.

`bbox` is highly recommended for every item and section when Gemini can provide it, but not required for ordinary successful pages. It becomes required for regional retries, overlap decisions, and any item whose validation/reconciliation depends on spatial evidence. Missing bbox is recorded as a signal rather than making the entire extraction fragile.

### 4. Structured validation as a gate, not a boolean

Schema validation handles malformed shape, page references, IDs, and primitive types. Semantic validation returns `{ status, reasons[] }` for each item and an aggregate page result. `valid` may enter the accepted candidate set; `review` remains visible but is not presented as clean; `invalid` is excluded from normal draft items and may be retained as an issue record.

`retry_exhausted` describes execution history, not quality. It never overrides an `invalid` semantic result. A plausible item with an ambiguous price may become `review`; an isolated `$30`, description fragment, decorative fragment, or unresolved merged name cannot become a normal product merely because retries ended.

### 5. Explicit call budgets and reason-specific retries

The default server-configurable semantic budget per page is exactly one primary visual attempt, at most one semantic full-page retry, and at most two regional semantic retries. A regional retry consumes one of the two regional slots even when the region is selected after a full-page retry. Provider-transient retries for networking, rate behavior, or equivalent transport failures have a separate bounded budget and counters; they do not silently create additional semantic attempts. No retry loop may continue without an exhausted budget or terminal outcome.

The retry planner maps existing validation reasons to focused prompts and bounded attempts:

- `MERGED_NAME`: emphasize independent visual entries, columns, vertical separation, price alignment, descriptions, and typography.
- `PRICE_ONLY_NAME` or `DESCRIPTION_FRAGMENT`: inspect the immediately associated visual product and verify whether the candidate is a field fragment rather than an item.
- `MISSING_SECTION` or `AMBIGUOUS_SECTION`: re-check headings and section boundaries.
- Dense/low-confidence page: request regional extraction using selected regions.

Each retry records its reason and prompt/extractor version. An identical retry is allowed only as a provider-level transient retry and remains distinguishable from a semantic retry.

Metrics include attempts/page, semantic full-page retries, regional retries, provider-transient retries, and recovery rate.

### 6. Regional replacement, not concatenation

Regions are explicit rectangles in rendered-image coordinates with a region ID, parent page, and attempt. A regional result is first clipped to its region and then compared with page-level candidates using bbox overlap, normalized raw/name similarity, price compatibility, and section context. Overlapping candidates are resolved by a precedence policy: a successful targeted repair replaces the affected invalid/ambiguous candidate; a valid page-level candidate is retained unless the regional result has stronger spatial evidence; non-overlapping candidates are added only when their bboxes and section context show they are new.

Deduplication emits a merge record listing all contributing candidate IDs. It never silently drops provenance. A regional retry cannot rebuild or replace unaffected page areas.

### 7. Explicit adjacent-page reconciliation

After all page candidates are canonical and validated, a reconciler walks pages in order. It maintains only the immediately prior page's eligible section summaries, not an unbounded global `previousSection`. A continuation link requires evidence such as `continuationOf`, no clear new heading, compatible visual structure, compatible semantics, and adjacency. A new clear heading wins over continuation metadata. Distant sections can be matched for diagnostics or global metadata but cannot be inherited as the active category without explicit adjacent evidence.

The reconciler outputs page section IDs plus logical document section IDs, a continuity decision, and evidence/reason codes. Gemini remains page-scoped; document-level reasoning belongs to this controlled pipeline phase.

### 8. Fallback role and page state

`parseMenuText()` is isolated as evidence/recovery for pages that cannot be rendered or when configured diagnostics need a text comparison. It starts with no category on every page. Its candidates carry `sourceKind: textual-fallback` and cannot be indistinguishable from visual candidates. For a renderable page with visual semantic failure, text may inform review or a targeted retry but does not automatically create a clean draft.

### 9. Raw/normalized price separation

The canonical price stores `raw` and optional parsed `amount`/`currency`; variants additionally store an unconstrained visual `label`. Normalization may parse `$45` into amount `45`, but raw extraction is immutable evidence. Currency inference is separate and never assumes `$` means USD.

### 10. Persistence and storage strategy

The persistence adapter receives only accepted valid items for normal draft item creation. Review items and rejected fragments use existing review/diagnostic channels where possible and retain lineage references. First implementation should reuse existing JSON/evidence columns or server-side diagnostic storage. A Supabase migration is justified only if current persistence cannot represent item status, provenance reference, or lineage event identity without overwriting data; then it should be additive, tenant-scoped, and backward-compatible.

Full rendered images are not duplicated in lineage. Store the render hash, dimensions, byte size, MIME, and a storage reference when retention policy permits. Durable lineage always retains analysis run, page, attempt, source kind, extractor/model version, retry reason, region reference, item/section provenance references, validation status/reasons, reconciliation decisions, and final persistence linkage. Store the raw provider response under configurable bounded debug retention, defaulting to 7 days; after expiry, retain its hash/reference and decoded/validation summaries. Credentials, authorization headers, provider credentials, and unnecessary sensitive provider error internals never enter lineage.

### 11. Compatibility and versioning

Introduce the behavior under the explicit analyzer/extractor identifier `menu-import-v4-visual` while keeping the existing provider/API envelope compatible where possible. The worker/dispatcher selects the version through server configuration or import metadata. Existing imports remain readable; v3 remains available for comparison and rollback of new jobs. The API and UI add optional status/provenance fields rather than changing the meaning of existing accepted draft records.

### 12. Architecture diagrams

Current confirmed flow:

```text
PDF
  -> render page JPEG
  -> Gemini image + large native/OCR/selected text
  -> page decode / visual reconcile
  -> optional parseMenuText() fallback (category state can leak across pages)
  -> retries / regional results
  -> flattenVisualDocument() (drops sectionKey, bbox, reasons, signals)
  -> accepted can include unresolved invalid results
  -> draft persistence
```

Proposed flow:

```text
PDF
  -> render page + render metadata/hash
  -> page visual extraction (image-only primary, technical metadata only)
  -> schema decode
  -> structured semantic validation
  -> reason-specific page/region retry when needed
  -> canonical page result with attempt/source/bbox/raw/provenance
  -> adjacent-page document reconciliation with continuity evidence
  -> normalization without destroying raw values
  -> accepted/review/invalid projection
  -> persistence of acceptable draft items + lineage references
```

### Testing design

Deterministic automated tests use mocked provider responses, recorded sanitized responses, and synthetic page/candidate structures. They cover decode, schema and semantic validation, status transitions, retry planning, bbox conversion/clipping/IoU, regional merge/deduplication, reconciliation, fallback isolation, persistence gates, and API/UI projections. These tests do not require live Gemini credentials and must be stable under model variation.

Live Gemini evaluation is a separate workflow for Subarashii and generic fixtures. It records structural metrics and lineage, may require provider credentials, and is not a prerequisite for every deterministic CI test.

Deduplication thresholds are generic centralized configuration, not scattered constants. The conceptual signals are bbox overlap/IoU, normalized name similarity, raw price compatibility, section context, and source attempt/retry relationship. Calibration uses synthetic fixtures and multiple layouts; Subarashii is only one evaluation fixture.

### Open Design Decisions

- **Physical lineage location:** existing JSON/evidence storage versus a dedicated additive table remains an implementation choice after schema capacity inspection. The durable fields, security rules, and seven-day RAW policy are fixed; this does not block Apply.
- **Operational deduplication values:** numeric thresholds remain configuration values to calibrate against synthetic and multi-layout fixtures. The algorithm, coordinate system, and centralization requirement are fixed; this does not block Apply.
- **Exact UI route for rejected fragments:** the semantics are fixed, but the minimal compatible representation may be an existing diagnostic payload or an additive review field. Apply must choose the option that preserves current API compatibility.

## Risks / Trade-offs

- [Risk] Less auxiliary text in the primary request can reduce transcription quality on poor scans → retain OCR as evidence and use targeted text-assisted retries with explicit lineage.
- [Risk] Conservative continuity creates more `review` results at page boundaries → require evidence metrics and expose continuity reasons rather than guessing a distant category.
- [Risk] Bbox quality varies by model response → make it highly recommended generally and mandatory only where spatial reconciliation depends on it; record missing-bbox signals.
- [Risk] Raw response retention increases cost/privacy exposure → use hashes/storage references, bounded debug retention, redaction, and server-only access.
- [Risk] New semantic states may expose previously hidden bad data → keep accepted persistence strict and provide review/issue projections so information is not silently discarded.
- [Risk] Versioned analyzer results may differ from existing drafts → use fixture regression, lineage comparison, feature-gated rollout, and rollback by analyzer version.
