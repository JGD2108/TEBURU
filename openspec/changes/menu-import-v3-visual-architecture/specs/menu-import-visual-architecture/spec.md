## Purpose

Define a visual-first, provenance-preserving menu extraction contract that handles arbitrary PDF layouts while keeping page perception separate from conservative document-level reconciliation.

## ADDED Requirements

### Requirement: Canonical visual document extraction

The system SHALL represent extraction as a canonical `MenuDocument` containing pages, sections, and independent menu items for as long as possible. Page perception MUST use the rendered page image as the primary source for section boundaries, item boundaries, associations, columns, tables, variants, and grouping.

#### Scenario: Multimodal page extraction
- **WHEN** a renderable PDF page is analyzed
- **THEN** the analysis request includes the rendered image and the result identifies the page, its sections, and its visually independent items

#### Scenario: Multiple visual layouts
- **WHEN** a page contains multiple columns, a table, multiple categories, or products with multiple prices
- **THEN** the canonical result preserves those visual relationships instead of concatenating the page into one linear name or item

### Requirement: Controlled auxiliary text

The primary visual extraction MUST contain only the rendered page image, extractor instructions/schema, page number, and minimum technical metadata. It MUST NOT contain native page-text dumps, OCR dumps, or selected-text dumps. Auxiliary text MAY be retained in an evidence object or supplied to a targeted retry whose role is explicit and cannot redefine visual boundaries.

#### Scenario: Primary extraction with available OCR
- **WHEN** native text or OCR exists for a page
- **THEN** the primary extraction remains image-led and records the auxiliary text type and length without allowing it to establish item or section boundaries

#### Scenario: Text evidence is needed
- **WHEN** visual output contains an ambiguous value that text can help verify
- **THEN** a separate evidence or targeted-retry result records the text source and does not silently replace the visual result

#### Scenario: Text-assisted targeted retry
- **WHEN** text is supplied after primary extraction for transcription or price clarification
- **THEN** the lineage records source type, length, reason, attempt, page, and region, and the prompt states that text cannot redefine visual boundaries

### Requirement: Independent item and price contract

Each canonical item SHALL represent one visually independent product or menu entry and SHALL preserve name, optional description, optional single price, optional price variants, modifiers/options/attributes when present, source page, stable item identity, and raw visual values. Prices MUST support one or many variants without assuming labels, currency, or USD semantics.

#### Scenario: Single price
- **WHEN** one product has one visible price
- **THEN** the item contains one raw price value and any parsed amount or currency remains separately optional

#### Scenario: Multiple prices
- **WHEN** one product has size, serving, package, or other visual price variants
- **THEN** the item preserves each variant's label and raw value without hardcoding the label vocabulary or currency

### Requirement: Server-generated identity and canonical bounding boxes

Gemini MUST NOT be treated as the source of stable identifiers for items, sections, candidates, attempts, lineage events, or reconciled sections. After decoding, the server SHALL assign unique deterministic or collision-safe IDs scoped by analysis run, page, attempt, local ordinal, and source or an equivalent strategy. Cross-attempt association MUST use provenance, evidence, bounding boxes, and reconciliation rather than model-generated IDs. All canonical bounding boxes SHALL use normalized coordinates relative to the exact image sent to the model, with origin at the top-left and each coordinate constrained to `0..1`.

#### Scenario: Model repeats or changes an ID
- **WHEN** two attempts return the same, different, or missing model IDs
- **THEN** server-generated IDs remain authoritative and candidate association uses provenance/spatial/evidence signals

#### Scenario: Provider bbox uses another coordinate system
- **WHEN** a provider returns pixels, corners, or another bbox representation
- **THEN** the provider adapter converts it during decode to normalized top-left-origin coordinates and stores the source image width, height, and hash needed to reproduce the conversion

#### Scenario: Regional bbox conversion
- **WHEN** a regional retry operates in rendered-image pixels
- **THEN** its region and item boxes convert deterministically to and from the canonical normalized system, with clipping and overlap calculations using the same coordinate system

### Requirement: Structured semantic validation states

The system SHALL return structured validation for each item with a status equivalent to `valid`, `review`, or `invalid`, plus zero or more reusable reasons. Reasons MUST include existing signals where applicable, including `PRICE_ONLY_NAME`, `MULTIPLE_PRICES_IN_NAME`, `MERGED_NAME`, and suspicious/decorative content, and MAY include `DESCRIPTION_FRAGMENT`, `MISSING_SECTION`, `AMBIGUOUS_PRICE`, `AMBIGUOUS_SECTION`, and `LOW_VISUAL_CONFIDENCE`.

#### Scenario: Ambiguous real product
- **WHEN** an item has a plausible product name but an uncertain price, section, or visual association
- **THEN** it is marked `review` with reasons and remains available for human correction without being represented as definitively valid

