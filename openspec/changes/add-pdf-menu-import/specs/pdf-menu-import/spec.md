## Purpose

Enable restaurant administrators to turn their existing PDF menus into reviewed, editable Teburu menu entries while preserving the original document and its relevant dish imagery.

## ADDED Requirements

### Requirement: Restaurant-scoped PDF import submission
The system SHALL allow an authenticated restaurant administrator to upload a PDF menu and create an import draft owned by that administrator's restaurant. The system MUST reject unsupported, empty, or oversized uploads and MUST prevent one restaurant from accessing another restaurant's import drafts or source files.

#### Scenario: Administrator submits a valid PDF menu
- **WHEN** an administrator uploads a valid PDF from the menu-management area
- **THEN** the system creates a restaurant-scoped import draft and reports that analysis has begun

#### Scenario: Administrator submits an invalid document
- **WHEN** an administrator submits a file that is not an accepted PDF or violates the configured upload limits
- **THEN** the system rejects the submission with an actionable error and creates no import draft

#### Scenario: Administrator requests another restaurant's import
- **WHEN** an administrator requests an import draft that belongs to a different restaurant
- **THEN** the system denies access and does not disclose the draft or source document

### Requirement: Menu structure extraction
The system SHALL analyze both text-based PDFs and scanned/image-based PDFs to produce a draft of categories and menu items. Each draft item MUST retain the extracted name, price, optional description, proposed category, source page, and an indication when the system could not determine a value confidently.

#### Scenario: Text-based PDF produces draft entries
- **WHEN** a submitted PDF contains readable menu text
- **THEN** the resulting draft lists the detected categories and items with their extracted names and prices

#### Scenario: Scanned PDF requires OCR
- **WHEN** a submitted PDF contains page images instead of selectable text
- **THEN** the system attempts OCR and presents any resulting values as editable draft entries

#### Scenario: Extraction is uncertain
- **WHEN** the system cannot determine an item field or its association with sufficient confidence
- **THEN** the system marks that field for administrator review instead of silently publishing an assumed value

### Requirement: Source visual preservation and image suggestions
The system SHALL retain the uploaded source PDF with each import draft for review. The system MUST present available visual evidence for each extracted item, including source-page context and any suggested dish image, while clearly distinguishing suggested imagery from administrator-approved imagery.

#### Scenario: Administrator compares a draft item with its source
- **WHEN** an administrator reviews an extracted item
- **THEN** the system displays its source-page reference and the original PDF remains available for inspection

#### Scenario: Image association is uncertain
- **WHEN** the system finds an image but cannot confidently associate it with a specific item
- **THEN** the image remains unassigned or flagged for review and is not automatically applied to a live menu item

### Requirement: Review before live-menu publication
The system SHALL keep imported categories, items, and image suggestions in a draft state until an administrator explicitly publishes them. Administrators MUST be able to edit or remove draft data before publication, and draft items lacking a name, valid non-negative price, or category MUST be resolved or excluded before publication.

#### Scenario: Administrator corrects extracted content
- **WHEN** an administrator edits an item name, price, category, description, or image choice in a draft
- **THEN** the system saves the correction in the draft without changing the live customer menu

#### Scenario: Draft item is incomplete
- **WHEN** an administrator attempts to publish a draft containing an unresolved required item field
- **THEN** the system blocks publication and identifies the item and fields that require resolution

### Requirement: Controlled publication to the restaurant menu
The system SHALL append approved entries to the restaurant's current menu without changing existing live categories or menu items. Publication MUST not affect other restaurants. Once publication succeeds, approved item images MUST be available through the existing customer menu.

#### Scenario: Administrator appends an approved draft
- **WHEN** an administrator selects append and confirms publication
- **THEN** the system adds the approved categories and items to that restaurant's existing live menu

#### Scenario: Administrator cancels publication
- **WHEN** an administrator cancels before confirming publication
- **THEN** the live menu remains unchanged and the draft remains available for later review
