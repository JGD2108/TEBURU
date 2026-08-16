## Why

The menu import flow is rejecting valid uploads with `IMPORT_UPLOAD_INCOMPLETE` at `POST /api/admin/menu-import/finalize`. The current contract is too brittle when the PDF upload is still propagating, the object path is mismatched, or Storage metadata is not immediately readable.

## What Changes

- Tighten the upload/finalize contract so a completed upload is only accepted when the object is actually present and matches the expected PDF attributes.
- Return a clearer, stable failure when the file has not reached Storage yet instead of treating every mismatch as a generic incomplete upload.
- Make the client/server handshake tolerant of transient Storage visibility delays without allowing invalid files through.
- Preserve the existing import authorization flow and the JSON error envelope shape.

## Capabilities

### New Capabilities
- `menu-import-upload-finalization`: Finalization of menu-import uploads must validate object presence, size, and PDF type before creating an import job.

### Modified Capabilities
- `menu-import-deployment-reliability`: Menu import upload and finalize behavior is becoming stricter and more specific about upload completeness failures.

## Impact

- `src/app/api/admin/menu-import/upload-authorizations/route.ts`
- `src/app/api/admin/menu-import/finalize/route.ts`
- `src/components/admin/MenuImportPanel.tsx`
- `src/lib/menu-import-storage.ts`
- `src/app/api/admin/menu-import/routes.test.ts`
- user-visible error messages during menu import
