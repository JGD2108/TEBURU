## 1. Contracts and compatibility baseline

- [x] 1.1 Inventory the existing menu-import types, API envelopes, persistence fields, and analyzer version selection without changing behavior.
- [x] 1.2 Define the canonical page/section/item contracts by adapting existing shared types, including raw prices, price variants, `NormalizedBBox`, source page, confidence, validation state, and provenance references.
- [x] 1.3 Define server-generated ID factories for item, section, candidate, attempt, lineage event, and reconciled section IDs; ensure model-provided IDs are non-authoritative and cross-attempt association uses provenance/evidence.
- [x] 1.4 Define the shared validation reason vocabulary and exact status transitions for `valid`, `review`, `invalid`, and `retry_exhausted`, reusing existing reason names.
- [x] 1.5 Define backward-compatible API and UI projections for accepted items, editable review candidates, and rejected extraction fragments.

## 2. Stage 1 — lineage and observability foundation

- [x] 2.1 Add an analysis-run/attempt lineage model covering server-generated IDs, page, source kind, extractor version, attempt, retry reason, region, parent attempt, and final persistence linkage.
- [x] 2.2 Instrument rendered-page metadata: page number, MIME, dimensions, byte size, content hash, and storage reference where applicable.
- [x] 2.3 Instrument Gemini calls with model, prompt/extractor version, attempt, page/region, image inclusion, auxiliary text type/length, latency, and token usage when exposed by the SDK.
- [x] 2.4 Capture raw provider output using configurable bounded retention with a seven-day default or a content-addressed debug reference, then record decoded, validated, reconciled, normalized, and persistence events linked to the same lineage.
- [x] 2.5 Sanitize lineage and diagnostics so credentials, sensitive provider errors, and oversized duplicated image payloads are not exposed to clients or stored unnecessarily.
- [x] 2.6 Add lineage inspection/debug output sufficient to trace any item from render through persistence without changing acceptance behavior.
- [x] 2.7 Add Stage 1 tests proving Gemini receives the rendered image, primary input contains no OCR/native/selected-text dumps, and each emitted candidate can be attributed to an exact server-generated attempt/source.

## 3. Visual-first page extraction

- [x] 3.1 Update the primary Gemini request contract to be image-only for page content, with only extractor instructions/schema, page number, and minimum technical metadata; prohibit native/OCR/selected-text dumps.
- [x] 3.2 Preserve OCR/native text as typed auxiliary evidence with bounded size and explicit source metadata.
- [x] 3.3 Implement the page-scoped structured response for `pages[].sections[].items[]`, including independent visual items, source page, raw values, and single/multiple prices, while assigning all stable IDs server-side after decode.
- [x] 3.4 Add schema decoding and primitive validation for page references, server-generated IDs, price shapes, normalized bbox coordinates, clipping, and unknown/malformed fields.
- [x] 3.5 Add deterministic bbox conversion helpers for provider formats and pixel regions, including image metadata/hash, clipping, round-trip conversion, IoU, and overlap tests.
- [x] 3.6 Keep the hierarchical visual document intact through extraction and validation; defer flattening to a persistence/UI projection adapter.
- [x] 3.7 Add deterministic tests for one-column, two-column, table, multi-category, no-description, and multi-price layouts without restaurant-specific production rules.

## 4. Semantic validation and persistence gates

- [x] 4.1 Implement structured item validation results with status and reasons for price-only names, multiple prices in names, merged names, description/decorative fragments, missing/ambiguous sections, ambiguous prices, and low visual confidence.
- [x] 4.2 Implement the distinction between plausible-but-ambiguous products (`review`) and likely non-products (`invalid`/rejected fragment).
- [x] 4.3 Prevent invalid candidates and unresolved invalid `retry_exhausted` candidates from entering the normal accepted draft payload.
- [x] 4.4 Preserve invalid fragments and their evidence/lineage in diagnostics or review data without representing them as normal menu items.
- [x] 4.5 Keep raw visual prices separate from parsed amount/currency normalization and support arbitrary variant labels and unknown currencies.
- [x] 4.6 Add unit/integration tests proving `$30`, description fragments, merged names, and unresolved invalid retries are not persisted as valid products.

## 5. Targeted page and regional retries

