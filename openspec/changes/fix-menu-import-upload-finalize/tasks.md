## 1. Finalize contract

- [x] 1.1 Update the finalize path to distinguish missing object, mismatched metadata, and already-finalized authorization behavior.
- [x] 1.2 Keep the error envelope stable so the UI can branch on the incomplete-upload code.
- [x] 1.3 Preserve idempotent success when finalize is retried for an authorization that already created an import job.

## 2. UI recovery

- [x] 2.1 Update the admin import flow to treat incomplete-upload failures as a retry-with-upload-again condition.
- [x] 2.2 Prevent finalize from running until the upload step has fully completed and the upload URL request has returned successfully.

## 3. Verification

- [x] 3.1 Add or update route tests for missing object, wrong metadata, and idempotent finalize.
- [x] 3.2 Add a client-side test that confirms the incomplete-upload error maps to the expected user-facing message.
- [ ] 3.3 Run the relevant test suite and confirm the new spec behavior is covered end to end.
