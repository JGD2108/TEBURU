## 1. Evaluation contracts and isolation

- [x] 1.1 Define evaluation-only TextDocument, text-only transport DTO, structural result, semantic result, safe report, and A/B/C/D contracts without changing V4 or full-PDF spike types/behavior.
- [x] 1.2 Define spike-exclusive server-side model configuration with `gemini-3.5-flash-lite` default and no effect on `MENU_IMPORT_GEMINI_MODEL` or V4 defaults.
- [x] 1.3 Establish an evaluator module boundary that cannot import or invoke worker, dispatcher, V3/V4 analyzers, persistence, drafts, UI, Supabase, migrations, OCR, or full-PDF evaluator execution.

## 2. Native TextDocument extraction

- [x] 2.1 Reuse or extract a dedicated pure PDF.js native-text utility that returns all source pages and ordered TextItems without changing existing caller behavior or using the production 20-page default.
- [x] 2.2 Preserve page number, original TextItem index, raw text, and separator evidence; tolerate sparse `hasEOL` without inventing visual layout.
- [x] 2.3 Implement deterministic, minimal, traceable normalization, TextDocument/PDF hashes, per-page coverage, and the specified insufficient-native-text `not_evaluable` preflight that makes zero provider calls.

## 3. Text serialization and request contract

- [x] 3.1 Serialize every TextDocument page in source order using explicit `=== PAGE n ===` markers while retaining ordered item/separator evidence.
- [x] 3.2 Define the text-only prompt and strict minimal structured transport schema, including required fields, unknown-field rejection, price/description association states, page sections, items, raw prices, and variants, with no BBox, visual confidence, or provider-authoritative IDs.
- [x] 3.3 Build the isolated `v1beta/models/{model}:generateContent` request containing only instructions and serialized native text; verify its payload excludes PDF bytes, images, OCR, supplementary selected-text dumps, coordinates, and visual-provider fields.
- [x] 3.4 Apply the versioned 32,768-token output cap, 60-second timeout, and prompt/schema/serializer versions without altering general provider configuration.

## 4. One-request execution boundary

- [x] 4.1 Implement an execution-local `MAX_GENERATE_CONTENT_REQUESTS = 1` budget consumed immediately before the provider call.
- [x] 4.2 Ensure a second call fails locally before fetch/network and no provider, timeout, semantic, regional, page, fallback, secondary-model, V3, or V4 retry path is reachable.
- [x] 4.3 Implement terminal, sanitized reports for provider errors, timeout, non-200 responses, malformed provider JSON, transport-schema failures, and truncation without a follow-up call.

## 5. Transport decode and canonical adaptation

- [x] 5.1 Decode and validate the strict text-only DTO separately from the visual response schema, retaining only non-authoritative provider hints if needed and rejecting unknown/missing/malformed transport fields.
- [x] 5.2 Adapt valid DTO pages/sections/items to the bbox-optional canonical document hierarchy and generate section, item, and candidate IDs on the server.
- [x] 5.3 Keep transport DTO identity and canonical server identity distinct, and do not flatten or persist the evaluator result.

## 6. Structural and continuity validation

- [x] 6.1 Implement structural validation before reconciliation for JSON validity, exact expected/returned page set, missing/unexpected/non-integer pages, duplicates, original order, malformed pages, malformed sections, malformed items, and empty-source-page coverage.
- [x] 6.2 Define `FULL_TEXT_DOCUMENT_VALID` as strict document completeness independent of semantic candidate status.
- [x] 6.3 Apply page-local category state and adjacent-only reconciliation; enforce explicit current-page heading precedence and prohibit distant category inheritance.

## 7. Geometry-independent semantic validation

- [x] 7.1 Reuse or extract generic text-compatible checks for empty names, price-only names, multiple prices in a name, merged names, decorative/header/footer content, missing sections, and duplicate normalized name/price signals.
- [x] 7.2 Implement conservative generic `DESCRIPTION_FRAGMENT` detection that remains review-biased unless a candidate is clearly non-product.
- [x] 7.3 Implement `AMBIGUOUS_PRICE` handling for uncertain associations and ensure uncertain values become review rather than nearest-price guesses.
- [x] 7.4 Ensure semantic validation does not use BBoxes, visual confidence, IoU, spatial deduplication, or regional merge.

## 8. Metrics, safe lineage, and classification

- [x] 8.1 Produce safe ephemeral evaluation provenance for PDF/TextDocument hashes, serializer/prompt/schema versions, model/API metadata, request count, input characters, token estimates/usage, latency, finish reason, and response bytes.
- [x] 8.2 Report structural findings, total sections/items, valid/review/invalid totals, required validation-reason counts, and target-page summaries without raw secrets, authorization headers, durable lineage, drafts, or DB writes.
- [x] 8.3 Implement versioned generic A/B/C/D evaluation-only classification using the approved structural, invalid/review/ambiguity-rate thresholds, finish reason, and fixture assessment; never alter production selection or rollout.

## 9. Deterministic tests

- [x] 9.1 Add tests for PDF.js TextDocument pages, explicit page markers, original item order, sparse/missing `hasEOL`, deterministic normalization, hashes, insufficient/scanned native-text preflight, per-page coverage, and zero provider calls on source preflight failure.
- [x] 9.2 Add request-contract tests proving text-only input and exclusion of PDF/image/OCR/BBox/selected-text/visual fields.
- [x] 9.3 Add one-request tests for immediate budget consumption, blocked second network attempt, and terminal 400/429/500/503/timeout/malformed JSON/schema/truncation outcomes with no retry/fallback.
- [x] 9.4 Add DTO/canonical tests for required/unknown fields, no visual fields, repeated/missing provider hints, server-generated IDs, valid full document, missing/unexpected/duplicate/out-of-order/malformed pages, and structural evidence before reconciliation.
- [x] 9.5 Add semantic tests for valid/review/invalid outcomes, price-only, multiple prices, merged item, description fragment, ambiguous price, missing section, decorative content, duplicate normalized item, and no geometry dependency.
- [x] 9.6 Add continuity tests for fresh page state, adjacent continuation only, explicit-heading precedence, and no distant category leakage.
- [x] 9.7 Add tests proving fixture assertions for pages 2, 3, 4, 5, 6, 9, 19, and 20 are evaluation-only, fixture inputs do not mutate between tests, and no persistence/fallback/production imports are reached.
- [x] 9.8 Add safe-report/classification tests for metrics, secret redaction, A/B/C/D, and no automatic analyzer or rollout side effect.

## 10. Opt-in live evaluation and handoff

- [x] 10.1 Add an opt-in, server-side-credential runner that prints safe TextDocument preflight data and remains excluded from normal CI when its live flag is absent.
- [x] 10.2 Execute exactly one authorized live evaluation only when credentials and quota are available; capture its terminal result without retries or persistence.
- [x] 10.3 Produce the live evidence report for pages 2, 3, 4, 5, 6, 9, 19, and 20 and an A/B/C/D recommendation without changing production architecture.

## 11. Verification and isolation proof

- [x] 11.1 Run relevant deterministic tests, the deterministic menu-import suite, typecheck, lint, strict OpenSpec validation, and git diff checks without Gemini calls.
- [x] 11.2 Verify V4, the full-PDF spike, worker, dispatcher, persistence, drafts, UI, Supabase, migrations, and fixture-free production logic remain unchanged.
- [x] 11.3 Run `graphify update .` after implementation changes and report any generated graph files.