- [x] 5.1 Implement a reason-to-retry planner for merged names, price/description fragments, missing sections, low-confidence output, and dense pages.
- [x] 5.2 Enforce server-configurable defaults of 1 primary visual attempt + 1 semantic full-page retry + 2 regional semantic retries per page, with a separate bounded provider-transient retry budget.
- [x] 5.3 Add retry metadata and prompts that preserve page-level image authority and distinguish transient provider retries from semantic correction retries, recording source type, text length, reason, attempt, page, and region for text-assisted retries.
- [x] 5.4 Define rendered-coordinate region records with region ID, pixel bbox, canonical normalized bbox, parent page, source attempt, and retry reason.
- [x] 5.5 Implement spatial merge behavior using centralized configurable thresholds for IoU/overlap, normalized name similarity, raw price compatibility, section context, and source attempt/retry relationship instead of blind array concatenation.
- [x] 5.6 Implement targeted replacement of failed/ambiguous areas while preserving unaffected page-level candidates and all contributing provenance.
- [x] 5.7 Add deterministic tests for budgets, transient retry separation, regional conversion, overlap, duplicate prevention, fragment prevention, precedence, replacement, and provenance preservation.

## 6. Fallback isolation and document reconciliation

- [x] 6.1 Refactor textual fallback execution so every page starts with empty category state and no mutable category survives the page loop.
- [x] 6.2 Mark textual fallback candidates distinctly and route them to evidence/review unless the configured non-renderable-page policy explicitly permits recovery.
- [x] 6.3 Implement page-order document reconciliation with only adjacent-page continuity candidates, logical document section IDs, and explicit continuity evidence.
- [x] 6.4 Ensure a clear current-page heading overrides continuation metadata and distant prior sections cannot be inherited automatically.
- [x] 6.5 Preserve page section IDs, section keys, item IDs, bboxes, validation reasons, attempt/source metadata, and reconciliation decisions through normalization.
- [x] 6.6 Add integration tests for adjacent continuation, new headings, missing headings, distant category leakage, and text fallback page isolation.

## 7. Persistence, APIs, and review UI

- [x] 7.1 Update worker/dispatcher/provider orchestration to run lineage, canonical page validation, targeted retries, reconciliation, normalization, and final projection in that order.
- [x] 7.2 Update menu-import APIs to expose only the minimum safe status/provenance/review fields needed by the admin workflow while preserving existing accepted payload compatibility.
- [x] 7.3 Update `MenuImportPanel` minimally to distinguish valid items, editable review candidates, and rejected extraction fragments/issues; invalid fragments must not render as normal dishes with a category selector.
- [x] 7.4 Verify whether existing Supabase JSON/evidence structures can store lineage and statuses; if not, implement only the additive, tenant-scoped migration justified by that finding.
- [x] 7.5 Add persistence tests proving accepted items retain provenance references and invalid fragments do not become normal draft rows.

## 8. Regression fixtures and quality metrics

- [ ] 8.1 Add Subarashii regression assertions for pages 2, 3, 4, 5, 6, 9, 19, and 20 covering independent items, invalid fragments, complex prices, section boundaries, and no distant category leakage.
- [ ] 8.2 Add generic future fixtures for one-column, two-column, scanned, wine-table, S/M/L, no-description, multi-category, adjacent continuation, and ambiguous-currency menus.
- [x] 8.3 Add metrics for valid item rate, invalid fragment rate, retry rate, retry recovery rate, pages requiring review, average items/page, merged-item detections, category leakage, fallback usage, and visual/textual source rates.
- [x] 8.4 Ensure fixture assertions measure structure, provenance, and invalid-item prevention rather than only the count of `needs_review` records.
- [x] 8.5 Centralize all deduplication thresholds and evaluate them against synthetic and multiple-layout fixtures; Subarashii must remain only one evaluation fixture.

## 9. Versioned rollout and verification

### Checkpoint A — Stage 1 only

- [x] 9.1 Introduce the explicit analyzer identifier `menu-import-v4-visual` behind configuration/import metadata while keeping v3 available for existing imports, comparison, and rollback.
- [x] 9.2 Run Stage 1 lineage verification on representative imports and prove the trace `render → provider → decode → validate → flatten → persistence` for every candidate without changing acceptance behavior.
- [x] 9.3 Stop and resolve any lineage gap before continuing; do not enable Stage 2 if candidate origin cannot be attributed.

### Checkpoint B — Stage 2 behavioral architecture

- [x] 9.4 Enable image-only primary extraction, server-generated IDs, canonical bbox conversion, semantic gates, bounded targeted retries, regional reconciliation, fallback isolation, adjacent document reconciliation, and delayed flattening.
- [x] 9.5 Run deterministic unit/integration/API/UI tests without live Gemini credentials, including status transitions, review promotion, invalid-fragment gates, bbox, dedup, reconciliation, and persistence.

### Checkpoint C — comparison and evaluation

- [ ] 9.6 Run separate live Gemini evaluation for Subarashii and generic fixtures, recording structural metrics and lineage without making deterministic CI depend on provider variation.
- [ ] 9.7 Compare v3/v4 structural metrics and lineage evidence, document deviations, and promote or roll back only after the acceptance criteria are satisfied.
- [x] 9.8 Run lint, typecheck, deterministic tests, relevant end-to-end admin import/review/persistence tests, and `graphify update .` after implementation.
