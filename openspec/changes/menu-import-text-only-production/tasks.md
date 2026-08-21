## 1. Production analyzer contract

- [x] 1.1 Add the explicit `menu-import-v5-text` analyzer version and server-side opt-in selection while preserving V3/V4 defaults, selection, and historical readability.
- [x] 1.2 Add V5-exclusive server configuration with `MENU_IMPORT_TEXT_ONLY_GEMINI_MODEL` defaulting to `gemini-3.5-flash-lite`; prove it does not alter V4's model configuration.
- [x] 1.3 Define V5 execution/result/failure contracts, including `TEXT_NOT_EVALUABLE`, provider-unavailable, malformed-output, valid/review/invalid, and no-fallback semantics.

## 2. Reusable native-text primitives

- [x] 2.1 Refactor or extract the spike's native PDF.js TextDocument extraction, deterministic serialization, hashes, coverage, and sufficiency preflight into import-safe server modules without changing V4 behavior.
- [x] 2.2 Preserve all source pages, TextItem order/index/raw text/separator evidence and ensure sparse `hasEOL` never causes invented layout.
- [x] 2.3 Add V5-safe TextDocument/PDF preflight reporting and zero-request handling for insufficient native text.

## 3. V5 provider integration

- [x] 3.1 Implement the isolated V5 `v1beta` Gemini request using only instructions and serialized native text, the strict text-only schema, the 32,768 output cap, and the 60-second timeout.
- [x] 3.2 Enforce a server-side one-request budget for the full V5 document request and prevent visual, PDF, OCR, page, regional, fallback, secondary-model, and automatic provider-retry paths.
- [x] 3.3 Implement sanitized V5 provider response/error mapping for 429, 503, timeout, non-200, malformed JSON, schema rejection, and truncation.

## 4. Canonical structural and semantic pipeline

- [x] 4.1 Reuse the strict text-only DTO decoder and adapt accepted pages, sections, items, raw prices, variants, and association states to the canonical import hierarchy with server-generated IDs.
- [x] 4.2 Validate expected/returned pages, missing/unexpected/duplicate/out-of-order/malformed structures before reconciliation or persistence.
- [x] 4.3 Apply adjacent-only section continuity with explicit current-page heading precedence and no mutable distant category state.
- [x] 4.4 Apply geometry-free semantic validation for valid/review/invalid, including price-only, multiple-price, merged-name, description-fragment, decorative, missing-section, duplicate, and ambiguous-price signals.
- [x] 4.5 Map canonical V5 results into the existing `AnalysisResult`/section/item contracts without flattening invalid candidates into normal draft items.

## 5. Persistence projection and schema assessment

- [x] 5.1 Inspect the real draft, review, extraction-issue, lineage, and run schema/API projections before changing persistence.
- [x] 5.2 Reuse existing persistence for valid drafts, review candidates, and invalid extraction issues where it meets the V5 contract; preserve raw prices and variants separately from normalized values.
- [x] 5.3 Add only the minimal additive migration if schema inspection proves a required V5 status, issue, or provenance link cannot be represented safely; validate it without changing historical imports.
- [x] 5.4 Enforce persistence gates: valid to normal drafts, review to editable review drafts, invalid to issues only, and provider/non-evaluable/structural failure to no normal drafts.

## 6. Worker and dispatcher integration

- [x] 6.1 Route explicitly selected V5 jobs through the V5 adapter while leaving V3/V4 provider routing and visual behavior unchanged.
- [x] 6.2 Enforce one automatic V5 provider request per import job and make a manual requeue a separately recorded execution rather than an implicit retry.
- [x] 6.3 Map V5 provider-unavailable outcomes to the existing retryable job model and non-evaluable/malformed outcomes to explicit diagnostics without parser fallback drafts.
- [x] 6.4 Preserve job leases, idempotency, authorization, and historical analyzer-version behavior for all analyzer versions.

## 7. Lineage and metrics

