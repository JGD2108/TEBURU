## Why

The deployed PDF menu import flow currently exposes platform and server failures as non-JSON responses, including 400, 404, 413, and 500 statuses. Administrators cannot reliably complete an import or understand how to recover when configuration or a large upload fails.

## What Changes

- Add a deployment-safe PDF upload flow that does not proxy full documents through an application request subject to hosting-provider body limits.
- Define a stable JSON success and error contract for menu-import and public-settings APIs, including meaningful client-visible error codes and messages.
- Add explicit configuration readiness behavior for public settings and import processing so missing or invalid deployment configuration is actionable rather than an unhandled failure.
- Add observability and end-to-end deployment verification for import creation, upload rejection, and downstream processing failures.

## Capabilities

### New Capabilities

- `menu-import-deployment-reliability`: Reliable large-PDF submission and predictable API/configuration failure behavior for the deployed menu-import flow.

### Modified Capabilities

- None.

## Impact

- Admin PDF import UI and its fetch/error handling.
- Menu-import, public-settings, and related API routes.
- Private document storage authorization and upload lifecycle.
- Deployment configuration validation, application logs, and Vercel production verification.
