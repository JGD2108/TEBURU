## Purpose

Provides an isolated, opt-in evaluator for measuring whether one complete native-text menu document can be structured by Gemini without affecting production imports or visual analysis.

## ADDED Requirements

### Requirement: Isolated native-text document evaluation
The system MUST provide an opt-in evaluation path that obtains native text locally from every PDF page, constructs a page-preserving textual document, and evaluates it separately from production analyzers. The provider input MUST contain only the evaluation instructions and the serialized textual document. It MUST NOT contain PDF bytes, rendered pages, images, OCR output, bounding boxes, selected-text dumps, or any other documentary input.

#### Scenario: Evaluation receives only native text
- **WHEN** an authorized operator runs the text-only evaluator with a readable PDF
- **THEN** the provider request contains page-marked native text and no image, PDF, or OCR input

#### Scenario: Production analyzers remain isolated
- **WHEN** the evaluator runs
- **THEN** it does not invoke V3, `menu-import-v4-visual`, the full-PDF evaluator, worker, dispatcher, persistence, drafts, UI, Supabase, or migrations

### Requirement: Page-preserving TextDocument
The system MUST represent native extraction as a TextDocument containing every source page, page numbers, source TextItem order, useful separators, and extracted text. Its serializer MUST emit explicit page boundaries, preserve item order, and apply only deterministic, traceable normalization. It MUST NOT rely solely on `hasEOL` or collapse all whitespace such that source separation is lost. The evaluator MUST report per-page text coverage and MUST terminate with `not_evaluable` and zero provider requests when native text is materially insufficient for the complete document.

#### Scenario: Page boundaries survive serialization
- **WHEN** a PDF has multiple extracted pages
- **THEN** the serialized input identifies every page with an explicit page marker in original page order

#### Scenario: Sparse end-of-line metadata is tolerated
- **WHEN** native TextItems lack useful `hasEOL` markers
- **THEN** serialization preserves their original order and separator evidence without inventing visual layout

#### Scenario: Native text is insufficient
- **WHEN** the complete TextDocument has fewer than 200 non-whitespace characters, fewer than 10 non-empty TextItems, or fewer than 20 percent of its pages with at least 20 non-whitespace characters
- **THEN** the evaluator reports per-page coverage as `not_evaluable`, makes zero provider requests, and does not fall back to OCR or another extractor

### Requirement: One-request hard invariant
Each live text-only evaluation MUST have a maximum `generateContent` request budget of one. The evaluator MUST consume that budget immediately before provider access and MUST reject a second provider attempt locally before network access. It MUST NOT perform provider, semantic, regional, page, timeout, rate-limit, fallback, secondary-model, V3, or V4 retries.

#### Scenario: Second request is blocked locally
- **WHEN** the evaluator attempts a second provider call in one execution
- **THEN** it raises a local request-budget error before contacting Gemini

#### Scenario: Provider failure terminates execution
- **WHEN** the single provider request errors, times out, returns malformed output, or returns an unsuccessful HTTP status
- **THEN** the evaluator emits a sanitized terminal report and makes no further provider request

### Requirement: Text-only structured transport and canonical identity
The evaluator MUST request a transport document containing page number, sections, section title, items, item name, optional description, raw price, optional price variants, and explicit uncertainty where associations are not established. The DTO schema MUST require `pages`, `pageNumber`, `sections`, `items`, and non-empty `name`, reject unknown fields, and represent uncertainty as optional `priceAssociation` and `descriptionAssociation` values of `certain`, `ambiguous`, or `absent`. The transport contract MUST NOT require model-generated persistent IDs, bounding boxes, visual confidence, or image metadata. After decoding, the evaluator MUST adapt the result to the canonical menu hierarchy and assign all persistent section, item, and candidate identities on the server.

#### Scenario: Transport output has no visual fields
- **WHEN** the evaluator creates a text-only provider request
- **THEN** its response schema does not require BBoxes, coordinates, image metadata, visual confidence, or authoritative model IDs

#### Scenario: Server assigns canonical identity
- **WHEN** a valid text-only transport response is decoded
- **THEN** canonical section, item, and candidate IDs are generated server-side and provider hints are non-authoritative

### Requirement: Structural text-document validation
The evaluator MUST validate structured JSON independently from semantic quality. Structural validation MUST report expected and returned page counts, returned page numbers, missing pages, unexpected pages, duplicated pages, out-of-order pages, malformed pages, malformed sections, and malformed items. A result with incomplete, unexpected, duplicate, or unordered page coverage MUST report `FULL_TEXT_DOCUMENT_VALID=false` even when individual items are useful. Source pages with no native text MUST remain represented in expected coverage and cannot be silently omitted as semantically successful.

