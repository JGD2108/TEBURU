## Why

The current menu-import pipeline extracts PDF text locally, but its conservative parser struggles with varied menu layouts, wrapped descriptions, and inconsistent category or price formatting. A server-side Gemini structuring pass can improve the draft while preserving the existing page-level text evidence, OCR path, human review gate, and local fallback.

## What Changes

- Add an optional Gemini-backed structure extraction stage that receives only page-numbered text produced by native extraction or OCR; the original PDF and rendered images are never sent to Gemini.
- Request a constrained JSON response containing categories, item names, descriptions, prices, source pages, and field-level confidence.
- Validate and normalize the model response before draft persistence, rejecting malformed, unsupported, or out-of-range values.
- Fall back to the existing local parser when Gemini is not configured, unavailable, rate-limited, times out, or returns invalid data.
- Keep the provider choice and model configuration server-only, with `GEMINI_KEY` (or the documented server variable) never exposed to the browser.
- Record which structuring provider produced each analysis result for diagnostics and review lineage.
- Add tests for successful structured extraction, invalid model output, provider failure, timeout, fallback, and secret-handling boundaries.

## Capabilities

### New Capabilities

- `menu-import-gemini-structure`: Optional, text-only LLM structuring of extracted menu text with schema validation, fallback behavior, and provider lineage.

### Modified Capabilities

- None.

## Impact

- `src/lib/menu-import/provider.ts` and related menu-import types, worker, and tests.
- Server-only environment configuration and Vercel production environment variables.
- A Gemini API integration, preferably through the existing server runtime and structured JSON response support, without sending source PDFs or images.
- Analysis-run lineage and diagnostics; published menu tables and the existing review-before-publish contract remain unchanged.
