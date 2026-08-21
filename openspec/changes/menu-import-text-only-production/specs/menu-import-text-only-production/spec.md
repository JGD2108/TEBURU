## Purpose

Provides a controlled, production-safe text-only analyzer for importing menus from native PDF text while preserving the independent visual import path and existing human review workflow.

## ADDED Requirements

### Requirement: Selectable text-only production analyzer
The system MUST provide `menu-import-v5-text` as a server-side selectable analyzer for new menu-import jobs. The initial rollout MUST be opt-in or otherwise explicitly enabled by server-side configuration. Existing V3 and `menu-import-v4-visual` analyzer selections, historical imports, and V4's model configuration MUST remain available and readable.

#### Scenario: Controlled V5 selection
- **WHEN** an authorized server-side rollout configuration selects `menu-import-v5-text` for a new job
- **THEN** that job records V5 as its analyzer version and uses the text-only path without changing V3 or V4 selection for other jobs

#### Scenario: Rollback selects V4
- **WHEN** an operator changes new-job selection from V5 to V4
- **THEN** subsequently created jobs use V4 while existing V5 jobs remain readable with their recorded analyzer version

### Requirement: Native-text preflight and one-request extraction
The V5 analyzer MUST obtain native text from every readable source-PDF page, preserve page identity and source-item order, and perform a text-sufficiency preflight before provider access. For an eligible document it MUST issue exactly one full-document text-only structured request per automatic analysis attempt. The request MUST use a V5-exclusive server-side model setting whose default is `gemini-3.5-flash-lite` and MUST NOT send PDF bytes, rendered pages, image data, OCR output, selected-text dumps, BBoxes, geometry, or visual confidence.

#### Scenario: Eligible native-text PDF
- **WHEN** a V5 job has sufficient native text
- **THEN** the provider receives one request containing only instructions and page-marked serialized native text

#### Scenario: Insufficient native text
- **WHEN** a V5 source document fails the configured native-text sufficiency preflight
- **THEN** the system records `TEXT_NOT_EVALUABLE` or an equivalent explicit diagnostic, makes zero provider requests, creates no normal drafts, and does not invoke OCR automatically

#### Scenario: Request budget is exhausted
- **WHEN** a V5 automatic analysis attempt has already started its full-document provider request
- **THEN** no additional provider, page, regional, fallback, or secondary-model request is issued within that attempt

### Requirement: Text-only canonical structure and validation
The V5 analyzer MUST accept only the text-only structured transport contract containing pages, sections, items, optional descriptions, raw prices, price variants, and explicit association uncertainty. It MUST reject malformed or unknown transport fields, assign section, item, and candidate IDs on the server, validate exact source-page coverage before reconciliation, and preserve page-local category state. Reconciliation MUST only use supported continuity from the immediately preceding page, and an explicit current-page heading MUST take precedence.

#### Scenario: Complete valid transport result
- **WHEN** the provider returns ordered, complete, schema-valid pages
- **THEN** the system adapts the result to the canonical menu hierarchy with server-generated IDs and records structural validity before semantic validation

#### Scenario: Missing or unordered pages
- **WHEN** the provider omits, duplicates, reorders, or malforms expected pages
- **THEN** the system records the structural defect, creates no normal drafts from that response, and retains a sanitized diagnostic

#### Scenario: Distant category lacks continuity evidence
- **WHEN** an unheaded section has no supported continuation from the immediately preceding page
- **THEN** the system does not assign a category from any earlier page

### Requirement: Review-aware text-only persistence
The V5 analyzer MUST classify candidates using geometry-independent text signals before persistence. `valid` candidates MUST become normal draft items; `review` candidates MUST remain visible and editable in the existing administrative review flow with their provenance and reasons; and `invalid` candidates MUST become extraction issues or diagnostics rather than normal dishes. `AMBIGUOUS_PRICE` MUST remain `review` until a human edits, confirms, or excludes the candidate.

#### Scenario: Ambiguous price requires review
- **WHEN** a candidate has an uncertain price association
- **THEN** the system records `AMBIGUOUS_PRICE`, does not invent a normalized price, and exposes the candidate for price editing, confirmation, or exclusion

#### Scenario: Invalid fragment is excluded from normal draft editing
- **WHEN** a candidate is classified invalid, including a price-only or decorative fragment
- **THEN** it appears as an extraction issue/diagnostic and not as a normal draft item missing a category

### Requirement: Explicit text-provider failure handling
The V5 analyzer MUST treat 429, 503, timeout, malformed provider JSON, and structured-output failure as explicit analysis outcomes. It MUST never silently substitute a local parser result as a successful V5 extraction. Provider-unavailable outcomes MUST be distinguishable as retryable according to the import job state model; non-evaluable and malformed-output outcomes MUST remain diagnosable; and none of those outcomes may create normal drafts.

#### Scenario: Provider is rate limited
- **WHEN** the single V5 provider request returns 429
- **THEN** the system records a sanitized provider-rate-limit outcome, retains attempt metadata, and creates no normal drafts or text-parser fallback drafts

#### Scenario: Structured output is invalid
- **WHEN** the provider response cannot be decoded or fails the transport/structural contract
- **THEN** the system records a sanitized malformed-output diagnostic and creates no normal drafts

### Requirement: Safe text-only lineage and metrics
For V5 imports, the system MUST preserve safe lineage and metrics including analyzer version, model, server attempt identity, PDF and TextDocument hashes, prompt/schema/serializer versions, page and character counts, token usage when supplied, latency, request count, structural findings, semantic totals/reasons, and persistence linkage. It MUST not store credentials, authorization headers, image references, or visual-image lineage for this path. Fallback usage MUST be recorded as none for a successful V5 text-only extraction.

#### Scenario: V5 result is persisted or rejected
- **WHEN** a V5 attempt reaches persistence, review, failure, or rejection
- **THEN** authorized diagnostics can trace the text-only attempt and its outcome without exposing a credential or creating image lineage

### Requirement: Text-only regression and rollout evidence
The system MUST provide deterministic regression coverage for generic native-text menu shapes and a safe no-native-text failure. Subarashii-specific assertions MUST remain only in test or evaluation code and MUST cover the approved target pages, including ambiguous-price review on page 9 and current-page headings on pages 19 and 20. V5 promotion beyond controlled rollout MUST require recorded production-equivalent evidence and a comparison with the available V4 path; a classification alone MUST NOT automatically change global analyzer selection.

#### Scenario: Scanned PDF has no native text
- **WHEN** a scanned or image-only source PDF has insufficient native text
- **THEN** deterministic coverage proves it is marked non-evaluable without a provider request or garbage drafts

#### Scenario: Controlled rollout remains reversible
- **WHEN** controlled V5 evidence is collected
- **THEN** analyzer selection remains an explicit operator decision and V4 remains available for comparison or rollback
