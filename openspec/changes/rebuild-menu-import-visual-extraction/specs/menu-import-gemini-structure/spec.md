## MODIFIED Requirements

### Requirement: Visual Gemini structuring

The system SHALL analyze bounded high-resolution visual representations of each PDF page with a configured multimodal Gemini model to reconstruct menu structure. Native PDF text and OCR MAY be supplied as auxiliary evidence, but they MUST NOT replace visual layout analysis. The extractor MUST discover sections, nested sections, columns, tables, item groupings, and page-level continuation from the document rather than relying on fixed category names, languages, currencies, positions, page counts, or restaurant-specific rules.

#### Scenario: A page contains multiple columns and sections

- **WHEN** a menu page contains independent visual columns or multiple section headings
- **THEN** the result assigns each item to the visually associated section and does not concatenate column text into a single item

#### Scenario: A page is image-only or text extraction is unusable

- **WHEN** native extraction and OCR provide no reliable text but the page can be rendered
- **THEN** Gemini analyzes the page image and returns structured candidates with page evidence

#### Scenario: A section continues across pages

- **WHEN** a later page has no new heading but visual/document evidence indicates continuation
- **THEN** the result may retain the previous section only when that continuation is supported by evidence; it MUST NOT inherit the section blindly

### Requirement: Structured menu output preserves observed information

The system SHALL request and validate structured JSON containing document metadata, pages, dynamically discovered hierarchical sections, and menu items. An item MUST preserve its observed name, optional description, optional raw price data, source page, and confidence/review state. The schema MUST support multiple price variants, shared prices, modifiers, options, attributes, parent sections, unresolved currencies, and optional bounding boxes. Raw observed values MUST remain available when normalization is uncertain. A missing category or price MUST be represented as missing/reviewable data rather than fabricated.

#### Scenario: A product has multiple visual price columns

- **WHEN** a product is displayed with labeled prices such as size, serving, glass, or bottle variants
- **THEN** the result stores one price variant per visual label and does not create the labels as separate products

#### Scenario: A price cannot be normalized confidently

- **WHEN** the document displays a price whose currency or amount interpretation is uncertain
- **THEN** the result preserves the raw string, leaves uncertain normalized fields null, and marks the item for review

#### Scenario: A product has no visible description or price

- **WHEN** only the product name is visually identifiable
- **THEN** the result retains the name, stores absent fields as null/empty according to the schema, and does not invent content

### Requirement: Deterministic validation, retry, and document reconciliation

The system MUST validate model output both against the structural schema and against deterministic menu-quality checks before persistence. Checks MUST identify at least merged product strings, price-only names, multiple prices embedded in names, invalid page references, suspicious category assignments, non-product decorative content, and pages whose visual content is inconsistent with the extracted count. Suspicious pages MUST receive a bounded retry with a problem-specific instruction, optionally using visual subregions as a fallback. Accepted page results MUST be reconciled at document level for section continuation, repeated headings, conservative duplicate detection, and global price metadata before persistence.

#### Scenario: The first result merges several products

- **WHEN** validation detects a name containing multiple likely products or price tokens
- **THEN** the system retries the affected page with instructions to use typography, spacing, alignment, and column boundaries to separate products

#### Scenario: A retry remains ambiguous

- **WHEN** bounded full-page and regional retries cannot establish a reliable association
- **THEN** the system preserves the candidates with review reasons and evidence instead of silently discarding or inventing structure

#### Scenario: Results contain repeated products across retries

- **WHEN** reconciliation sees candidates from overlapping or retried analyses
- **THEN** it removes only duplicates supported by page, section, description, price, and source evidence; same-named products in distinct contexts remain separate

### Requirement: Safe provider use and fallback

The system SHALL retain a deterministic local extraction fallback when Gemini is unconfigured, unavailable, rate-limited, times out, returns malformed output, or produces results that fail validation. Provider calls and retries MUST be bounded and MUST NOT prevent the durable import from reaching a retryable or reviewable state. The fallback MUST preserve page evidence and MUST NOT apply restaurant-specific category or price rules.

#### Scenario: Gemini is not configured

- **WHEN** no server-side Gemini configuration is available
- **THEN** the system uses the local fallback, records the reason, and leaves the import reviewable

#### Scenario: Gemini returns a structurally valid but semantically suspicious result

- **WHEN** deterministic checks reject the model result
- **THEN** the system performs the bounded targeted retry flow and falls back safely if the result remains unacceptable

#### Scenario: Provider work exceeds its deadline

- **WHEN** the combined provider work reaches its configured deadline
- **THEN** the job records a bounded diagnostic and transitions to a retryable or reviewable state without holding an open persistence transaction

### Requirement: Server-only credentials and source privacy

The system MUST read Gemini credentials and model configuration only in server-side analysis code. Credentials MUST NOT appear in browser bundles, API responses, logs, draft evidence, or client-visible errors. Requests MAY contain rendered page images and auxiliary extracted text required for visual analysis, but MUST NOT contain unrelated tenant data, database credentials, or internal secrets. Provider errors MUST be sanitized before persistence or exposure.

#### Scenario: An administrator opens the review interface

- **WHEN** the browser loads or uses the menu import UI
- **THEN** no Gemini credential or unsanitized provider payload is present in markup, client JavaScript, or API responses

#### Scenario: A multimodal request is created

- **WHEN** the server sends a page to Gemini
- **THEN** it sends only the scoped page representation and permitted auxiliary evidence for that import

#### Scenario: Gemini returns an error containing secret-like details

- **WHEN** the provider error includes request, credential, or infrastructure details
- **THEN** the system stores and exposes only a safe diagnostic code and bounded message

### Requirement: Provider lineage and review observability

The system SHALL record analysis lineage sufficient to reproduce and diagnose an import, including source hash, analyzer/prompt version, model, page count, provider calls, retries, duration, token usage when available, suspicious pages, extracted item counts, review counts, fallback reasons, and errors. Each item and section MUST retain source page evidence and MAY retain normalized bounding boxes. Existing review, approval, tenant isolation, and publication gates MUST remain unchanged.

#### Scenario: Gemini produces accepted visual structure

- **WHEN** a multimodal extraction is accepted
- **THEN** lineage identifies the model/version and records the page and validation metrics for that execution

#### Scenario: Local fallback or retry is used

- **WHEN** provider failure or semantic validation triggers fallback/retry
- **THEN** lineage records the reason, affected pages, attempt count, and resulting review state

#### Scenario: An administrator reviews a suspicious item

- **WHEN** an item is marked for manual review
- **THEN** the review response exposes its safe reason and page evidence without exposing provider secrets

### Requirement: Dark review interface palette

The admin menu-import review experience SHALL use the established dark visual palette: deep slate base/surface colors, light primary text, muted secondary text, coral primary actions, and green success accents. The palette MUST remain compatible with existing semantic CSS variables used by admin components.

#### Scenario: An administrator opens menu-import review

- **WHEN** the review panel renders
- **THEN** the page, cards, controls, text, borders, and status states use the dark palette with sufficient contrast

#### Scenario: A draft has a missing or uncertain price

- **WHEN** an item needs review for price or category ambiguity
- **THEN** the warning state is visible without replacing an absent price with a fabricated zero value