- [x] 7.1 Emit safe V5 lineage from native-text extraction/preflight through provider, decode, validation, reconciliation, projection, persistence, and terminal failure.
- [x] 7.2 Persist/report PDF and TextDocument hashes, versions, model, attempt, page/text counts, token usage, latency, request count, structural findings, semantic totals/reasons, and persistence linkage.
- [x] 7.3 Ensure V5 lineage stores no credentials, authorization headers, image metadata/references, or image-lineage events; record fallback usage as none where applicable.

## 8. Existing admin review workflow

- [x] 8.1 Extend the existing `MenuImportPanel` projection minimally to distinguish V5 valid drafts, review candidates, and invalid extraction issues without adding BBox UI.
- [x] 8.2 Make `AMBIGUOUS_PRICE` review candidates editable for price assignment/confirmation or exclusion while retaining raw value and reason provenance.
- [x] 8.3 Verify existing approval/publication rules remain unchanged and invalid/provider-failure outcomes cannot appear as normal dishes.

## 9. Failure, retry, and rollout controls

- [x] 9.1 Add deterministic V5 behavior for 429, 503, timeout, malformed JSON, schema/structural failure, truncation, no-text preflight, and manual requeue boundaries.
- [x] 9.2 Verify automatic V5 fallback usage is none and no error path invokes OCR, visual extraction, a local parser draft fallback, or another model.
- [x] 9.3 Add server-side opt-in/rollback tests proving V5 selection is reversible and V3/V4 remain separately selectable.

## 10. Deterministic integration tests

- [x] 10.1 Add deterministic tests for TextDocument extraction, serialization/order, preflight, request contract, one-request budget, strict decode, server IDs, structural validation, and semantic status transitions.
- [x] 10.2 Add worker/dispatcher/persistence integration tests for valid/review/invalid/provider failure gates, safe lineage/metrics, idempotency, and analyzer-version isolation.
- [x] 10.3 Add review projection/component tests covering editable ambiguous prices, invalid issues, and unchanged approval/publication behavior.

## 11. Subarashii regression fixture

- [x] 11.1 Add evaluation-only regression assertions for pages 2, 3, 4, 5, and 6 independent products and sections.
- [x] 11.2 Assert page 9 preserves ambiguous prices as review rather than creating price-only/garbage valid drafts.
- [x] 11.3 Assert pages 19 and 20 retain current-page headings with no distant category leakage.
- [x] 11.4 Keep fixture-specific names, categories, and prices out of production code.

## 12. Generic fixture suite

- [x] 12.1 Add deterministic synthetic or recorded fixtures for a simple one-column native-text menu, multi-column/reordered native text, and arbitrary price variants.
- [x] 12.2 Add poor-native-text and scanned/image-only fixtures that prove `TEXT_NOT_EVALUABLE`, zero provider requests, and no garbage drafts.
- [x] 12.3 Document a safe strategy and fixture interface for incorporating additional real PDFs without encoding their contents into production heuristics.

## 13. Production-equivalent live evaluation

- [x] 13.1 Create a separately opt-in V5 live runner that checks safe preflight data and authorizes exactly one full-document request only after deterministic checks pass.
- [ ] 13.2 Run one authorized V5 production-equivalent evaluation when credentials and quota are available; capture structural, semantic, lineage, metrics, and persistence-gate evidence without exposing secrets.
- [ ] 13.3 Verify the live execution creates only the intended review/draft/issue outcomes and no visual/OCR/fallback calls.

## 14. Controlled rollout comparison

- [x] 14.1 Prepare a V5-versus-V4 evidence runner/report that compares independent items, invalid fragments, review reasons, category continuity, provider calls, latency, tokens, and provenance without changing defaults.
- [ ] 14.2 Run the comparison only when both analyzers can be evaluated under an explicit authorized quota budget; never invent unavailable live results.
- [x] 14.3 Record a controlled-rollout recommendation and rollback procedure; do not promote V5 to global default automatically.

## 15. Final verification

- [x] 15.1 Run relevant deterministic tests, full suite, typecheck, lint, migration validation if applicable, integration/UI tests, strict OpenSpec validation, and `git diff --check`.
- [x] 15.2 Verify V4 visual, V3, full-PDF evaluation spike, historical imports, Supabase/RLS, and client credential boundaries remain intact.
- [x] 15.3 Run `graphify update .` after implementation changes and report generated graph files.
