## Context

See `proposal.md` for motivation. Native extraction currently provides page-numbered text, but its joiner can reduce pages to one long logical line when `hasEOL` is sparse. The fixture demonstrates that text is compact enough for one prompt, while columns, detached currency symbols, relocated headings, and character spacing can make text order an unreliable replacement for visual layout.

## Goals / Non-Goals

**Goals:**

- Create an evaluation-only, one-request text pipeline with defensible evidence about usefulness and failure modes.
- Preserve native extraction provenance and page boundaries without pretending that PDF.js order restores visual layout.
- Map a minimal provider transport DTO into the existing canonical hierarchy with server identity and geometry-independent validation.

**Non-Goals:**

- Reusing the production PDF provider boundary, text fallback, visual retries, persistence, or existing V4/full-PDF evaluator behavior.
- Treating an HTTP success or a structured response as a production-readiness decision.

## Decisions

### 1. Dedicated text-only evaluator boundary

The evaluator is a new opt-in path separate from `analyzePdf`, worker, dispatcher, V4, and the full-PDF spike. It only returns an in-memory/safe local report.

Alternative: add a mode flag to the existing provider. Rejected because its existing boundary can render pages, attach auxiliary evidence, retry, and fall back, all of which violate this spike's experiment controls.

### 2. TextDocument preserves extraction evidence, not inferred layout

TextDocument has ordered pages and ordered TextItems. Each item records original index, text, and separator evidence derived from PDF.js (including `hasEOL` when present). Serializer output uses explicit `=== PAGE n ===` markers and deterministic separators. Whitespace is normalized only inside a captured text item; item boundaries and page boundaries remain traceable. A document is eligible only with at least 200 non-whitespace characters, 10 non-empty items, and 20 percent of pages containing at least 20 non-whitespace characters; otherwise it is `not_evaluable` and consumes no request. Empty source pages remain in structural coverage.

Alternative: concatenate all page strings or reconstruct columns from coordinates. Concatenation destroys page identity; geometry reconstruction would silently introduce a layout parser into a text-only experiment.

### 3. Text-only transport DTO, canonical domain adapter

The provider sees only `TextMenuDocument` fields: page number, sections/title, items/name/description/raw price/variants, and optional association uncertainty. The schema has `additionalProperties: false`; requires document pages, each page number, sections, items, and item name; and limits association fields to `certain`, `ambiguous`, or `absent`. It has no BBoxes, visual confidence, or durable IDs. A dedicated decoder validates this DTO, creates non-authoritative section hints only when useful, then adapts it to the bbox-optional canonical hierarchy before server IDs are assigned. Missing or repeated provider hints cannot influence canonical ID generation or continuity.

Alternative: require the V4 visual schema. Rejected because it pressures the model to fabricate geometry, confidence, and opaque IDs that have no textual evidence.

### 4. One consumable request budget

An execution-local request budget begins at one and is consumed immediately before the only provider call. The evaluator has no retry/fallback branch. Non-200, timeout, invalid JSON, schema rejection, and provider exceptions are terminal and reportable.

Alternative: rely on one visible `fetch`. Rejected because a later retry or error-recovery edit would break the experiment invisibly.

### 5. Structure before semantics and reconciliation

The evaluator records response page order, coverage, duplicates, and malformed DTO shapes before decoding/reconciliation. It then adapts, assigns server IDs, and applies text-semantic validation. Reconciliation considers at most the immediately prior page and only explicit continuation evidence; it cannot hide structural defects or enable distant category leakage.

Alternative: normalize/reconcile first. Rejected because sorting could erase evidence of model page-order errors.

### 6. Conservative uncertainty policy

The DTO can omit a price/description association and expose an uncertainty hint. Local validation records `AMBIGUOUS_PRICE` for uncertain price associations and `DESCRIPTION_FRAGMENT` for likely prose fragments. Ambiguity defaults to `review`, not fabricated repair. Clearly unusable candidates remain `invalid`.

Alternative: infer nearest price/description by text order. Rejected because pages with reordered columns and detached currency symbols make that association unreliable.

### 7. Evaluation-only scoring

Classification A/B/C/D combines structural completeness, semantic aggregates, finish reason, and target-page observations. It only recommends future work; it cannot change runtime analyzer selection. Version 1 uses a 32,768-token output cap and a 60-second timeout over `v1beta/models/{model}:generateContent`. A requires structurally valid non-truncated output with invalid rate <=2%, review rate <=10%, and ambiguous-price rate <=5%; B permits invalid <=10% and review <=35%; C is structurally valid but outside those thresholds; D is terminal failure, truncation, structural invalidity, or zero items. Recalibration requires a later OpenSpec change.

Alternative: use `needs_review` count alone. Rejected because it masks missing pages, fragments, and price hallucinations.

## Risks / Trade-offs

- [Risk] Native item order loses column relationships → Preserve original extraction order and mark uncertainty; measure target pages rather than repair visually.
- [Risk] Output is truncated despite small input → Start with a bounded output budget, record finish reason/tokens/response bytes, and do not retry.
- [Risk] Text-only DTO differs from canonical visual DTO → Use an explicit adapter and deterministic compatibility tests rather than a second persistence model.
- [Risk] Fragment rules reject real dishes → Make `DESCRIPTION_FRAGMENT` review-biased unless a candidate is clearly non-product.
- [Risk] Model/API structured-output contract differs from current provider assumptions → Isolate the `v1beta` request builder, test its payload deterministically, and validate it with one opt-in live evaluation rather than a general provider migration.
- [Risk] Fixture overfitting → Keep Subarashii names and assertions exclusively in evaluation/test code; all production-independent signals remain generic.

## Migration Plan

No migration, rollout, or production deployment is required. The evaluator remains opt-in and can be removed independently. Rollback is disabling/deleting its runner and helpers; V3, V4, full-PDF evaluation, imports, and historical data are unaffected.

## Open Questions

- The exact structured-output field spelling supported by the selected model/API family will be confirmed by an opt-in implementation smoke. A mismatch is a terminal spike result and does not authorize a general provider migration.
