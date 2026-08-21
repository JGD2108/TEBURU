## Purpose

Provides an isolated, opt-in evaluator for determining whether one native-PDF Gemini request can return a complete hierarchical menu document without affecting production imports or persistence.

## ADDED Requirements

### Requirement: Isolated native-PDF full-document evaluation
The system MUST provide an opt-in evaluation path that accepts a complete PDF as the only documentary input and evaluates it separately from production menu-import analyzers. The path MUST use `gemini-3.7-flash` with `v1beta/models/{model}:generateContent`, send the PDF as `application/pdf` inline data, request JSON structured output, and use a maximum output budget of 65536 tokens. It MUST NOT attach native extracted text, OCR text, selected text, or other external textual dumps.

#### Scenario: Evaluation uses the complete native PDF
- **WHEN** an authorized operator starts the opt-in full-document evaluator with a valid PDF
- **THEN** it sends one request containing only the evaluation prompt and the native PDF as `application/pdf`

#### Scenario: Production analyzers remain isolated
- **WHEN** the evaluator is run
- **THEN** it does not invoke the production worker, dispatcher, page-by-page extraction path, or a V3 analyzer

### Requirement: One-request hard invariant
Each live evaluation execution MUST have a maximum `generateContent` request budget of one. The evaluator MUST consume the budget before contacting the provider and MUST fail locally before a second provider call can be issued. It MUST NOT perform provider, semantic, regional, page, timeout, rate-limit, or fallback retries.

#### Scenario: Second call is blocked locally
- **WHEN** evaluation code attempts a second provider request in the same execution
- **THEN** the evaluator raises a local request-budget error before contacting Gemini

#### Scenario: Provider failure terminates the evaluation
- **WHEN** the single provider request returns an HTTP error, times out, or has malformed output
- **THEN** the evaluator terminates without issuing another provider request

### Requirement: Preflight and payload integrity
Before consuming its request budget, the evaluator MUST verify that the PDF exists, has nonzero bytes, has a valid page count, preserves the original PDF buffer after local PDF inspection, and uses `application/pdf`. It MUST verify that Base64 decoding preserves the original byte count and SHA-256 hash, and that the outgoing PDF part is present and decodes to the original bytes. A fixture-specific evaluator MAY additionally require its known page count and hash. A preflight failure MUST report `REQUEST_COUNT=0` and MUST NOT contact Gemini.

#### Scenario: Detached buffer regression is prevented
- **WHEN** local PDF page inspection transfers or detaches its input buffer
- **THEN** the evaluator retains an intact original PDF buffer for payload construction

#### Scenario: Payload mismatch is rejected
- **WHEN** the outgoing PDF part is absent, empty, or decodes to bytes or a hash different from the source PDF
- **THEN** preflight fails before a provider request is made

### Requirement: Canonical document decoding and server identity
The evaluator MUST decode a successful structured response into the existing canonical visual menu document hierarchy of pages, sections, and items. It MUST assign item, candidate, and section identities on the server after decode and MUST NOT trust provider-generated identifiers as persistent identity.

#### Scenario: Provider identifiers are not persisted as authority
- **WHEN** the response contains section identifiers
- **THEN** the evaluator retains them only as non-authoritative model hints and assigns server-generated identities for the canonical document

### Requirement: Strict structural document validation
The evaluator MUST separately report structural validity of the returned document. Structural validity MUST require valid JSON and page objects, exactly the expected page-number set, no duplicate page numbers, correct page order, and no malformed sections or items. A partial response MAY be reported for investigation but MUST have `FULL_DOCUMENT_EXTRACTION_VALID=false`.

#### Scenario: Missing page invalidates completeness
- **WHEN** a response omits any expected PDF page
- **THEN** the evaluator reports that page in `MISSING_PAGES` and marks structural and full-document validity false

#### Scenario: Duplicate or unordered pages invalidate completeness
- **WHEN** a response repeats a page number or returns pages outside ascending document order
- **THEN** the evaluator reports the duplicate or order violation and marks structural and full-document validity false

### Requirement: Separate V4 semantic validation
After successful canonical decode, the evaluator MUST reuse V4 semantic validation to classify every item as `valid`, `review`, or `invalid` with existing validation reasons. Semantic item quality MUST be reported separately from structural document completeness.

#### Scenario: Structurally complete document can contain invalid items
- **WHEN** every expected page is present but an item is an isolated price or decorative fragment
- **THEN** the document may remain structurally complete while that item is reported as semantically invalid

### Requirement: Ephemeral evaluation report and lineage
The evaluator MUST emit a safe evaluation-only report containing request count, HTTP status, model, API version, PDF bytes/page count/hash, request-payload hash, latency, token usage when available, finish reason, response bytes, page-completeness details, structural result, item/section totals, semantic status totals, validation-reason counts, and final full-document result. It MUST NOT write drafts, imports, persistence records, durable lineage, Supabase data, credentials, authorization headers, or raw secrets.

#### Scenario: Safe live report
- **WHEN** an evaluation completes or terminates
- **THEN** it exposes only sanitized metrics and evaluation provenance without provider credentials or raw secrets

### Requirement: Evaluation-only fixture assessment and classification
The evaluator MUST support evaluation-only assertions for designated fixture pages and classify each completed evaluation as A, B, C, or D. Fixture-specific names, categories, prices, and heuristics MUST NOT affect production extraction. The classification MUST NOT automatically change analyzer selection or production architecture.

#### Scenario: Subarashii fixture remains isolated
- **WHEN** pages 2, 3, 4, 5, 6, 9, 19, or 20 are assessed
- **THEN** their assertions execute only in evaluator or test code and do not enter production logic

#### Scenario: Classification has no production side effect
- **WHEN** an evaluation is classified A, B, C, or D
- **THEN** `menu-import-v4-visual` configuration and behavior remain unchanged

### Requirement: Deterministic and opt-in live verification
The system MUST provide deterministic tests for preflight integrity, one-request enforcement, structural validation, semantic outcomes, classification, and fixture isolation without contacting Gemini. The live evaluator MUST be opt-in, require server-side credentials, and remain excluded from normal CI.

#### Scenario: Deterministic suite consumes no provider quota
- **WHEN** normal deterministic tests run
- **THEN** no Gemini credentials or live provider request are required

#### Scenario: Live evaluation requires explicit opt-in
- **WHEN** no explicit live-evaluation flag is present
- **THEN** the full-document evaluator does not issue a provider request
