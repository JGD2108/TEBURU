## ADDED Requirements

### Requirement: Advisory V5 decision metadata
The V5 structured response contract MUST require each candidate to include a recommendation of `approve`, `review`, or `reject`, a numeric reported confidence between 0 and 1, and bounded reason codes. Unknown recommendation values, non-finite or out-of-range confidence, and unrecognized reason codes MUST fail strict decoding. The raw provider recommendation MUST remain separate from the authoritative server semantic status and bulk-approval eligibility result.

#### Scenario: Valid advisory metadata is decoded
- **WHEN** a V5 response includes a supported recommendation, in-range confidence, and recognized reasons
- **THEN** the decoder preserves those values as advisory metadata for server validation and lineage

#### Scenario: Advisory metadata conflicts with validation
- **WHEN** the provider recommends approval but authoritative server validation returns `review` or `invalid`
- **THEN** the server status controls persistence and eligibility while the raw recommendation remains traceable

#### Scenario: Advisory metadata is malformed
- **WHEN** recommendation, confidence, or reason metadata violates the strict schema
- **THEN** the response is rejected according to the existing V5 malformed-output policy without a fallback draft or second provider request
