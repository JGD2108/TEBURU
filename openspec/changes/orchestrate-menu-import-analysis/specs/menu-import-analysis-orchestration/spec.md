## Purpose

Ensure every finalized PDF menu import is processed durably and reaches a
reviewable draft or an actionable terminal failure instead of remaining
pending indefinitely.

## ADDED Requirements

### Requirement: Finalized imports are eventually processed

The system MUST provide an authenticated internal processing trigger that
causes eligible `pending` menu imports to be processed without requiring an
admin browser session to remain open. A successful finalization MUST remain
compatible with the existing `pending` response while processing proceeds
asynchronously.

#### Scenario: Scheduled processing picks up a pending import
- **WHEN** a finalized import is `pending` and the internal trigger executes
- **THEN** the import is claimed for processing and eventually transitions to
  `needs_review` or `failed` without another client-side action

#### Scenario: Empty queue invocation
- **WHEN** the internal trigger executes and no eligible imports exist
- **THEN** it returns a successful no-work result and does not create or mutate
  an import job

### Requirement: Internal processing is authenticated and bounded

The processing trigger MUST reject unauthenticated or incorrectly authorized
requests, MUST process only a bounded number of jobs per invocation, and MUST
return a structured result identifying the number of claimed, completed, and
failed jobs.

#### Scenario: Unauthorized trigger request
- **WHEN** a request lacks the configured internal authorization
- **THEN** the system returns a structured authorization error and processes no
  jobs

#### Scenario: Bounded worker execution
- **WHEN** more eligible jobs exist than the invocation limit
- **THEN** the trigger processes at most the configured limit and leaves the
  remaining jobs eligible for a later invocation

### Requirement: Job claims are exclusive and recoverable

The system MUST allow at most one worker to claim a given import at a time.
Each claim MUST record an attempt and a lease with an expiration. A job whose
worker terminates or whose lease expires MUST become eligible for recovery,
subject to the retry policy, rather than remaining in `processing` forever.

#### Scenario: Concurrent claims
- **WHEN** two worker invocations attempt to claim the same pending import
- **THEN** exactly one invocation claims it and the other observes no claim for
  that import

#### Scenario: Stale processing lease
- **WHEN** a processing lease expires before completion
- **THEN** a later invocation can reclaim the job and records the recovery as a
  new attempt

### Requirement: Retries terminate deterministically

The system MUST retry transient reader, OCR, provider, or storage failures up
to the configured maximum attempts with a persisted next-eligible time. Once
the maximum is exhausted, the job MUST transition to `failed` with a bounded,
user-safe failure reason and MUST NOT be reclaimed indefinitely.

#### Scenario: Retryable processing failure
- **WHEN** an eligible attempt fails with a transient processing error and the
  maximum attempt count has not been reached
- **THEN** the job returns to an eligible state with a persisted retry time and
  an incremented attempt count

#### Scenario: Exhausted retries
- **WHEN** processing fails after the maximum configured attempts
- **THEN** the job is terminally `failed`, exposes a diagnosable failure code or
  reason to the admin, and is not selected by future retry attempts

### Requirement: Successful analysis persists a reviewable draft

The system MUST read the authorized private source PDF, run the configured
text/OCR analysis, and persist categories, items, prices, descriptions,
confidence values, and source evidence atomically with the import completion.
On success the job MUST transition to `needs_review` and preserve restaurant
tenant isolation.

#### Scenario: Text-readable PDF
- **WHEN** a claimed PDF contains sufficient native text and analysis succeeds
- **THEN** the job transitions to `needs_review` and its draft data and source
  evidence are available through the existing admin review APIs

#### Scenario: OCR-required PDF
- **WHEN** a claimed PDF lacks sufficient native text and OCR is configured
- **THEN** OCR output is analyzed and the resulting draft is persisted before
  the job transitions to `needs_review`

### Requirement: Analysis failures are observable and safe

The system MUST enforce a deterministic processing timeout and MUST classify
missing source objects, unsupported formats, unavailable OCR/provider
configuration, and malformed analysis output into bounded failure categories.
Failure details MUST be safe for admin display and structured logs MUST retain
the request/job identifier and diagnostic category without exposing document
contents or secrets.

#### Scenario: Missing source object
- **WHEN** a claimed import references an object that cannot be read
- **THEN** the job follows the retry policy and eventually reports a stable
  source-unavailable failure if retries are exhausted

#### Scenario: Processing timeout
- **WHEN** reader, OCR, or provider work exceeds the configured timeout
- **THEN** the attempt is interrupted, the job follows the retry policy, and no
  worker remains indefinitely in `processing`

#### Scenario: Unsupported extracted asset
- **WHEN** analysis produces an asset format that the private storage policy
  does not allow
- **THEN** the asset is converted to an allowed format or omitted with a
  structured warning, and the import can still complete when core draft data
  is valid

### Requirement: Admin status polling reflects terminal outcomes

The admin experience MUST continue to expose `pending` and `processing` while
work is active, MUST stop polling after `needs_review`, `failed`, or
`published`, and MUST use bounded backoff while a job remains active. The
status response MUST include a safe failure reason when the job is `failed`.

#### Scenario: Pending import becomes reviewable
- **WHEN** polling observes a transition from `pending` or `processing` to
  `needs_review`
- **THEN** the UI stops polling and presents the populated draft for review

#### Scenario: Failed import is surfaced
- **WHEN** polling observes a `failed` import with a failure reason
- **THEN** the UI stops polling and displays the reason with an actionable
  retry or re-upload instruction
