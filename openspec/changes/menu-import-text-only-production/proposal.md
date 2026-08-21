## Why

The completed text-only evaluation proved that a 28-page menu can be extracted with one native-text Gemini request while preserving document completeness and price uncertainty. Production imports need that lower-request path without weakening review gates, fabricating prices, or replacing the independent V4 visual analyzer.

## What Changes

- Add a selectable production analyzer, `menu-import-v5-text`, that reads the stored PDF with PDF.js native text, performs the existing text sufficiency preflight, and sends exactly one full-document text-only structured request to `gemini-3.5-flash-lite` by default.
- Adapt the proven text-only DTO, server-issued identities, structural validation, adjacent-only reconciliation, and geometry-free semantic validation into the existing import result and persistence contracts.
- Route `valid` candidates to normal drafts, `review` candidates to the existing editable review flow, and `invalid` candidates to extraction issues rather than normal dishes. Provider failures and non-evaluable text produce explicit retryable/diagnostic states and no normal drafts.
- Preserve safe lineage and metrics for native text, request/result characteristics, semantic outcomes, and persistence links. The path has no image, OCR, BBox, or image-lineage behavior.
- Make V5 initially opt-in through server-side analyzer selection. V3/V4 remain supported, V4 retains its `gemini-3.7-flash` default, and rollback is selecting V3 or V4 for new jobs.
- Add deterministic generic fixtures plus Subarashii regression assertions exclusively in test/evaluation code, then compare controlled V5 rollout evidence against V4 without changing either analyzer automatically.

## Capabilities

### New Capabilities

- `menu-import-text-only-production`: Selectable, production-safe native-text menu import with one full-document structured request, safe persistence gates, metrics, and controlled rollout.

### Modified Capabilities

- `menu-import-gemini-structure`: Replace its fallback-oriented text-structuring behavior with explicit analyzer-scoped failure semantics so the V5 path never turns a provider failure into indistinguishable local-parser drafts.

## Impact

- Expected implementation scope: analyzer selection, server-side PDF/text provider boundary, worker/dispatcher result projection, lineage/metrics, existing draft/review projection, and tests/fixtures.
- Existing draft, review, issue, lineage, and run storage should be inspected and reused first; any database migration must be additive, minimal, and justified by an unmet contract.
- No changes to `menu-import-v4-visual`, visual request behavior, V4 model configuration, Supabase policy, images, OCR, or client-visible credentials.
