## Why

`menu-import-v4-visual` correctly treats rendered menu pages as the authority for visual structure, but it may need many Gemini calls for one document. The native PDF text already available locally can fit a 28-page fixture in one text prompt, so the project needs isolated evidence of whether a cheaper one-request text-only extraction is useful without changing V4 or the native-PDF spike.

## What Changes

- Add an opt-in, evaluation-only `menu-import-text-only` spike that extracts native PDF text locally, preserves page boundaries and source item order, and sends exactly one text-only structured request to an experimental server-configured model.
- Define a text-only transport DTO, canonical adapter with server-issued IDs, strict document structural validation, text-semantic validation, safe ephemeral lineage, metrics, target-page assessment, and A/B/C/D recommendation.
- Add deterministic tests and an explicit live runner. The evaluator has no OCR, images, PDF binary input, retries, fallback, persistence, drafts, or production side effects.
- Keep the new evaluator isolated from V3, `menu-import-v4-visual`, `menu-import-full-document-evaluation-spike`, workers, dispatcher, UI, Supabase, and migrations.

## Capabilities

### New Capabilities

- `menu-import-text-only-evaluation`: Safely evaluate one complete native-text menu document through one Gemini text-only request, with page/order preservation, canonical adaptation, text-semantic validation, and an evaluation-only report.

### Modified Capabilities

- None.

## Impact

- Adds only evaluation helpers, deterministic fixtures/tests, and an opt-in live evaluation runner.
- May reuse pure PDF.js native-text extraction and canonical validation/identity helpers without changing their existing callers or semantics.
- Uses a spike-exclusive server-side model configuration with `gemini-3.5-flash-lite` as the initial default; it does not change `MENU_IMPORT_GEMINI_MODEL`, V4's `gemini-3.7-flash` default, or API-provider behavior outside the evaluator.