#### Scenario: Likely non-product fragment
- **WHEN** a candidate is only an isolated price, description fragment, decorative content, or merged/unusable text
- **THEN** it is marked `invalid` or an equivalent rejected-fragment state and is not persisted as a normal draft menu item

### Requirement: Retry outcomes are not automatically accepted

The system MUST distinguish accepted, reviewable, invalid-fragment, and retry-exhausted outcomes. Exhausting a retry limit MUST NOT promote an item that still violates semantic validation into the accepted product set.

#### Scenario: Retries exhausted with unresolved ambiguity
- **WHEN** all permitted retries complete and a plausible product remains ambiguous
- **THEN** the result is `review` or `retry_exhausted` with validation reasons, not silently accepted as clean

#### Scenario: Retries exhausted with invalid fragment
- **WHEN** all permitted retries complete and the result remains a likely non-product fragment
- **THEN** the fragment is retained as diagnostic evidence if configured but excluded from normal draft persistence

### Requirement: Bounded and observable call budgets

The system SHALL enforce server-configurable per-page defaults of one primary visual attempt, at most one semantic full-page retry, and at most two regional semantic retries. Provider-transient retries SHALL have a separate bounded budget and counters. Retry loops MUST terminate at a budget or terminal outcome, and lineage/metrics SHALL distinguish attempts, semantic retries, regional retries, provider-transient retries, and recovery.

#### Scenario: Semantic budget is exhausted
- **WHEN** a page has consumed its primary, full-page, or regional semantic budget
- **THEN** no additional semantic request is issued and the result retains its validation and retry-exhausted metadata

#### Scenario: Provider transient failure
- **WHEN** networking or rate behavior causes a transient provider retry
- **THEN** it is counted separately from semantic retries and remains bounded without creating an unobserved semantic attempt

### Requirement: Targeted and spatially reconciled retries

Retries SHALL be motivated by validation reasons and SHALL preserve attempt, source, reason, page, and optional region metadata. Regional retries MUST carry a bounding region and MUST be merged by spatial overlap, item identity/evidence, and section context rather than by blind array concatenation.

#### Scenario: Merged item retry
- **WHEN** validation reports `MERGED_NAME`
- **THEN** a retry requests independent visual items, column/vertical separation, price alignment, descriptions, and typographic hierarchy

#### Scenario: Regional repair
- **WHEN** only a dense or defective page area requires another extraction
- **THEN** the regional result replaces or repairs the affected spatial area, deduplicates overlapping items, and preserves provenance for both the original and replacement attempts

### Requirement: Conservative document-level reconciliation

After page-level perception, the system SHALL perform a document-level reconciliation that can identify section continuity, equivalent section identities, and global metadata. A section MAY inherit continuity normally only from the immediately adjacent prior page and only when evidence supports it. A clear new heading on the current page MUST take precedence.

#### Scenario: Adjacent continuation
- **WHEN** a page has no new clear heading and declares or visually supports continuation from the immediately preceding page
- **THEN** reconciliation may link the section with explicit continuation evidence and retains both page-level and document-level identities

#### Scenario: Distant prior section
- **WHEN** a page lacks a heading but the only matching section is several pages earlier
- **THEN** reconciliation MUST NOT inherit that distant section automatically

### Requirement: Provenance survives normalization and persistence

The system SHALL preserve page number, section identity/key, item identity, bounding box when available, raw values, validation reasons, extraction source, attempt, model, retry reason, and reconciliation references until validation and reconciliation complete. Any flattened persistence payload MUST retain references to that provenance.

#### Scenario: Review of a rejected or ambiguous item
- **WHEN** an administrator inspects a review result or diagnostic
- **THEN** the system can identify the source page, section/item identity, attempt/source, reasons, and raw value that produced it

### Requirement: Durable extraction lineage

The system SHALL make it possible to reconstruct each persisted or rejected item through rendered-page metadata, Gemini input metadata, raw output or a bounded debug reference, decoded output, validation, retries, reconciliation, normalization, and persistence. Stored lineage MUST include render dimensions/MIME/size/hash or storage reference; model, extractor version, attempt, retry reason, region, auxiliary text metadata, latency, and token usage when available.

#### Scenario: Defective item investigation
- **WHEN** a future item is identified as defective
- **THEN** operators can determine whether it originated in the primary model response, textual evidence/fallback, a page retry, a regional retry, or post-processing

#### Scenario: Privacy and cost bounds
- **WHEN** lineage is stored
- **THEN** credentials are excluded, large duplicate images are referenced by hash/storage identifier where possible, raw payload retention follows a bounded debug policy, and client-visible responses expose only safe diagnostics

