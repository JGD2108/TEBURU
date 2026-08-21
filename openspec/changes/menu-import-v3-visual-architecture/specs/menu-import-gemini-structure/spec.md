## MODIFIED Requirements

### Requirement: Text-only Gemini structuring

The system SHALL use Gemini multimodally for primary menu perception by sending only the rendered page image, extractor instructions/schema, page number, and minimum technical metadata, and requesting page-scoped sections and independent items. Native text, OCR, and selected text dumps MUST NOT be sent in the primary request; they MAY be retained as evidence or used in a separately identified targeted retry. The original PDF bytes MUST NOT be sent to this provider.

#### Scenario: Visual extraction is available
- **WHEN** a renderable page is processed and Gemini is configured
- **THEN** the request includes the rendered image, identifies the image metadata and page, and the output is decoded as page sections and items

#### Scenario: Text is useful but visual extraction remains authoritative
- **WHEN** OCR or native text can clarify a price or transcription
- **THEN** it is marked as auxiliary evidence or targeted-retry input and cannot silently redefine visual boundaries

#### Scenario: No usable visual or textual input exists
- **WHEN** the page cannot be rendered and no usable native/OCR text exists
- **THEN** the system records a reviewable/retryable extraction outcome without persisting normal draft items

### Requirement: Structured and validated menu output

The system SHALL request and validate a page-scoped structured response containing sections and independent items with name, optional description, raw single or variant prices, source page, model-provided visual hints, optional normalized bounding boxes, and extraction confidence. Gemini-provided IDs MUST NOT be authoritative; the server assigns stable IDs after decode. The system MUST reject malformed JSON, invalid page references, unusable names, isolated-price candidates, description fragments, and unresolved merged candidates from normal accepted persistence. Validation MUST return a status and reasons rather than only a boolean.

#### Scenario: Valid visual response
- **WHEN** Gemini returns a response matching the supported page/section/item schema
- **THEN** the system preserves the canonical hierarchy, provenance, raw values, and validation result for reconciliation

#### Scenario: Semantically invalid response
- **WHEN** Gemini returns a likely fragment, merged item, or otherwise invalid product candidate
- **THEN** the system records reasons and either retries or routes the candidate to review/diagnostics without treating it as a valid draft item

### Requirement: Safe fallback and bounded provider use

The system SHALL keep provider calls bounded with defaults of one primary visual attempt, at most one semantic full-page retry, and at most two regional semantic retries per page. Provider-transient retries SHALL be separately bounded and observed. The system SHALL preserve a distinguishable fallback/evidence path when Gemini is unavailable, unconfigured, times out, rate-limited, or fails validation. The textual parser MUST reset page-local state for every page and MUST NOT be an indistinguishable equivalent of successful visual extraction.

#### Scenario: Gemini unavailable
- **WHEN** Gemini cannot be called
- **THEN** the import reaches a retryable or reviewable state with fallback lineage and does not automatically promote textual fragments to clean visual items

#### Scenario: Gemini response fails validation
- **WHEN** a model response fails schema or semantic validation
- **THEN** the system records the failure and uses a reason-specific retry or isolated evidence path, not an identical untracked request followed by automatic acceptance

### Requirement: Provider lineage

The system SHALL record provider, model, extractor version, attempt, retry reason, page/region, auxiliary text metadata, and outcome for every analysis source. Existing review, approval, and publication gates MUST remain unchanged, while client-visible diagnostics MUST exclude credentials and sensitive provider details.

#### Scenario: Primary or retry succeeds
- **WHEN** Gemini produces a page or regional result
- **THEN** lineage identifies the exact attempt and source that contributed each accepted, reviewable, or rejected candidate

#### Scenario: Local fallback is used
- **WHEN** textual fallback supplies evidence or a review result
- **THEN** lineage identifies the fallback, page, parser state boundary, and reason it was used
