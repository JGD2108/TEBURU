## 1. Contract and schema foundation

- [x] 1.1 [backend] Define the observation-preserving extraction types for document metadata, hierarchical sections, items, raw/normalized prices, variants, modifiers, options, attributes, source geometry, validation signals, and review reasons.
- [x] 1.2 [backend] Add an additive Supabase migration for rich draft structure, parent sections, price variants, document metadata, validation diagnostics, source bounding boxes, and extraction metrics while preserving tenant isolation and compatibility reads.
- [x] 1.3 [backend] Update server API schemas and draft queries so incomplete items, missing categories, missing prices, variants, and evidence are represented without fabricated defaults.

## 2. Visual PDF analysis pipeline

- [x] 2.1 [analysis] Implement bounded high-resolution page rendering from PDF input with deterministic page numbering, image size limits, and cleanup/timeout handling.
- [x] 2.2 [analysis] Replace the text-only Gemini request contract with multimodal page-image structured output, including dynamic sections, nested hierarchy, item fields, price variants, metadata, confidence evidence, and normalized bounding boxes.
- [x] 2.3 [analysis] Preserve native text/OCR as auxiliary page evidence and implement per-page selection without treating text order as visual structure.
- [x] 2.4 [analysis] Add generic local fallback behavior that never hardcodes fixture categories, names, currencies, positions, or restaurant rules.

## 3. Validation, retries, and reconciliation

- [x] 3.1 [analysis] Implement deterministic structural and semantic validators for merged names, price-only names, multiple prices in names, invalid page references, suspicious categories, decorative content, and sparse-page inconsistencies.
- [x] 3.2 [analysis] Implement bounded problem-specific retries for full pages and difficult visual regions, recording retry reasons and affected regions.
- [x] 3.3 [analysis] Implement document-level reconciliation for section continuation, repeated headings, global price notes, conservative duplicate handling, and conflicts between page results.
- [x] 3.4 [analysis] Combine model signals and deterministic evidence into operational acceptance/retry/manual-review outcomes without treating arbitrary LLM confidence as authoritative.

## 4. Durable worker, lineage, and persistence

- [x] 4.1 [backend] Persist reconciled sections, items, prices, variants, metadata, bboxes, review reasons, and page evidence atomically after external analysis completes.
- [x] 4.2 [backend] Extend analysis lineage and structured logs with analyzer/prompt version, model, page count, calls, retries, duration, tokens when available, suspicious pages, item/review counts, fallbacks, errors, and source hash.
- [x] 4.3 [backend] Preserve lease/attempt guards, idempotency, tenant boundaries, safe provider errors, and the existing needs-review/approval/publication gates.
- [x] 4.4 [security_reviewer] Review multimodal payload boundaries, server-only credentials, source-document authorization, tenant isolation, storage lifecycle, and error sanitization.

## 5. Admin review experience and theme

- [x] 5.1 [frontend] Update draft review types and components to display missing prices as missing, multiple price variants, shared-price provenance, hierarchy, source page/bbox evidence, and review reasons.
- [x] 5.2 [frontend] Restore the established dark semantic palette across shared admin variables and verify contrast/status states in the menu-import review flow.
- [x] 5.3 [frontend] Add edit flows for categories, variants, raw/normalized prices, and reviewable incomplete items without changing publication approval semantics.

## 6. Tests and fixture coverage

- [x] 6.1 [qa] Add provider tests for multimodal request schema, server-only credential handling, raw-price preservation, variants, hierarchy, bboxes, malformed output, and bounded timeouts.
- [x] 6.2 [qa] Add visual/semantic validation tests for columns, tables, multiple sections, continuation, decorative content, merged products, shared prices, and ambiguous pages.
- [ ] 6.3 [qa] Add worker and migration tests for persistence, idempotency, lineage metrics, retries, fallback, tenant isolation, and review-safe incomplete drafts.
- [ ] 6.4 [qa] Add component/API tests proving missing prices are not rendered as `$0.00`, variants/evidence are editable, and dark theme variables are applied.
- [ ] 6.5 [qa] Run the current PDF fixture plus at least two structurally different menu fixtures through upload, analysis, review, correction, and publication validation; document deviations without adding fixture-specific rules.
- [ ] 6.6 [qa] Run lint, unit/integration tests, migration verification, OpenSpec validation, and production-like end-to-end import/review checks.

## 7. Rollout and operational readiness

- [x] 7.1 [backend] Document multimodal model configuration, render limits, retry budgets, token/cost observability, fallback controls, and analyzer versioning.
- [x] 7.2 [backend] Verify deployment environment variables and private storage behavior without exposing Gemini credentials to client code or logs.
- [ ] 7.3 [qa] Validate rollback to the prior analyzer/fallback path and confirm additive schema changes do not alter existing live menus or publication behavior.
