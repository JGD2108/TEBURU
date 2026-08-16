## Context

See `proposal.md` for the user-visible problem. The current flow already uses signed uploads and a separate finalize step, but the finalize check is too strict about one specific verification path and too broad in the error it returns.

## Goals / Non-Goals

**Goals:**

- Keep the upload-authorize/finalize split.
- Make finalize depend on verifiable Storage state, not just the presence of an authorization record.
- Distinguish a transient storage-visibility problem from a malformed request or a permanent backend fault.
- Preserve idempotent behavior when finalize is retried after success.

**Non-Goals:**

- Replacing the current direct-to-Storage upload architecture.
- Changing analysis, draft generation, or publication behavior.
- Introducing a new upload provider or background sync job.

## Decisions

1. Treat Storage verification as part of finalize, not as a separate background concern.
   - This keeps the contract simple: if finalize succeeds, the object was verifiable at that moment.
   - Alternative considered: add a polling job or retry queue. Rejected because it adds latency and complexity to a path that should remain synchronous.

2. Return a dedicated incomplete-upload error for missing or mismatched objects.
   - This gives the UI a stable branch for “re-upload the PDF” instead of collapsing multiple failure modes into one generic error.
   - Alternative considered: keep using a generic internal error. Rejected because it hides the actionable recovery path from the user.

3. Preserve idempotent finalize semantics for already finalized authorizations.
   - This avoids creating duplicate imports when the UI retries after a network interruption.
   - Alternative considered: reject repeat finalization outright. Rejected because it makes transient failures harder to recover from.

4. Keep authorization validation strict before any Storage check.
   - This prevents unnecessary Storage lookups for invalid requests and keeps the failure envelope consistent.
   - Alternative considered: check Storage first. Rejected because it can waste work on unauthorized requests and blur error semantics.

## Risks / Trade-offs

- [Risk] Storage visibility may still lag briefly after upload completion → Mitigation: keep the incomplete-upload error explicit so the UI can instruct a retry.
- [Risk] Stricter verification could reject marginal uploads that previously slipped through → Mitigation: only validate attributes already known at authorization time.
- [Risk] Idempotent finalize may mask accidental duplicate submits → Mitigation: keep request logging and requestId correlation so duplicates remain traceable.

## Migration Plan

1. Update the finalize contract and its tests for the incomplete-upload path.
2. Update the UI to treat the new stable error as a user-retry condition.
3. Verify the existing upload-authorize flow still produces the same authorization payload.
4. Redeploy and validate a real upload/finalize round trip in production-like conditions.