### Requirement: Lineage retention policy

The system SHALL retain durable lineage for analysis run, page, attempt, source kind, extractor/model version, retry reason, region reference, item/section provenance references, validation status/reasons, reconciliation decisions, and final persistence linkage. Raw provider payload retention SHALL be configurable with a default of seven days; after expiry, its hash/reference and decoded/validation diagnostics SHALL remain. Rendered images SHALL not be duplicated inside lineage, and credentials, authorization headers, and unnecessary sensitive provider error internals MUST never be stored.

#### Scenario: Raw payload expires
- **WHEN** the configured raw retention period elapses
- **THEN** the raw payload may be deleted while durable lineage still identifies the attempt and preserves derived diagnostics sufficient to trace the item

#### Scenario: Lineage is inspected
- **WHEN** an operator investigates a candidate after raw expiry
- **THEN** the operator can still identify render metadata/hash, provider attempt, source, validation, reconciliation, and persistence linkage

### Requirement: Text fallback isolation

The textual parser MUST NOT preserve mutable category state across page boundaries. Text fallback results MUST remain distinguishable from visual extraction and MUST be classified as evidence or reviewable output unless the page could not technically be rendered and the fallback policy explicitly permits otherwise.

#### Scenario: Page-local fallback
- **WHEN** text parsing runs for a page
- **THEN** that page starts without a category inherited from an earlier page, and its output records its textual source and fallback status

#### Scenario: Renderable page with visual failure
- **WHEN** a page is renderable but visual extraction fails validation
- **THEN** textual parsing does not create an indistinguishable clean draft item merely because it is available

### Requirement: Review-aware persistence and UI

Only `valid` items SHALL enter the normal draft item payload. `review` items SHALL be stored as editable review candidates with provenance and may be promoted by explicit human correction. `invalid` items SHALL be stored only as extraction issues/diagnostics when retention policy permits and SHALL NOT be represented in the UI as normal menu items with a missing category. `retry_exhausted` SHALL describe execution history and SHALL never itself change `invalid` into `review` or `valid`.

#### Scenario: Normal draft persistence
- **WHEN** an item is semantically valid after reconciliation
- **THEN** it may be persisted as a normal draft item with provenance references

#### Scenario: Fragment presentation
- **WHEN** an item is invalid as a product
- **THEN** it is shown, if retained, as an extraction issue/evidence record rather than as a dish that only lacks a category

#### Scenario: Human correction of review candidate
- **WHEN** an administrator corrects a `review` candidate
- **THEN** the candidate can be promoted explicitly to a valid draft item while preserving its original extraction and correction provenance

### Requirement: Deterministic and live evaluation separation

The system SHALL support deterministic automated tests using mocked provider responses, sanitized recorded responses, and synthetic page/candidate structures for decoding, validation, retry planning, bbox conversion, regional merge, deduplication, reconciliation, fallback isolation, persistence gates, and API/UI projections. Live Gemini evaluation SHALL be a separate workflow and MUST NOT be required for deterministic CI tests.

#### Scenario: CI deterministic test run
- **WHEN** automated unit or integration tests run without provider credentials
- **THEN** they execute reliably against fixtures and do not depend on live model variation

#### Scenario: Live evaluation run
- **WHEN** live Gemini evaluation is explicitly run against Subarashii or generic PDFs
- **THEN** it records structural metrics and lineage separately from deterministic test results and clearly reports provider/credential requirements

### Requirement: Centralized generic deduplication policy

Regional and cross-attempt deduplication thresholds SHALL be centralized server configuration and MUST NOT be hardcoded for a restaurant or fixture. The algorithm SHALL be able to use bbox IoU/overlap, normalized name similarity, raw price compatibility, section context, and source attempt/retry relationship. Calibration SHALL include synthetic and multiple-layout fixtures in addition to Subarashii.

#### Scenario: Deduplication is configured
- **WHEN** a regional retry is merged with page-level results
- **THEN** the same centralized thresholds and coordinate system are used, and the merge records all contributing provenance

#### Scenario: New layout is evaluated
- **WHEN** a synthetic or non-Subarashii layout is evaluated
- **THEN** deduplication behavior is measured without restaurant-specific names, categories, or thresholds

### Requirement: Versioned analyzer availability

The system SHALL identify the new implementation as `menu-import-v4-visual` and SHALL keep the prior analyzer available for existing imports, comparison, and rollback of new jobs.

#### Scenario: Version comparison
- **WHEN** the same import is evaluated under v3 and v4
- **THEN** both results remain attributable by analyzer version and can be compared without overwriting the other lineage

#### Scenario: Rollback
- **WHEN** rollout verification fails
- **THEN** new jobs can select v3 while existing imports remain readable and v4 lineage is preserved for diagnosis
