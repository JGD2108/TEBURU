import 'server-only';
import { describe, expect, it } from 'vitest';
import {
  MAX_GENERATE_CONTENT_REQUESTS,
  extractTextDocument,
  executeTextOnlyEvaluation,
  pageEvaluationReport,
  preflightTextDocument,
  readTextOnlyPdf,
} from './text-only-evaluation';

const RUN_EXPERIMENT = process.env.MENU_IMPORT_TEXT_ONLY_EXPERIMENT === 'true';
const PDF_PATH = 'docs/pdf_menu_examples/Menu Subarashii.pdf';
const TARGET_PAGES = [2, 3, 4, 5, 6, 9, 19, 20];

function print(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) console.log(`${key}=${value ?? 'unknown'}`);
}

describe.skipIf(!RUN_EXPERIMENT)('one-request text-only Gemini evaluation', () => {
  it('evaluates native PDF text without visual inputs, retries, fallback, or persistence', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey, 'GEMINI_API_KEY is required only for the explicit live experiment').toBeTruthy();
    if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING');

    const pdf = await readTextOnlyPdf(PDF_PATH);
    const source = await extractTextDocument(pdf);
    const preflight = preflightTextDocument(source, { pdf, expectedPages: 28 });
    print({
      PREFLIGHT: preflight.status === 'ready' ? 'PASS' : 'FAIL',
      PDF_EXISTS: 'yes',
      PDF_BYTES: pdf.byteLength,
      PDF_PAGES: preflight.pdfPages,
      PDF_SHA256: preflight.pdfSha256,
      TEXT_DOCUMENT_PAGES: preflight.textDocumentPages,
      TEXT_DOCUMENT_CHARACTERS: preflight.textCharacters,
      TEXT_DOCUMENT_SHA256: preflight.textDocumentHash,
      SERIALIZER_VERSION: preflight.serializerVersion,
      NONEMPTY_PAGES: preflight.nonEmptyPages,
      EMPTY_PAGES: preflight.emptyPages.join(',') || 'none',
      ESTIMATED_INPUT_TOKENS: preflight.estimatedInputTokens,
      REQUEST_BUDGET_REMAINING: MAX_GENERATE_CONTENT_REQUESTS,
    });
    if (preflight.status !== 'ready') {
      print({ REQUEST_COUNT: 0, STOP: 'NOT_EVALUABLE' });
      return;
    }

    const report = await executeTextOnlyEvaluation({ pdf, textDocument: source, apiKey });
    print({
      REQUEST_COUNT: report.requestCount,
      HTTP_STATUS: report.httpStatus,
      ERROR_CLASS: report.errorClass,
      ERROR_STATUS: report.errorStatus,
      ERROR_MESSAGE: report.errorMessage,
      MODEL: report.model,
      API_VERSION: report.apiVersion,
      PDF_BYTES: report.preflight?.pdfSha256 ? pdf.byteLength : 'unknown',
      PDF_PAGES: report.preflight?.pdfPages,
      LATENCY_MS: report.latencyMs,
      INPUT_TOKENS: report.inputTokens,
      OUTPUT_TOKENS: report.outputTokens,
      TOTAL_TOKENS: report.totalTokens,
      FINISH_REASON: report.finishReason,
      RESPONSE_BYTES: report.responseBytes,
      EXPECTED_PAGE_COUNT: report.structural.expectedPageCount,
      RETURNED_PAGE_COUNT: report.structural.returnedPageCount,
      RETURNED_PAGE_NUMBERS: report.structural.returnedPages.join(',') || 'none',
      MISSING_PAGES: report.structural.missingPages.join(',') || 'none',
      UNEXPECTED_PAGES: report.structural.unexpectedPages.join(',') || 'none',
      DUPLICATED_PAGES: report.structural.duplicatedPages.join(',') || 'none',
      OUT_OF_ORDER_PAGES: report.structural.outOfOrderPages.join(',') || 'none',
      MALFORMED_PAGES: report.structural.malformedPages.join(',') || 'none',
      MALFORMED_SECTIONS: report.structural.malformedSections.join(',') || 'none',
      MALFORMED_ITEMS: report.structural.malformedItems.join(',') || 'none',
      STRUCTURAL_VALID: report.structural.structuralValid,
      FULL_TEXT_DOCUMENT_VALID: report.fullTextDocumentValid,
      TOTAL_SECTIONS: report.metrics.totalSections,
      TOTAL_ITEMS: report.metrics.totalItems,
      VALID: report.metrics.valid,
      REVIEW: report.metrics.review,
      INVALID: report.metrics.invalid,
      VALIDATION_REASON_COUNTS: JSON.stringify(report.metrics.validationReasonCounts),
      CLASSIFICATION: report.classification,
      PERSISTENCE: 'not_run',
      TEXTUAL_FALLBACK: 'not_run',
      VISUAL_INPUT: 'not_run',
    });
    for (const page of pageEvaluationReport(report.document, source, TARGET_PAGES)) {
      console.log(`PAGE=${page.page}`);
      console.log(`SOURCE_TEXT_QUALITY=${page.sourceTextQuality}`);
      console.log(`SECTIONS=${page.sections.join(' | ') || '[none]'}`);
      console.log(`ITEM_COUNT=${page.itemCount}`);
      console.log(`VALID=${page.valid}`);
      console.log(`REVIEW=${page.review}`);
      console.log(`INVALID=${page.invalid}`);
      for (const item of page.items) console.log(JSON.stringify(item));
    }
    expect(report.requestCount).toBeLessThanOrEqual(MAX_GENERATE_CONTENT_REQUESTS);
  }, 180_000);
});
