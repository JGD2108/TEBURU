## Why

The production V5 import now reaches the administrative review screen, but operators still face analyzer choices, item-by-item approval, and a flat status-oriented draft list. The workflow needs a safer and faster review experience that uses Gemini's recommendation as evidence without treating model confidence as authority or bypassing human publication control.

## What Changes

- Extend the V5 structured result with an advisory `approve`, `review`, or `reject` recommendation, a reported confidence value, and bounded reason codes. Server structural and semantic validation remains authoritative and may only downgrade the provider recommendation.
- Derive server-side bulk-approval eligibility from the provider recommendation, a versioned confidence threshold, current draft validity, and absence of review/invalid reasons. Model confidence is displayed as reported confidence, not as a calibrated guarantee.
- Add an authorized, restaurant/import-scoped, transactional **Approve all eligible** action. It approves only unchanged eligible V5 drafts, returns approved/skipped counts and reasons, and never publishes automatically.
- Replace the V5 draft presentation with a category-grouped view whose initial filter is **All**, while preserving item editing, source-page evidence, validation reasons, review exclusions, and extraction issues.
- After the existing explicit publish action succeeds, refresh the published menu on the same administrative screen so categories and items appear immediately.
- **BREAKING (operator UI only)**: remove the analyzer selector from the normal import flow and route new operator imports through native-text V5. Keep V3/V4 and historical analyzer versions available through server-side/admin rollback configuration; do not delete or reinterpret them.

## Capabilities

### New Capabilities

- `menu-import-v5-assisted-approval-ui`: Advisory model decisions, server-governed bulk eligibility, transactional bulk approval, category filtering, V5-only operator import UI, and same-screen published-menu refresh.

### Modified Capabilities

- `menu-import-gemini-structure`: Extend the strict V5 structured output with advisory recommendation/confidence metadata while preserving server validation authority and existing failure boundaries.

## Impact

- Affected areas: V5 transport schema and decoder, canonical validation metadata, lineage/metrics, draft persistence, an authenticated bulk-approval API, `MenuImportPanel`, published menu refresh, authorization/tenant isolation, and deterministic integration/component tests.
- No Gemini model change, additional provider request, OCR, visual input, PDF input, automatic publication, Supabase schema change by default, or removal of V3/V4 execution support.
- Existing V5 imports without recommendation metadata remain readable; bulk eligibility is false unless the versioned server policy can prove eligibility.
