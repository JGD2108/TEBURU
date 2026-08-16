## Why

Restaurants often already have a designed PDF menu, but rebuilding every category, dish, price, description, and image manually in Teburu is slow and error-prone. Teburu should turn that existing menu into an editable digital draft while retaining the source PDF for visual verification.

## What Changes

- Add an admin PDF-upload workflow that creates a restaurant-scoped menu-import draft.
- Extract menu structure from text-based and scanned PDFs, including categories, item names, descriptions, and prices.
- Preserve the PDF's visual material by retaining the original document and importing dish imagery only when it can be confidently associated with an item.
- Provide a review-and-edit screen where an administrator resolves uncertain values and chooses whether to publish the draft.
- Publish approved draft entries into the existing categories and menu items without changing the live menu before approval.
- Publish approved entries by appending them to the current menu; menu replacement and version restoration remain future work.

## Capabilities

### New Capabilities

- `pdf-menu-import`: Upload, analyze, review, and publish restaurant-specific PDF menu imports with source-document and image handling.

### Modified Capabilities

- None.

## Impact

- Admin menu-management UI and authenticated restaurant-scoped APIs.
- Database schema for import jobs, draft items, review state, and source-document metadata.
- Supabase Storage for uploaded PDF source files and extracted menu imagery.
- PDF text/layout analysis, OCR for scanned documents, and structured extraction service integration.
- Existing `menu_categories`, `menu_items`, item-image upload flow, and public customer catalog rendering.
