## Purpose

Ensure deployed menu-import workflows accept supported documents reliably and always communicate usable, structured outcomes to administrators.

## ADDED Requirements

### Requirement: Deployment-safe document submission

The system SHALL allow an authenticated restaurant administrator to submit an accepted PDF menu up to the product's configured import limit without routing the complete document through an application request constrained by the hosting platform's request-body limit. The system MUST authorize each upload for the administrator's restaurant, verify the submitted object before creating an import job, and reject unsupported, empty, oversized, or expired submissions with an actionable JSON error.

#### Scenario: Administrator submits a PDF larger than the application request-body limit

- **WHEN** an administrator selects an otherwise accepted PDF whose size exceeds the application's request-body limit but is within the configured import limit
- **THEN** the system accepts the document through the authorized import upload flow and creates the restaurant-scoped import job

#### Scenario: Upload authorization expires or is invalid

- **WHEN** an administrator attempts to finalize an upload with an expired, invalid, or restaurant-mismatched authorization
- **THEN** the system creates no import job and returns a JSON error that explains the upload must be retried

### Requirement: Predictable API outcome contract

The public-settings and menu-import APIs SHALL return `application/json` for all application-generated success and failure responses. Every failure response MUST include a stable machine-readable error code and a safe, actionable message; clients MUST surface that message without attempting to parse non-JSON error content as JSON.

#### Scenario: Import request fails during processing setup

- **WHEN** the system cannot create or start a menu-import job
- **THEN** the API returns a JSON error with a stable error code, an actionable message, and an appropriate non-success HTTP status

#### Scenario: Route or platform response is not JSON

- **WHEN** the client receives an unavailable route or an intermediary response that is not JSON
- **THEN** the client shows a generic actionable failure state and retains any retryable draft state without raising a JSON parsing error

### Requirement: Configuration readiness reporting

The system SHALL expose public settings in a valid JSON response whenever the application is reachable. When required import-related deployment configuration is absent or invalid, the system MUST report a non-sensitive configuration-readiness error and prevent the administrator from starting an import that cannot complete.

#### Scenario: Required import configuration is unavailable

- **WHEN** an administrator opens menu import while a required deployment setting is unavailable
- **THEN** the settings response remains valid JSON and the interface identifies that import is temporarily unavailable without issuing a failing import request

#### Scenario: Configuration is valid

- **WHEN** all required deployment settings are available
- **THEN** the settings response enables the import workflow and does not expose secret values
