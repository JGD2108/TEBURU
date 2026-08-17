## Context

The existing provider in `src/lib/menu-import/provider.ts` extracts native PDF text, optionally obtains OCR page text, and then runs a conservative local parser. The worker persists draft items and page evidence asynchronously, and the review-before-publication boundary must remain intact. The user has a local `GEMINI_KEY`; production configuration is separate and must remain server-only.

## Goals / Non-Goals

**Goals:**

- Improve category, item, description, price, and page mapping for text extracted from native PDFs or OCR.
- Keep the PDF, rendered images, and extracted image bytes out of the LLM request.
- Make model output deterministic enough to validate and safely review.
- Preserve the local parser as a reliable fallback and record provider lineage.

**Non-Goals:**

- Sending PDFs or images to Gemini for multimodal interpretation.
- Automatic publication or bypassing administrator review.
- Replacing PDF.js extraction, OCR, image association, or the existing draft schema.
- Guaranteeing that a free Gemini quota is available for every import.

## Decisions

### Use a server-side provider adapter with structured JSON

Add a Gemini implementation behind the existing `PdfAnalysisProvider.structure` boundary. Use Gemini's structured-output configuration with a small JSON schema for an array of menu items. The application is TypeScript/Next.js, so a server-side HTTP/JavaScript integration is preferable to the Python SDK example; it avoids introducing a Python runtime and keeps the API key on the server. The model defaults to `gemini-2.5-flash` and may be overridden by a server-only model variable.

The alternative of prompting for free-form text was rejected because it would require fragile parsing. Sending the complete PDF was rejected because this change is explicitly text-only and would increase privacy, latency, and quota exposure.

### Keep local parsing as the first safety net

When Gemini is disabled, fails, times out, is rate-limited, or returns invalid data, the adapter invokes the existing local parser against the same page text. A failed enrichment attempt therefore cannot erase a usable local draft or leave an import without a recoverable result.

### Validate at the provider boundary

Validate the decoded response before `persistDraft`: names must be non-empty, prices must be absent or finite and non-negative, page references must match an extracted page, categories must be normalized, and confidence values must be one of the supported levels. Unknown or malformed fields are rejected or ignored according to the schema policy; no unvalidated model object reaches SQL persistence.

### Record lineage without changing publication semantics

Add additive server-side lineage fields for structure provider and model (or an equivalent versioned metadata representation) to analysis runs. The worker and existing review lineage surface can identify `gemini` versus `local-fallback` and the model, while publication continues to operate only on approved drafts.

### Treat configuration and quota as operational concerns

Support the existing local `GEMINI_KEY` name and document a canonical server variable for deployment. Never prefix it with `NEXT_PUBLIC_`. Keep the model and timeout configurable, sanitize provider errors, and make the integration disabled when no key is present. Vercel production must receive the key independently from `.env.local`.

## Risks / Trade-offs

- [Free-tier quota or model availability changes] → Disable gracefully, use the local parser, and retain retryable diagnostics.
- [Model invents or transforms prices] → Require schema validation, preserve source page evidence, assign confidence, and keep administrator approval mandatory.
- [Long extracted text exceeds request limits] → Send bounded page chunks with deterministic ordering and merge validated results before persistence.
- [Provider outage increases job latency] → Enforce a short provider timeout and fallback within the worker's existing analysis deadline.
- [Sensitive menu text leaves the application] → Send only extracted text to the configured provider, document that boundary, and exclude PDFs/images and secrets from payloads/logs.

## Migration Plan

1. Add the provider adapter, schema validation, fallback tests, and server-only configuration documentation.
2. Add the smallest additive migration needed for provider/model lineage, if existing analyzer metadata cannot represent it safely.
3. Configure the Gemini key and model in local/Vercel server environments; do not commit the key.
4. Run representative text-based and OCR-derived fixtures through the worker and inspect draft evidence before enabling by default.
5. Roll back by removing the server key or setting the feature off; local parsing continues and existing drafts/public menus remain unaffected.
