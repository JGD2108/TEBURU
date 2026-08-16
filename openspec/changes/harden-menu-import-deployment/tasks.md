## 1. API and configuration reliability

- [x] 1.1 Define shared JSON success/error envelopes, stable error codes, and request-correlation propagation for public-settings and menu-import APIs.
- [x] 1.2 Make the public-settings route return non-secret import readiness information for valid, unavailable, and misconfigured states.
- [x] 1.3 Update menu-import routes to validate input and return actionable JSON failures for authorization, configuration, job-creation, and processing-start errors.
- [x] 1.4 Add client response handling that verifies content type before JSON parsing and renders retryable non-JSON transport failures safely.

## 2. Direct document upload flow

- [x] 2.1 Implement restaurant-scoped, short-lived private-storage upload authorization with configured PDF type and size constraints.
- [x] 2.2 Implement idempotent upload finalization that verifies the stored object and creates the import job without accepting a proxied document body.
- [x] 2.3 Update the admin import UI to use authorization, direct upload, finalization, progress, cancellation, and retry states.
- [x] 2.4 Add lifecycle cleanup for expired authorizations and unfinalized private source documents.

## 3. Diagnostics and verification

- [x] 3.1 Add safe structured logs and correlation identifiers across authorization, finalization, job creation, and analysis start without logging secrets or document contents.
- [x] 3.2 Add unit and route tests for JSON error envelopes, readiness states, invalid/expired upload authorization, and non-JSON client responses.
- [x] 3.3 Add integration tests for restaurant isolation, idempotent finalization, and configured-limit PDF submission larger than the application request-body limit.
- [ ] 3.4 Verify the Vercel deployment with successful small and large PDFs plus 400, 404, 413, and 500 failure-path behavior.
