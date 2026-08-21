## MODIFIED Requirements

### Requirement: Text-only Gemini structuring
The system SHALL optionally send page-numbered native or OCR text to a configured Gemini model to identify menu categories and items. The system MUST NOT send the original PDF bytes, rendered page images, or extracted image assets to this structuring provider. When `menu-import-v5-text` is selected, it MUST use only native PDF text from every readable page and one full-document text-only request; it MUST NOT use OCR for that analyzer.

#### Scenario: Text extraction is available

- **WHEN** a menu import has extracted text pages and Gemini is configured
- **THEN** the system sends only those page numbers and text contents for structuring

#### Scenario: No usable text exists

- **WHEN** native extraction and OCR produce no usable page text
- **THEN** the system does not call Gemini and reports an extraction result that requires review or retry

#### Scenario: V5 receives sufficient native text

- **WHEN** a V5 menu import has sufficient native text from all readable source pages
- **THEN** the system sends one page-marked, full-document native-text request without OCR, PDF, or image input

### Requirement: Structured and validated menu output

The system SHALL request and validate a structured response containing item name, optional description, optional non-negative price, category, source page, and field-level confidence. The system MUST reject malformed JSON, unknown fields when disallowed, invalid prices, invalid page references, and items without a usable name rather than persisting them as valid draft entries. For V5, the transport contract MUST also preserve page sections, raw prices or variants, and explicit price/description association uncertainty; page-set validation MUST complete before reconciliation and persistence.

#### Scenario: Gemini returns valid menu entries

- **WHEN** Gemini returns a response matching the supported schema
- **THEN** the system normalizes the entries and persists them as reviewable draft categories, items, and page evidence

#### Scenario: Non-V5 Gemini returns invalid output

- **WHEN** a non-V5 Gemini integration returns malformed, incomplete, or semantically invalid output
- **THEN** the system discards that response, records a diagnostic, and uses the local parser fallback

#### Scenario: V5 output has an ambiguous price

- **WHEN** V5 returns an item whose price association is ambiguous
- **THEN** the system preserves the raw value and review reason without inventing a normalized price or persisting it as valid

### Requirement: Safe fallback and bounded provider use

The system SHALL preserve the local parser as a fallback when Gemini is unconfigured, unavailable, rate-limited, times out, or fails validation. Provider calls MUST have a bounded timeout and MUST NOT prevent the durable import job from reaching a retryable or reviewable state. This fallback requirement does not apply to V5: for V5, one provider request is the maximum automatic request budget per analysis attempt, and a provider failure or rejected response MUST remain an explicit retryable or diagnostic outcome without local-parser draft substitution.

#### Scenario: Gemini is not configured

- **WHEN** no server-side Gemini key is available
- **THEN** the system structures the extracted text with the local parser and continues the existing import flow

#### Scenario: Gemini request fails

- **WHEN** a Gemini request fails or exceeds its timeout
- **THEN** the system records the provider failure, runs the local parser, and preserves the import's page evidence

#### Scenario: V5 request fails

- **WHEN** the sole V5 request is unavailable, rate-limited, times out, or fails validation
- **THEN** the system records the failure without a local-parser fallback draft and leaves the import in its explicit retryable or diagnostic outcome

### Requirement: Provider lineage

The system SHALL record whether each analysis used Gemini or the local fallback, including the configured model when Gemini was used, in server-side analysis lineage and diagnostics. Existing review, approval, and publication gates MUST remain unchanged. For V5, lineage MUST distinguish native-text input, one-request usage, structural validity, text-semantic outcomes, and a no-fallback outcome.

#### Scenario: Gemini succeeds

- **WHEN** Gemini produces the accepted structure
- **THEN** the analysis lineage identifies Gemini and the model used

#### Scenario: Local fallback is used

- **WHEN** Gemini is unavailable or its response is rejected
- **THEN** the analysis lineage identifies the local fallback and retains the provider failure reason for diagnostics

#### Scenario: V5 reaches a terminal provider outcome

- **WHEN** V5 succeeds, is rejected structurally, or encounters a provider failure
- **THEN** lineage records its model, attempt, native-text provenance, and terminal outcome without claiming a local fallback was used
