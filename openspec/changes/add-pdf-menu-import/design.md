## Context

The existing admin menu panel creates categories and items individually and uploads images to the public `menu-images` storage bucket. The existing menu-import endpoint accepts already-structured menu items but has no upload, analysis, review, source-document, or publication workflow. Customer ordering reads published `menu_categories` and `menu_items` directly, so analysis output must be isolated from those tables until publication.

## Goals / Non-Goals

**Goals:**

- Make a restaurant's PDF menu importable without exposing or altering another restaurant's menu.
- Support selectable-text and scanned PDF inputs.
- Keep the source PDF and page-level evidence available during review.
- Make publication atomic, deliberate, and safe for the current live menu.

**Non-Goals:**

- Recreate the PDF's exact typography, decoration, or page layout in the customer ordering UI.
- Guarantee that every decorative graphic or photo maps to a menu item automatically.
- Add an automated source of truth that changes published prices or availability without administrator approval.
- Translate menus or infer modifiers, allergens, inventory, or kitchen-station assignments in this change.

## Decisions

### Use a staged import model instead of writing directly to live menu tables

Create restaurant-scoped import-job, draft-category, draft-item, and review-state records. The upload and analysis stages populate the draft; only the publish action writes to `menu_categories` and `menu_items`.

This protects active customer ordering from OCR or model mistakes and gives the administrator an editable checkpoint. Directly using the current structured-import endpoint was considered, but it cannot retain provenance, express uncertainty, or provide safe review.

### Treat the original PDF as canonical visual evidence

Store the uploaded PDF independently from extracted output and save page references with draft items. Preserve embedded or rendered imagery as import assets only when the analysis can associate it with an item; otherwise keep it available as unassigned review material.

Using a page screenshot as the live menu image was considered but rejected because it does not yield item-level imagery and would reduce the quality of the existing card-based customer menu.

### Separate document ingestion from analysis execution

The upload API validates ownership, type, size, and storage, then creates a pending import job. A separate server-side analysis worker transitions the job through pending, processing, needs-review, failed, and published states.

This makes lengthy OCR and document analysis observable and retryable without holding an HTTP request open. The exact runtime (queue, workflow, or background job) remains an implementation choice as long as the API exposes durable status and failures.

### Use layered extraction with transparent confidence

First extract native PDF text and embedded images; when text is absent or insufficient, render pages and run OCR. A structured extraction step groups text into categories and items and records field-level confidence and page evidence. The review UI surfaces every missing or low-confidence field.

Text-only parsing was considered but does not support scanned menus. Fully automatic publishing was rejected because price or image association errors are materially harmful to restaurant operations.

### Publish approved entries atomically without replacing the live menu

Publication inserts approved categories and items while preserving all existing live menu rows. Uploaded source and draft records remain available as audit evidence after publication.

Replace mode was intentionally deferred because existing orders reference menu-item identifiers. A versioned replacement and restoration lifecycle can be designed later without risking order history in the initial release.

## Risks / Trade-offs

- [OCR or model extraction misreads names or prices] → Require review, preserve page evidence, and block unresolved required fields.
- [Dish image is associated with the wrong item] → Use confidence thresholds; keep uncertain images unassigned until approved.
- [Large or complex PDFs exhaust request/runtime limits] → Enforce upload/page limits, process asynchronously, and report durable failure/retry state.
- [Public storage of source PDFs leaks menu documents] → Keep source PDFs private and issue authorized access; only approved item images use the existing public delivery model.
- [External OCR/AI service costs or availability] → Abstract analysis behind a provider boundary, record provider errors, and permit retry without re-upload.

## Migration Plan

1. Add import and draft schema objects plus storage configuration without altering existing published menu behavior.
2. Deploy ingestion, analysis, review, and publication endpoints behind authenticated admin access.
3. Add the admin review experience and exercise append publication with test data.
4. Roll back by disabling new import entry points; existing live menus remain unaffected because drafts do not alter published tables until a successful publication transaction.
