import 'server-only';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { MAX_GENERATE_CONTENT_REQUESTS } from './text-only-evaluation';
import { analyzeV5Text, describeV5NativeText, extractV5NativeText, V5_TEXT_ANALYZER_VERSION } from './v5-text';

const RUN_LIVE = process.env.MENU_IMPORT_V5_TEXT_LIVE === 'true';
const PDF_PATH = 'docs/pdf_menu_examples/Menu Subarashii.pdf';
const SUBARASHII_REGRESSION: ReadonlyArray<{ page: number; section: string; itemCount?: number }> = [
  { page: 2, section: 'ENTRADAS', itemCount: 7 },
  { page: 3, section: 'TEMPURA', itemCount: 5 },
  { page: 4, section: 'GYOZA', itemCount: 5 },
  { page: 5, section: 'YAKITORI', itemCount: 3 },
  { page: 6, section: 'CRISPY RICE-RICE BOX', itemCount: 6 },
  { page: 19, section: 'CARNES & POLLO & MARISCOS' },
  { page: 20, section: 'ARROCES Y PASTAS' },
];

function print(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) console.log(`${key}=${value ?? 'unknown'}`);
}

describe.skipIf(!RUN_LIVE)('V5 production-equivalent one-request evaluation', () => {
  it('runs the V5 adapter without persistence, visual input, OCR, or fallback', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey, 'GEMINI_API_KEY is required only for this explicit V5 live run').toBeTruthy();
    if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING');

    const pdf = new Uint8Array(await readFile(PDF_PATH));
    const textDocument = await extractV5NativeText(pdf);
    const preflight = describeV5NativeText(textDocument, pdf);
    print({
      PREFLIGHT: preflight.status === 'ready' ? 'PASS' : 'FAIL',
      ANALYZER: V5_TEXT_ANALYZER_VERSION,
      MODEL: process.env.MENU_IMPORT_TEXT_ONLY_GEMINI_MODEL || 'gemini-3.5-flash-lite',
      PDF_BYTES: pdf.byteLength,
      PDF_PAGES: preflight.pdfPages,
      PDF_SHA256: preflight.pdfSha256,
      TEXT_DOCUMENT_PAGES: preflight.textDocumentPages,
      TEXT_DOCUMENT_CHARACTERS: preflight.textCharacters,
      TEXT_DOCUMENT_HASH: preflight.textDocumentHash,
      SERIALIZER_VERSION: preflight.serializerVersion,
      ESTIMATED_INPUT_TOKENS: preflight.estimatedInputTokens,
      REQUEST_BUDGET_REMAINING: MAX_GENERATE_CONTENT_REQUESTS,
    });
    if (preflight.status !== 'ready') {
      print({ REQUEST_COUNT: 0, NORMAL_DRAFTS: 0, STOP: 'TEXT_NOT_EVALUABLE' });
      return;
    }

    const outcome = await analyzeV5Text({ restaurantId: 'v5-live-evaluation', pdf, textDocument, apiKey });
    if (outcome.kind === 'failure') {
      print({
        REQUEST_COUNT: outcome.analysis.metrics?.providerCalls ?? 0,
        FAILURE: outcome.failure.code,
        RETRYABLE: outcome.failure.retryable,
        HTTP_STATUS: outcome.failure.httpStatus,
        NORMAL_DRAFTS: 0,
        VISUAL_INPUT: false,
        OCR: false,
        TEXTUAL_FALLBACK: false,
      });
      expect(outcome.analysis.items).toEqual([]);
      return;
    }

    const items = outcome.analysis.items;
    const metrics = outcome.analysis.metrics ?? {};
    print({
      REQUEST_COUNT: metrics.providerCalls,
      ANALYZER: V5_TEXT_ANALYZER_VERSION,
      MODEL: metrics.model,
      API_VERSION: 'v1beta',
      STRUCTURAL_VALID: outcome.structural.structuralValid,
      VALID: items.filter((item) => item.extractionStatus === 'valid').length,
      REVIEW: items.filter((item) => item.extractionStatus === 'review').length,
      INVALID: outcome.invalidCandidates.length,
      INPUT_TOKENS: metrics.inputTokens,
      OUTPUT_TOKENS: metrics.outputTokens,
      TOTAL_TOKENS: metrics.totalTokens,
      LATENCY_MS: metrics.durationMs,
      LINEAGE_EVENTS: outcome.analysis.lineage?.length ?? 0,
      PERSISTENCE: 'not_run',
      VISUAL_INPUT: false,
      OCR: false,
      TEXTUAL_FALLBACK: false,
    });
    expect(metrics.providerCalls).toBe(1);
    expect(outcome.analysis.images).toEqual([]);
    expect(outcome.analysis.suggestions).toEqual([]);

    // Fixture-specific checks stay in this explicit live evaluation only.
    for (const expected of SUBARASHII_REGRESSION) {
      const sections = outcome.analysis.sections?.filter((section) => section.source?.page === expected.page) ?? [];
      expect(sections.map((section) => section.name)).toContain(expected.section);
      if (expected.itemCount !== undefined) {
        expect(items.filter((item) => item.page === expected.page)).toHaveLength(expected.itemCount);
      }
    }
    const pageNine = items.filter((item) => item.page === 9);
    expect(pageNine.some((item) => item.reviewReasons?.some((reason) => reason.code === 'AMBIGUOUS_PRICE'))).toBe(true);
    expect(pageNine.filter((item) => item.extractionStatus === 'valid').some((item) => /^\s*(?:\$\s*)?\d/.test(item.name ?? ''))).toBe(false);
  }, 180_000);
});
