## Why

The current menu importer sends linear PDF/OCR text to Gemini and persists a flat item model. It therefore loses the visual relationships that define a menu—columns, aligned prices, section boundaries, tables, variants, and continuation across pages—producing merged dishes, incorrect categories, and unreliable prices. The importer must be rebuilt around visual page analysis so arbitrary menus can be converted into reviewable structured drafts without fixture-specific rules.

## What Changes

- **BREAKING** Replace the text-only Gemini structuring contract with page-image multimodal analysis using structured JSON output.
- Render PDF pages at a bounded high resolution and retain page/region source coordinates for evidence.
- Extract dynamic sections, nested sections, items, descriptions, raw prices, normalized prices, variants, modifiers, options, attributes, and document-level price metadata.
- Preserve observed values before normalization, including raw price strings and unresolved currencies.
- Add deterministic semantic validation for merged names, invalid prices, missing/incorrect sections, suspiciously sparse pages, and non-product content.
- Add targeted retries with problem-specific prompts and regional fallback analysis for difficult pages.
- Reconcile page results at document level without blindly inheriting categories or aggressively deduplicating repeated products.
- Extend draft persistence and review evidence to retain hierarchy, variants, bounding boxes, confidence signals, review reasons, and lineage/observability metadata.
- Keep the existing durable worker, tenant isolation, review gate, publication gate, and safe provider fallback behavior.
- Update the review UI to represent missing and multiple prices correctly, expose visual evidence/review reasons, and restore the previous dark interface palette.
- Use the current restaurant PDF only as a regression fixture; add structurally different menu fixtures for validation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `menu-import-gemini-structure`: change the importer from text-only flat extraction to visual multimodal structured menu reconstruction with validation, retries, reconciliation, raw-price preservation, and traceable review output.

## Impact

- `src/lib/menu-import/provider.ts`, `types.ts`, and analysis tests.
- `src/lib/menu-import/worker.ts` and worker lineage/observability handling.
- Additive Supabase migrations for richer draft structure, price variants, metadata, evidence, and validation diagnostics.
- Admin menu-import API responses and `MenuImportPanel.tsx` review/edit rendering.
- PDF rendering/canvas dependencies and Gemini multimodal request configuration.
- Existing upload, durable analysis orchestration, tenant authorization, publication, and rollback paths must remain compatible.
