## 1. Import foundation and storage

- [x] 1.1 Define database migrations for restaurant-scoped import jobs, draft categories, draft items, source-page evidence, image suggestions, statuses, and review metadata.
- [x] 1.2 Configure private storage for uploaded source PDFs and import assets, with lifecycle and restaurant-scoped authorization rules.
- [x] 1.3 Add shared types and validation for import status, draft fields, confidence flags, PDF constraints, and publication input.
- [x] 1.4 Add authenticated admin APIs to create an import, retrieve its status, list drafts, and provide authorized source-document access.

## 2. Document analysis pipeline

- [x] 2.1 Select and configure the server-side PDF text, page-rendering, OCR, and structured-extraction dependencies/provider boundary.
- [x] 2.2 Implement durable background execution for pending import jobs, including processing, retry, failure, and needs-review transitions.
- [x] 2.3 Extract native PDF text and embedded imagery; fall back to page rendering and OCR when native text is insufficient.
- [x] 2.4 Convert analysis results into restaurant-scoped draft categories and items with source-page references and field-level confidence.
- [x] 2.5 Store suggested dish images only when their associations meet the confidence policy; retain uncertain assets for review without live assignment.
- [x] 2.6 Add unit and integration tests for valid text PDFs, scanned PDFs, invalid uploads, analysis failures, and restaurant isolation.

## 3. Draft review experience

- [x] 3.1 Add a PDF import entry point and import-status view to the admin menu-management area.
- [x] 3.2 Build a draft review interface that shows extracted categories, items, prices, descriptions, confidence warnings, suggested images, and source-page evidence.
- [x] 3.3 Add APIs and UI actions to edit, remove, or approve draft entries without changing published menu data.
- [x] 3.4 Add validation feedback that identifies missing names, invalid prices, absent categories, and unresolved fields before publication.
- [x] 3.5 Add component and route tests covering review edits, source access authorization, and incomplete-draft validation.

## 4. Publication and verification

- [x] 4.1 Implement a transactionally safe, restaurant-scoped append-publication API that reuses or creates categories and creates approved menu items.
- [x] 4.2 Upload approved image assets through the existing public menu-image delivery model and persist their URLs on published items.
- [x] 4.3 Preserve import audit data and mark successful drafts as published without changing existing live menu rows.
- [x] 4.4 Add tests for publication success, cancellation, validation failure, transaction rollback, tenant isolation, and public catalog visibility.
