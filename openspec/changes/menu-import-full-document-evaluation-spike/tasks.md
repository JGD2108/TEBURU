## 1. Evaluation contract and compatible types

- [x] 1.1 Define evaluation-only result, preflight, structural-validation, metrics, and A/B/C/D classification contracts without changing production V4 types or behavior.
- [x] 1.2 Reuse the canonical V4 document/decode/server-ID/semantic-validation interfaces, documenting any experimental schema projection as explicitly compatible.

## 2. Deterministic preflight and payload integrity

- [x] 2.1 Implement local PDF preflight for existence, MIME, nonzero bytes, page count, SHA-256, and optional fixture hash/page expectations.
- [x] 2.2 Implement detached-buffer-safe PDF inspection using a copied PDF.js input while preserving the original outbound buffer.
- [x] 2.3 Verify Base64 round-trip bytes/hash and the exact outgoing inline PDF part before any request budget is consumed.

## 3. One-request budget guard

- [x] 3.1 Implement an execution-local `MAX_GENERATE_CONTENT_REQUESTS = 1` guard consumed immediately before provider access.
- [x] 3.2 Ensure every HTTP error, timeout, malformed response, and attempted second call terminates without retries, fallback, or another provider request.

## 4. Native PDF request builder

- [x] 4.1 Build the evaluation-only `v1beta/models/gemini-3.7-flash:generateContent` request with prompt plus `application/pdf` inline data only.
- [x] 4.2 Configure JSON structured output and `maxOutputTokens = 65536`, reusing the V4 schema fully where feasible or an explicitly compatible projection.
- [x] 4.3 Ensure no OCR/native/selected-text dump, page render, page-by-page request, provider retry, semantic retry, regional retry, or fallback path is reachable.

## 5. Structural document validation

- [x] 5.1 Implement evaluation-only validation for JSON/schema decode, malformed pages/sections/items, expected page set, missing pages, duplicates, and original response order.
- [x] 5.2 Ensure structural results are recorded before reconciliation can sort or otherwise mask page-order evidence.
- [x] 5.3 Define `FULL_DOCUMENT_EXTRACTION_VALID` as requiring strict structural completeness, independent of semantic item status.

## 6. Canonical decode, server IDs, and semantic validation

- [x] 6.1 Decode successful responses to the canonical V4 hierarchy and assign server-generated section, item, and candidate IDs after decode.
- [x] 6.2 Reuse V4 semantic validation and adjacent-page reconciliation without persistence or flattening into production draft payloads.
- [x] 6.3 Keep structural incompleteness distinct from valid/review/invalid item outcomes.

## 7. Evaluation metrics and ephemeral lineage

- [x] 7.1 Produce sanitized in-memory/local evaluation lineage with request/PDF/payload hashes, endpoint/API/model, HTTP status, latency, tokens, finish reason, response bytes, and structural findings.
- [x] 7.2 Report all required safe metrics: page completeness, totals, semantic status counts, validation-reason counts, and final result; exclude credentials, headers, raw secrets, Supabase writes, and durable lineage.

## 8. Result classification and fixture assessment

- [x] 8.1 Implement evidence-based A/B/C/D classification with no automatic analyzer selection, rollout, retry, or production side effect.
- [x] 8.2 Add evaluation-only Subarashii assessment for pages 2, 3, 4, 5, 6, 9, 19, and 20, covering item independence, fragments, complex prices, section context, and distant-continuity observations.

## 9. Deterministic recorded tests

- [x] 9.1 Add deterministic tests for valid preflight, empty PDF, detached-buffer regression, Base64 byte mismatch, hash mismatch, and zero requests on preflight failure.
- [x] 9.2 Add deterministic tests for the one-request guard, including a blocked second attempt before fetch and terminal provider error behavior.
- [x] 9.3 Add recorded/synthetic response tests for valid 28-page output, missing pages, duplicates, out-of-order pages, malformed JSON, truncation finish reasons, and response metrics.
- [x] 9.4 Add deterministic semantic valid/review/invalid, classification A/B/C/D, fixture-isolation, and no-persistence/no-fallback tests.

## 10. Opt-in runner and live execution

- [x] 10.1 Update or replace the evaluation-only runner so it loads server-side environment safely, remains excluded from normal CI, and displays only safe preflight data before the one request.
- [ ] 10.2 Run the live evaluator only when explicitly authorized and credentials are available; record the terminal result without retries.
- [ ] 10.3 Produce the full evaluation report and recommendation, including target-page observations and A/B/C/D classification, without changing V4 architecture.

## 11. Verification and handoff

- [x] 11.1 Run deterministic tests, typecheck, lint, and strict OpenSpec validation without Gemini calls.
- [x] 11.2 Verify no production V4/V3 worker/dispatcher/persistence behavior, Supabase schema, migrations, drafts, or fixture-specific production heuristics changed.
- [x] 11.3 Run `graphify update .` after implementation changes and document generated graph files, if any.
