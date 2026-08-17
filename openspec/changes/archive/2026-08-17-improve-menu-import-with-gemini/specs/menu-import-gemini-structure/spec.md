## Purpose

Improve menu-import draft quality by optionally structuring the text already extracted from each PDF page with a server-side language model, without sending source PDFs or page images outside Teburu.

## ADDED Requirements

### Requirement: Text-only Gemini structuring

The system SHALL optionally send page-numbered native or OCR text to a configured Gemini model to identify menu categories and items. The system MUST NOT send the original PDF bytes, rendered page images, or extracted image assets to this structuring provider.

#### Scenario: Text extraction is available

- **WHEN** a menu import has extracted text pages and Gemini is configured
- **THEN** the system sends only those page numbers and text contents for structuring

#### Scenario: No usable text exists

- **WHEN** native extraction and OCR produce no usable page text
- **THEN** the system does not call Gemini and reports an extraction result that requires review or retry

### Requirement: Structured and validated menu output

The system SHALL request and validate a structured response containing item name, optional description, optional non-negative price, category, source page, and field-level confidence. The system MUST reject malformed JSON, unknown fields when disallowed, invalid prices, invalid page references, and items without a usable name rather than persisting them as valid draft entries.

#### Scenario: Gemini returns valid menu entries

- **WHEN** Gemini returns a response matching the supported schema
- **THEN** the system normalizes the entries and persists them as reviewable draft categories, items, and page evidence

#### Scenario: Gemini returns invalid output

- **WHEN** Gemini returns malformed, incomplete, or semantically invalid output
- **THEN** the system discards that response, records a diagnostic, and uses the local parser fallback

### Requirement: Safe fallback and bounded provider use

The system SHALL preserve the local parser as a fallback when Gemini is unconfigured, unavailable, rate-limited, times out, or fails validation. Provider calls MUST have a bounded timeout and MUST NOT prevent the durable import job from reaching a retryable or reviewable state.

#### Scenario: Gemini is not configured

- **WHEN** no server-side Gemini key is available
- **THEN** the system structures the extracted text with the local parser and continues the existing import flow

#### Scenario: Gemini request fails

- **WHEN** a Gemini request fails or exceeds its timeout
- **THEN** the system records the provider failure, runs the local parser, and preserves the import's page evidence

### Requirement: Server-only credentials and text privacy

The system MUST read the Gemini credential and model configuration only in server-side analysis code. The credential MUST NOT be exposed in browser bundles, API responses, logs, draft evidence, or client-visible errors, and the structuring request MUST contain no source document bytes or image data.

#### Scenario: Browser accesses the admin import UI

- **WHEN** an administrator loads or uses the import UI
- **THEN** no Gemini credential is present in rendered markup, client JavaScript, or API responses

#### Scenario: Provider error is returned

- **WHEN** Gemini returns an error containing request or credential details
- **THEN** the system logs only a sanitized diagnostic and exposes a generic actionable message

### Requirement: Provider lineage

The system SHALL record whether each analysis used Gemini or the local fallback, including the configured model when Gemini was used, in server-side analysis lineage and diagnostics. Existing review, approval, and publication gates MUST remain unchanged.

#### Scenario: Gemini succeeds

- **WHEN** Gemini produces the accepted structure
- **THEN** the analysis lineage identifies Gemini and the model used

#### Scenario: Local fallback is used

- **WHEN** Gemini is unavailable or its response is rejected
- **THEN** the analysis lineage identifies the local fallback and retains the provider failure reason for diagnostics
