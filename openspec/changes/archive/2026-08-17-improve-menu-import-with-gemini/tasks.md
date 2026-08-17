## 1. Configuration and provider boundary

- [x] 1.1 Define server-only Gemini configuration with `GEMINI_KEY` compatibility, canonical model/timeout variables, and safe defaults; document local and Vercel setup without exposing secrets.
- [x] 1.2 Add a Gemini text-structuring adapter behind the existing menu-import provider boundary using structured JSON output and page-numbered text input only.
- [x] 1.3 Add deterministic prompt/schema rules for categories, names, descriptions, prices, source pages, and field-level confidence, including bounded page-chunk handling for large extracted documents.

## 2. Validation and fallback

- [x] 2.1 Implement response decoding, schema validation, normalization, page-reference checks, non-negative price checks, and rejection of unusable item names before draft persistence.
- [x] 2.2 Implement bounded timeout, sanitized error handling, and local-parser fallback for missing configuration, provider errors, quota/rate limits, timeouts, and invalid model output.
- [x] 2.3 Ensure no PDF bytes, rendered images, image assets, API keys, or raw provider error details enter the Gemini payload, logs, evidence, or client responses.

## 3. Lineage and persistence

- [x] 3.1 Add additive analysis-run lineage for structure provider, model, and sanitized fallback reason, reusing existing analyzer metadata where safe and adding a migration only when required.
- [x] 3.2 Thread provider lineage through worker outcomes and existing review diagnostics while preserving draft isolation and review-before-publication behavior.

## 4. Verification and rollout

- [x] 4.1 Add unit tests for text-only payload construction, successful structured extraction, schema failures, invalid pages/prices, and normalization.
- [x] 4.2 Add fallback and security tests covering absent keys, provider failures, timeouts, rate limits, secret non-leakage, and preservation of local parser output.
- [x] 4.3 Add representative native-text and OCR-text fixtures and verify draft categories, items, prices, descriptions, confidence, page evidence, and lineage.
- [x] 4.4 Run type checking, lint, focused menu-import tests, migration verification if applicable, and a production-like smoke test with Gemini disabled and enabled before rollout.
