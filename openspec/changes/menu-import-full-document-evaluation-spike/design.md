## Context

See `proposal.md` for motivation. The existing V4 analyzer is deliberately page-scoped and production-facing. A preliminary full-PDF evaluator already uses native PDF inline data and canonical helpers, but it needs hard request budgeting, automated preflight invariants, strict document-integrity reporting, and complete evaluation metrics before another live request is authorized.

## Goals / Non-Goals

**Goals:**

- Establish an evaluation-only pipeline that is provably limited to one provider call.
- Reuse canonical V4 representation and validation without coupling the spike to V4 execution or persistence.
- Produce trustworthy evidence about complete-document feasibility, including negative results such as truncation or incomplete page coverage.

**Non-Goals:**

- Altering page-by-page V4, V3, worker/dispatcher behavior, imports, drafts, persistence, Supabase, migrations, or publication.
- Migrating API families, implementing a hybrid production path, or retrying/repairing a full-document response.

## Decisions

### 1. Dedicated evaluation boundary

The evaluator and opt-in runner are separate from `analyzePdf`, worker, dispatcher, and persistence. It consumes a PDF once, builds a native-PDF request, then returns an in-memory report. This ensures an experiment cannot silently become a production import.

Alternative: add a full-document mode to V4. Rejected because it would mix experimental semantics with the approved page-by-page architecture.

### 2. A consumable request-budget guard

An execution-local budget starts at one. Every provider-call entry point consumes it immediately before network access; subsequent attempts throw a named local error. The evaluator has no retry path of any kind.

Alternative: rely on one visible `fetch` statement. Rejected because later refactors could add retries or secondary calls without a detectable invariant.

### 3. Preflight treats the payload as an artifact

The evaluator reads the source PDF into an original byte array, uses a copied array for PDF.js inspection, and builds the Base64 request part from the preserved original. Before fetch, it verifies source and outgoing decoded bytes/hash, MIME, presence, page count, and fixture expectations. Preflight produces a safe report and consumes no provider budget.

Alternative: check source bytes only. Rejected because it cannot catch encoding, field-placement, or buffer-detachment regressions at the request boundary.

### 4. V4-compatible schema projection

The preferred request schema reuses the existing V4 response schema or a declared compatible projection. Required output preserves page number, sections, item name, description, raw price, price variants, section hints, and optional V4-supported fields where they do not make output impractical. Provider section IDs are model hints only; post-decode server IDs are authoritative.

Alternative: invent a compact parallel document model. Rejected because it would create a second normalization and validation path, weakening comparison with V4.

### 5. Structural result precedes semantic result

Structural validation runs after JSON parse and before semantic validation. It calculates expected, returned, missing, duplicate, and out-of-order pages without sorting away evidence. Canonical reconciliation may run only after structural findings are recorded; it cannot turn incomplete output into structurally valid output.

Alternative: rely on decoder and reconciler alone. Rejected because the current decoder accepts duplicate/order variants and the reconciler sorts pages.

### 6. Ephemeral, safe evaluation lineage

The evaluator creates an in-memory report and optional git-ignored local artifact containing sanitized metadata and hashes, never raw provider content by default. It records the request/response and validation boundaries needed to interpret a result while retaining no API key or authorization material.

### 7. Classification is evidence, not rollout control

Classification A/B/C/D is a deterministic interpretation of structural completeness, semantic aggregates, finish reason, and fixture assessment. It only reports a recommendation; it never switches analyzers or starts page retries.

## Risks / Trade-offs

- [Risk] Response reaches the output limit or truncates JSON → report finish reason/output tokens/bytes, preserve partial diagnostic facts, and do not retry.
- [Risk] PDF is accepted but page-level item accuracy declines → retain target-page fixture assessment and classify C or D rather than treating completeness as success.
- [Risk] API errors consume the only request → report the exact sanitized terminal condition and end the execution.
- [Risk] Schema breadth increases output size → start with V4 compatibility and use real measured output before deciding whether a later change needs a compact projection.
- [Risk] Local output leaks sensitive payloads → report hashes and bounded safe metrics only; exclude credentials, headers, and raw secrets.

## Migration Plan

No migration or rollout is required. The evaluator is opt-in and is removed or retained as test tooling independently of production analyzer rollout. Rollback is deleting or disabling the opt-in evaluator; V3/V4 imports are unaffected.

## Open Questions

- The precise A/B/C/D thresholds for “good structure” can be finalized after the first valid live result; they do not change the one-request, preflight, structural, or isolation contracts.
- Whether optional V4 fields beyond the core item/price/section fields fit the output budget remains a measured evaluation result; the implementation must preserve compatibility either way.
