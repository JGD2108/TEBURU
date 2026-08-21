## Why

`menu-import-v4-visual` correctly performs visual extraction page by page, but a 28-page menu needs at least 28 Gemini calls while the observed free-tier project/model quota is 20 calls per day. Before considering any production alternative, the project needs a controlled answer to whether one native-PDF request can return a complete, usable hierarchical document.

## What Changes

- Add an opt-in, evaluation-only full-document Gemini evaluator that accepts one native PDF and makes at most one `generateContent` request.
- Add deterministic preflight, payload-integrity, request-budget, structural-completeness, semantic-validation, metrics, and classification behavior for that evaluator.
- Reuse the canonical V4 document, decoder, server IDs, semantic validation, adjacent-page reconciliation, and safe lineage utilities without changing their production behavior.
- Produce only ephemeral/local evaluation output; do not create imports, drafts, persistence records, textual fallback, retries, or Supabase writes.
- Add isolated `Menu Subarashii.pdf` fixture assertions and an opt-in live runner that can classify a result A/B/C/D without changing V4 automatically.

## Capabilities

### New Capabilities

- `menu-import-full-document-evaluation`: Safely evaluate one native-PDF Gemini request as a complete hierarchical menu document with strict preflight, one-call enforcement, structural validation, V4 semantic validation, and evaluation-only reporting.

### Modified Capabilities

- None.

## Impact

- Evaluation-only helpers, test fixtures, the opt-in full-PDF evaluator, and its runner.
- Reuses `src/lib/menu-import/provider.ts`, `visual-analysis.ts`, and `lineage.ts` through their existing public canonical helpers; it must not alter worker, dispatcher, persistence, V3, V4 production behavior, APIs, Supabase, or migrations.
- Keeps `v1beta/models/{model}:generateContent` and `gemini-3.7-flash` fixed for the spike so API migration is not a confounding variable.
