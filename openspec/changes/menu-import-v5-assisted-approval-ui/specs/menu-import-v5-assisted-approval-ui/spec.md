## Purpose

Provides a fast administrative V5 review workflow with advisory model decisions, server-governed bulk approval, category filtering, and explicit human-controlled publication.

## ADDED Requirements

### Requirement: Advisory model decision with server authority
For each V5 candidate, the system MUST preserve a provider recommendation of `approve`, `review`, or `reject`, a reported confidence value between 0 and 1, and bounded reason codes. The recommendation and confidence MUST be presented as advisory metadata rather than a calibrated guarantee. Structural and semantic validation performed by the server MUST remain authoritative, MUST be able to downgrade any provider recommendation, and MUST NOT upgrade a server `review` or `invalid` candidate because the provider recommended approval.

#### Scenario: Model recommends approval but server detects ambiguity
- **WHEN** the provider recommends `approve` and the server detects `AMBIGUOUS_PRICE` or another review reason
- **THEN** the candidate remains `review`, is excluded from bulk approval, and retains both the provider recommendation and server reason

#### Scenario: Model rejects a candidate
- **WHEN** the provider recommends `reject`
- **THEN** the recommendation is visible as evidence and the server independently determines whether the candidate is reviewable or invalid

### Requirement: Server-derived bulk-approval eligibility
The system MUST derive bulk-approval eligibility on the server from the current persisted draft, its V5 analyzer identity, semantic status, provider recommendation, reported confidence, a versioned server confidence threshold, required editable fields, and validation reasons. Only current `valid` V5 drafts recommended `approve` at or above the active threshold with no blocking reason MAY be eligible. `review`, `invalid`, stale, changed, already approved, excluded, provider-failure, and non-evaluable outcomes MUST be ineligible.

#### Scenario: Eligible valid draft
- **WHEN** a current V5 draft is valid, complete, recommended `approve`, above the active threshold, and has no blocking reason
- **THEN** the server marks it eligible for the bulk action

#### Scenario: Ambiguous or stale draft
- **WHEN** a draft is `review`, contains `AMBIGUOUS_PRICE`, or changed after the bulk-approval snapshot
- **THEN** the server skips it and returns a bounded reason without partially approving stale data

### Requirement: Transactional approve-all action
An authorized administrator MUST be able to invoke **Approve all eligible** for exactly one restaurant and one V5 import. The operation MUST revalidate eligibility inside one transaction, approve all eligible drafts atomically, leave ineligible drafts unchanged, and return approved and skipped counts with bounded skip reasons. It MUST be idempotent and MUST NOT publish menu data.

#### Scenario: Bulk approval succeeds
- **WHEN** an authorized administrator approves all eligible drafts for a V5 import
- **THEN** every still-eligible draft is approved once and the response reports approved and skipped totals

#### Scenario: Cross-tenant or stale request
- **WHEN** the import does not belong to the administrator's active restaurant or the request uses stale draft state
- **THEN** no unauthorized or stale draft is approved and the operation returns an authorization or conflict result

### Requirement: V5-only normal import experience with rollback retained
The normal operator menu-import flow MUST omit analyzer and model choices and MUST create new imports with `menu-import-v5-text` when V5 is enabled. V3 and V4 execution support, historical readability, and an explicit server-side or privileged administrative rollback mechanism MUST remain available. Models and credentials MUST never be exposed to ordinary operators.

#### Scenario: Operator starts an import
- **WHEN** an ordinary authorized operator opens the PDF import flow while V5 is enabled
- **THEN** the UI shows native-text import without analyzer/model choices and the created job records `menu-import-v5-text`

#### Scenario: Privileged rollback selects V4
- **WHEN** a privileged administrator activates the rollback configuration
- **THEN** subsequent imports can use V4 without deleting V5 data or changing historical analyzer identities

### Requirement: Category-grouped draft view and All filter
After an import reaches a reviewable state, the same screen MUST display its persisted normal and review drafts grouped by category. The default filter MUST be **All**, and the available filters MUST include every projected category. Filtering MUST preserve item names, descriptions, prices or variants, semantic status, source-page evidence, edit controls, and blocking reasons. Invalid extraction issues MUST remain distinguishable from normal dishes.

#### Scenario: Review screen opens
- **WHEN** a V5 import has persisted drafts
- **THEN** the screen defaults to **All** and shows category groups with their items and editable fields

#### Scenario: Administrator selects a category
- **WHEN** the administrator selects a category filter
- **THEN** only drafts in that category are shown without changing approval or publication state

### Requirement: Explicit publication and immediate refresh
Bulk approval MUST NOT publish automatically. Publication MUST remain an explicit authorized action using the existing publication safeguards. After successful publication, the same administrative screen MUST refresh the published menu and show its categories and items without requiring a page reload or another analysis request.

#### Scenario: Bulk approval completes
- **WHEN** eligible drafts are approved in bulk
- **THEN** they remain unpublished until the administrator explicitly invokes publication

#### Scenario: Publication succeeds
- **WHEN** the administrator explicitly publishes approved drafts
- **THEN** the current menu view refreshes and displays the newly published categories and items on the same screen

### Requirement: Safe audit and compatibility
The system MUST record the raw advisory recommendation, reported confidence, policy version, threshold, final server status, bulk-approval actor, approved/skipped counts, and bounded reasons without credentials or raw provider secrets. Existing imports that lack recommendation metadata MUST remain readable and MUST default to bulk-ineligible unless current server policy can prove eligibility safely.

#### Scenario: Historical import lacks recommendation metadata
- **WHEN** an administrator opens an older import
- **THEN** the import remains readable and no item becomes bulk-eligible solely because metadata is absent

#### Scenario: Bulk action is audited
- **WHEN** an approve-all operation completes or is rejected
- **THEN** authorized diagnostics can identify the import, actor, policy version, outcome counts, and bounded reasons
