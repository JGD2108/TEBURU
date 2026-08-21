## 1. Existing-contract inspection

- [x] 1.1 Inspect the current V5 DTO, decoder, canonical item metadata, lineage, draft columns, approval endpoint, publication endpoint, tenant checks, and MenuImportPanel projections before changing behavior.
- [x] 1.2 Confirm whether existing JSON/evidence and draft fields can durably represent recommendation, confidence, policy version, actor, and bulk outcome; document `MIGRATION_REQUIRED=no`: existing `validation_signals`, `review_reasons`, `extraction_attributes`, analysis `structural_metrics`, lineage `event_data`, and draft `review_status` satisfy the durable audit/idempotency contract without schema changes.
- [x] 1.3 Define one bounded recommendation/reason vocabulary and one centralized versioned bulk-eligibility policy; do not duplicate semantic reason vocabularies.

## 2. Advisory provider contract

- [x] 2.1 Extend the strict V5 structured schema and prompt with required `approve|review|reject`, in-range reported confidence, and bounded decision reasons without changing the model, request budget, text-only input, or output-token policy.
- [x] 2.2 Update strict decoding and canonical adaptation so malformed advisory metadata rejects the V5 response and valid raw provider metadata remains separate from server status.
- [x] 2.3 Add deterministic provider/decoder tests for valid metadata, unknown recommendations/reasons, out-of-range confidence, schema rejection, and legacy recorded responses.

## 3. Authoritative validation and eligibility

- [x] 3.1 Preserve existing structural and semantic validation as authoritative and ensure provider recommendations can never upgrade server `review` or `invalid` outcomes.
- [x] 3.2 Implement the centralized server eligibility policy with initial default threshold `0.90`, server-only configuration, policy versioning, required fields, blocking reasons, and V5 analyzer isolation.
- [x] 3.3 Preserve advisory recommendation, confidence, provider reasons, server status, eligibility result, policy version, and threshold in safe lineage/metrics without secrets.
- [x] 3.4 Add deterministic transition tests covering approve→valid eligible, approve→review blocked, approve→invalid blocked, reject evidence, missing legacy metadata, changed drafts, and threshold boundaries.

## 4. Durable persistence and compatibility

- [x] 4.1 Reuse existing persistence fields when they satisfy the audit/idempotency contract; if they do not, add only the minimal additive migration proven necessary by task 1.2.
- [x] 4.2 Persist recommendation metadata without changing the existing valid/review/invalid gates or converting invalid issues into normal drafts.
- [x] 4.3 Keep historical V3/V4/V5 imports readable and bulk-ineligible by default when required recommendation metadata is absent.
- [x] 4.4 Add persistence tests for replay, category deduplication, provenance preservation, review/invalid exclusion, historical imports, and no automatic publication.

## 5. Transactional bulk approval API

- [x] 5.1 Add an authenticated restaurant/import-scoped approve-all endpoint using the existing admin role and tenant isolation boundaries.
- [x] 5.2 Revalidate analyzer identity, import state, draft versions, eligibility, and blocking reasons inside one transaction; approve eligible rows atomically and leave skipped rows unchanged.
- [x] 5.3 Return deterministic approved/skipped totals and bounded skip reasons; make replays idempotent and genuine database errors fail visibly.
- [x] 5.4 Record the actor, import, policy version, precondition, approved/skipped counts, and reasons in existing audit/lineage structures without logging sensitive menu contents unnecessarily.
- [x] 5.5 Add route/integration tests for authorization, cross-tenant denial, stale conflicts, concurrent changes, partial eligibility, replay, rollback, and zero publication side effects.

## 6. V5-focused import and category UI

- [x] 6.1 Remove analyzer/model choices from the ordinary operator import UI and submit V5 implicitly only when the server reports it enabled; show an actionable unavailable state instead of silently selecting V4.
- [x] 6.2 Preserve V3/V4 server execution and privileged rollback configuration, with tests proving ordinary operators cannot choose models and rollback remains available.
- [x] 6.3 Replace status-only draft presentation with a category-grouped collection whose initial filter is `All` and whose filter list derives from projected categories.
- [x] 6.4 Preserve valid/review/invalid distinctions, source-page evidence, descriptions, raw and normalized prices/variants, individual edit/approve/exclude controls, and extraction-issue separation within the filtered view.
- [x] 6.5 Add an **Approve all eligible** control with confirmation, loading/error/success states, approved/skipped summary, stale-conflict handling, and no client-side loop of item PATCH calls.
- [x] 6.6 Keep **Publish approved** separate; after success, refetch the import and published menu so categories/items appear immediately on the same screen.
- [x] 6.7 Add responsive component tests for All/category filters, category ordering, empty states, confidence labels, blocked review items, bulk summaries, V5-only operator UI, and same-screen publish refresh.

## 7. Cross-cutting safety and regression

- [x] 7.1 Prove V5 still sends native text only, exactly one provider request, no PDF/image/OCR/BBox input, no fallback, and no additional request caused by approval or filtering.
- [x] 7.2 Prove `AMBIGUOUS_PRICE`, other review reasons, invalid fragments, provider failures, and non-evaluable documents are never bulk-approved or automatically published.
- [x] 7.3 Prove category deduplication, page/section/item provenance, server IDs, persistence linkage, and V4/V3 historical behavior remain unchanged.
- [x] 7.4 Run focused provider, validator, persistence, API, worker, and MenuImportPanel tests; then run the full deterministic suite, typecheck, lint, migration validation if applicable, strict OpenSpec validation, and `git diff --check`.
- [x] 7.5 Run `graphify update .` after implementation changes and report generated graph files.

## 8. Controlled platform rollout

- [x] 8.1 Deploy behind server-side assisted-approval and V5 operator-flow flags while keeping privileged V4 rollback available.
- [ ] 8.2 Verify in the real platform that one V5 import shows grouped categories with `All`, advisory confidence, valid/review/invalid separation, and no analyzer/model selector for ordinary operators.
- [ ] 8.3 On the same import, verify atomic approve-all approves only eligible drafts, reports skips, does not publish, and explicit publication refreshes the live menu on the same screen.
- [ ] 8.4 Verify observability for recommendation, server status, policy version, threshold, actor, counts, reasons, provider request count, and no visual/OCR/fallback activity without exposing secrets.
- [ ] 8.5 Record rollout and rollback evidence; keep V5 as the operator path only if bulk safety, tenant isolation, review exclusions, and explicit publication all pass.
