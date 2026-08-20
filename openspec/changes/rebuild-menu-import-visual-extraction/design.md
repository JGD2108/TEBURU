## Context

The existing implementation in `src/lib/menu-import/provider.ts` extracts PDF text and sends page-numbered text to Gemini. It has no page-image structuring contract, uses a flat item model with a single numeric price, and falls back to a line parser with mutable category state. The worker and database were designed around that flat shape, while the admin review panel assumes a missing price is zero. Existing durable orchestration, private storage, tenant boundaries, review gates, and provider lineage must remain operational.

## Goals / Non-Goals

**Goals:**

- Make visual page understanding the primary extraction signal for arbitrary menu PDFs.
- Preserve observed structure and raw values before normalization.
- Support hierarchical sections, columns, tables, variants, shared prices, modifiers, options, and source bounding boxes.
- Add deterministic validation, bounded targeted retries, conservative reconciliation, and useful diagnostics.
- Keep fallback behavior safe and keep publication behind explicit review/approval.
- Restore the previous dark semantic theme without coupling theme logic to menu parsing.

**Non-Goals:**

- Hardcoding names, languages, currencies, categories, page positions, or rules for the current fixture.
- Automatically publishing extracted items.
- Translating menu content during extraction.
- Treating OCR/text extraction as a replacement for visual analysis.
- Aggressive deduplication or guessing missing prices/categories.

## Decisions

### 1. Use a page-image-first provider boundary

Extend the server-side analysis provider to inspect the PDF, render each page to a bounded PNG/JPEG representation, and send page images plus minimal page-numbered auxiliary text to Gemini. Rendering is required because PDF text order does not preserve columns, alignment, typography, or grouping. Native text remains useful for search/evidence and OCR remains a fallback for image-only pages, but neither determines structure by itself.

The alternative of improving the current text prompt was rejected: it cannot recover layout relationships that were discarded before the model call. Sending the complete PDF as an opaque file was also rejected in favor of explicit page limits, traceability, and bounded payloads.

### 2. Separate extraction, validation, normalization, reconciliation, and persistence

The provider returns an observation-preserving intermediate document. A deterministic validator adds signals for malformed structure and semantic suspicion. A separate normalization stage interprets amounts/currency only when document evidence supports it. A document reconciler combines validated page outputs, handles continuation and repeated headings, and deduplicates only with source-aware keys. Only then does the worker persist drafts.

This separation prevents a wrong currency interpretation or category guess from overwriting the original visual evidence and makes each stage independently testable.

### 3. Model hierarchy and price variants explicitly

Represent sections as identified entities with optional parent relationships. Represent a single price, a shared price, and labeled variants distinctly. Keep `raw`, `amount`, and `currency` fields together, with nullable normalized fields. Store modifiers/options as child data rather than promoting them to products when visual association indicates they are subordinate.

The database migration should be additive and retain compatibility fields while the API and worker adopt the richer structure. Existing publication can continue to require the fields needed by live menu tables, while drafts can remain incomplete and reviewable.

### 4. Use bounded problem-specific retries

Validation produces typed suspicion signals rather than a generic retry. A retry prompt names the detected issue, such as merged items, wrong category inheritance, or price-column confusion. The full page is retried first to preserve context; only difficult pages are split into visual regions. Retry outputs are reconciled with the original using page, bbox, section, name, description, and price evidence.

### 5. Derive confidence from evidence

The system must not trust an arbitrary LLM confidence value. The final review decision combines model confidence with structural validity, name/price association, section evidence, page coverage, retry outcomes, and reconciliation conflicts. The result is an operational state such as accepted, retryable, or manual review, while preserving the underlying signals for diagnostics.

### 6. Restore the semantic dark theme independently

Restore the semantic variables used by the admin UI to the prior dark values (`#0F1115`, `#1A1D24`, `#222630`, coral `#FF4757`, light text, muted gray, and green success). Components continue using variables such as `--bg-base`, `--bg-surface`, `--primary`, and `--text-main`, so the theme change does not introduce menu-import-specific styling branches.

## Risks / Trade-offs

- [Multimodal requests increase payload size and cost] → Bound render resolution, page count, image dimensions, retries, and record per-import usage.
- [Gemini may still misunderstand unusual layouts] → Preserve bboxes/raw values, run deterministic checks, retry with explicit failure context, and require review for unresolved cases.
- [Richer drafts require schema/API migration] → Use additive columns/JSON structures, maintain compatibility reads, and migrate publication only after draft persistence is verified.
- [Rendering may be expensive in serverless execution] → Limit concurrency, render only required pages/regions, enforce timeouts, and let the durable worker retry safely.
- [Fallback parser remains imperfect] → Mark fallback output lower confidence and reviewable; never treat it as visual certainty.
- [Dark theme changes contrast expectations in existing panels] → Verify shared admin screens and accessibility contrast, not only the import panel.

## Migration Plan

1. Add additive database fields/tables for structured sections, raw/variant prices, source geometry, document metadata, validation diagnostics, and extraction metrics.
2. Implement the visual provider behind a versioned analyzer contract while retaining compatibility reads for existing drafts and lineage rows.
3. Add deterministic validation, targeted retry, reconciliation, and provider observability before enabling the new analyzer by default.
4. Update worker persistence, admin API responses, and review UI; restore the dark semantic theme.
5. Run the current PDF fixture plus structurally different menu fixtures through the full upload → analysis → review flow.
6. Enable the new analyzer using configuration/versioning; rollback by selecting the prior analyzer/fallback while leaving additive schema changes in place.

## Open Questions

- Which Gemini model/version is enabled in production for multimodal structured output, subject to the existing server-only configuration policy?
- What maximum rendered page dimensions and per-import retry budget fit the deployment runtime and provider quota?
