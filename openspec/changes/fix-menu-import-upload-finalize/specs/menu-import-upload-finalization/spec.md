## Purpose

Ensure a menu import cannot be finalized unless the uploaded PDF is actually present in Storage and matches the authorization that was issued for it. This prevents successful finalization from racing ahead of the file upload or accepting the wrong object.

## ADDED Requirements

### Requirement: finalize only accepts a visible uploaded PDF
The system MUST reject menu-import finalization when the authorized PDF object is not present in Storage or cannot be verified as the expected file.

#### Scenario: storage object is not yet visible
- **WHEN** the client submits finalize with a valid authorization
- **AND** the authorized object cannot be found in Storage
- **THEN** the system MUST return a 422 response with a stable error code indicating the upload is incomplete

#### Scenario: storage object has the wrong attributes
- **WHEN** the client submits finalize with a valid authorization
- **AND** the object exists but its size or content type does not match the authorization
- **THEN** the system MUST return a 422 response with a stable error code indicating the upload is incomplete

### Requirement: finalize preserves authorization boundaries
The system MUST finalize only the upload that matches the issued authorization, including the expected object path and token-bound request.

#### Scenario: wrong object is referenced
- **WHEN** a finalize request references an authorization that does not correspond to the uploaded object
- **THEN** the system MUST reject the request with a 400-series response and MUST NOT create an import job

#### Scenario: authorization is reused after a successful finalize
- **WHEN** a finalize request is repeated for an authorization that already produced an import job
- **THEN** the system MUST return the existing import job instead of creating a duplicate

### Requirement: incomplete uploads are diagnosable
The system MUST emit a stable, machine-readable error for incomplete uploads so the UI can tell the user to re-upload instead of presenting a generic failure.

#### Scenario: user retries after a transient storage delay
- **WHEN** finalize fails because the upload is not yet visible
- **THEN** the response MUST include a stable error code and human-readable message that instructs the user to upload again
