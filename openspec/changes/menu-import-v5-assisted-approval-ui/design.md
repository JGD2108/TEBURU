## Context

See `proposal.md` for motivation. V5 already performs one native-text request, persists valid/review/invalid outcomes, and renders them in `MenuImportPanel`. The production run demonstrated successful category deduplication but also showed why model output cannot be authoritative: page 9 prices were accepted as valid despite prior ambiguity expectations. Existing approval is item-scoped and publication is a separate append operation.

## Goals / Non-Goals

**Goals:**

- Add provider recommendation metadata without weakening canonical validation.
- Make bulk approval atomic, tenant-scoped, idempotent, auditable, and safe under concurrent edits.
- Give operators a V5-focused category workflow with immediate published-menu refresh.
- Preserve V3/V4 as privileged rollback paths and preserve historical import readability.

**Non-Goals:**

- Treating reported model confidence as certainty or replacing server validation.
- Automatically approving review/invalid candidates or automatically publishing after bulk approval.
- Adding provider calls, retries, OCR, visual input, PDF input, or changing Gemini models.
- Deleting V3/V4 analyzers, rewriting historical imports, or adding fixture-specific production rules.

## Decisions

### 1. Recommendation is evidence, not authority

Extend the strict V5 item DTO with `recommendation`, `decisionConfidence`, and bounded `decisionReasons`. Preserve them separately through decode, canonical validation, lineage, and persistence projection. Server semantic validation computes the final status and may only downgrade provider intent.

Alternative: let Gemini set `approved=true`. Rejected because model confidence is not calibrated certainty and a single extraction already demonstrated a missed ambiguity.

### 2. Versioned server eligibility policy

Compute bulk eligibility server-side from the current draft and a single centralized policy. The initial default threshold is `0.90`, configurable server-side and recorded with a policy version. Eligibility requires V5, `valid`, recommendation `approve`, confidence at or above threshold, complete required fields, no blocking reasons, and a matching draft version.

Alternative: expose a threshold slider to operators. Rejected because it makes safety policy client-controlled and difficult to audit.

### 3. Atomic bulk endpoint

Add one authenticated import-scoped action that locks or version-checks the selected import's drafts, recomputes eligibility, approves eligible rows in one transaction, and returns deterministic approved/skipped counts. Use the existing tenant and role boundary. Do not implement bulk approval as many client PATCH requests.

Alternative: invoke the existing item endpoint repeatedly. Rejected because partial network failure and concurrent edits would produce an untrustworthy mixed result.

### 4. Approval and publication remain separate

The bulk endpoint changes only draft approval state. The existing publication endpoint remains explicit and independently authorized. On publish success, invalidate/refetch both import and live-menu queries so the same screen reflects the result.

Alternative: publish automatically after approve-all. Rejected because approval is a review decision and publication changes live restaurant data.

### 5. Category-first V5 operator UI

For ordinary operators, remove analyzer/model controls and finalize with V5 when the server reports V5 enabled. Render a single draft collection grouped by projected category with `All` selected initially, category chips/selectors, per-item status badges, editable fields, evidence, and issues. Keep rollback outside the normal flow as privileged server/admin configuration.

Alternative: remove V3/V4 from the server. Rejected because rollback and historical readability remain safety requirements.

### 6. Reuse existing storage before schema changes

Prefer existing draft validation/review metadata, run structural metrics, and lineage event data for recommendation and bulk audit references. Add no migration unless implementation-time schema inspection proves current JSON/evidence fields cannot provide durable queryable audit and idempotency. Any migration would be additive and requires separate validation.

## Risks / Trade-offs

- [Risk] High reported confidence is mistaken for correctness → Label it explicitly, keep server validation authoritative, and never bulk-approve review/invalid candidates.
- [Risk] Concurrent edits race with bulk approval → Use transaction-level revalidation and draft version/precondition checks.
- [Risk] V5 outage leaves no visible analyzer alternative → Keep privileged rollback configuration and an actionable V5-unavailable state rather than silently switching analyzers.
- [Risk] Large category lists become difficult to scan → Default to `All`, preserve category order, and use a compact horizontal or select-based filter appropriate to viewport.
- [Risk] Existing imports lack recommendation fields → Keep them readable and bulk-ineligible by default.

## Migration Plan

1. Extend and test the V5 response contract, decoder, canonical metadata, lineage, and server eligibility policy without enabling bulk UI.
2. Add the transactional bulk endpoint and authorization/idempotency tests.
3. Add the category-grouped V5 UI, remove analyzer choices for ordinary operators, and retain privileged rollback configuration.
4. Deploy behind a server-side feature flag; verify valid-only bulk approval, stale conflicts, review exclusions, no auto-publication, and same-screen refresh.
5. Roll back by disabling assisted approval UI and selecting V4 through privileged configuration; historical V5 imports remain readable.