#### Scenario: Missing page invalidates complete text result
- **WHEN** any expected source page is absent from the transport response
- **THEN** the evaluator reports it as missing and marks structural and full-text-document validity false

#### Scenario: Duplicate or unordered pages are retained as evidence
- **WHEN** the response duplicates or reorders pages
- **THEN** the evaluator reports the original response defects before any reconciliation can alter page order

#### Scenario: Unexpected page invalidates completeness
- **WHEN** the response includes a non-integer, out-of-range, or otherwise unexpected page number
- **THEN** the evaluator reports it as unexpected or malformed and marks structural and full-text-document validity false

### Requirement: Geometry-independent text-semantic validation
The evaluator MUST classify decoded candidates as `valid`, `review`, or `invalid` using only text-compatible signals. It MUST detect unusable names, price-only names, multiple prices in a name, merged-name signals, decorative/header/footer-like content, missing sections, duplicate normalized name/price signals, description fragments, and ambiguous prices. `PRICE_ONLY_NAME`, multiple-price names, and decorative fragments are invalid; `DESCRIPTION_FRAGMENT`, `AMBIGUOUS_PRICE`, and `MISSING_SECTION` are review unless other invalid signals are present. It MUST NOT use BBox validity, visual confidence, IoU, spatial deduplication, or regional merge.

#### Scenario: Ambiguous price remains uncertain
- **WHEN** source text or model output does not reliably establish a price-to-item association
- **THEN** the evaluator records `AMBIGUOUS_PRICE` and classifies the candidate as review rather than inventing a price association

#### Scenario: Description fragment is not promoted automatically
- **WHEN** a candidate is likely a standalone fragment of descriptive prose rather than an independent dish
- **THEN** the evaluator records `DESCRIPTION_FRAGMENT` and retains it as review unless evidence makes it clearly invalid

### Requirement: Adjacent-only category continuity
The evaluator MUST start each page without mutable category state inherited from earlier pages. Canonical reconciliation MAY link an unheaded section only to supported continuity on the immediately preceding page. An explicit current-page heading MUST take precedence, and a category from a non-adjacent page MUST NOT become active automatically.

#### Scenario: Distant category cannot leak
- **WHEN** a page lacks evidence of immediate continuity from its preceding page
- **THEN** a category from any earlier non-adjacent page is not assigned to that page's items

#### Scenario: Current heading wins
- **WHEN** the current page contains an explicit heading
- **THEN** that heading is retained even if a prior adjacent section has a compatible title

### Requirement: Ephemeral evaluation report and fixture assessment
The evaluator MUST produce a safe in-memory or git-ignored local report containing model/API metadata, request count, input character and token estimates, provider token usage when available, latency, finish reason, response bytes, TextDocument and PDF hashes, serializer/prompt/schema versions, structural results, semantic totals, reason counts, and A/B/C/D classification. Classification version 1 MUST use these generic thresholds after a successful non-truncated structurally valid response: A requires invalid rate at most 2 percent, review rate at most 10 percent, and ambiguous-price rate at most 5 percent; B requires invalid rate at most 10 percent and review rate at most 35 percent; C covers structurally valid results outside A/B; D covers terminal provider failures, zero items, truncation, or structural invalidity. It MUST not retain secrets or write durable lineage, persistence records, drafts, or Supabase data. Fixture-specific assertions for pages 2, 3, 4, 5, 6, 9, 19, and 20 MUST exist only in evaluation or test code.

#### Scenario: Report contains safe evidence
- **WHEN** an evaluation finishes or terminates
- **THEN** it exposes sanitized metrics and provenance without API keys, authorization headers, raw secrets, drafts, or durable database records

#### Scenario: Classification has no rollout side effect
- **WHEN** the evaluator classifies a result A, B, C, or D
- **THEN** it does not change analyzer selection, V4 behavior, import persistence, or rollout configuration

### Requirement: Deterministic and opt-in live verification
The system MUST provide deterministic tests covering TextDocument preservation, serialization, one-request enforcement, transport decoding, server IDs, structural failures, text-semantic outcomes, adjacent-only continuity, fixture isolation, and no-persistence/no-fallback behavior. The live evaluator MUST require explicit opt-in and server-side credentials, remain excluded from normal CI, and use `gemini-3.5-flash-lite` as its spike-exclusive configurable default without changing V4 configuration.

#### Scenario: Deterministic tests use no provider quota
- **WHEN** deterministic evaluation tests run
- **THEN** they require no Gemini credentials and make no provider request

#### Scenario: Live test requires explicit authorization
- **WHEN** the explicit live flag is absent
- **THEN** the text-only evaluator makes no provider request
