import 'server-only';
import { describe, expect, it } from 'vitest';
import { SUBARASHII_FIXTURE, executeFullDocumentEvaluation, fixturePageReport, readFullDocumentPdf } from './full-document-evaluation';

const RUN_EXPERIMENT = process.env.MENU_IMPORT_FULL_PDF_EXPERIMENT === 'true';
const PDF_PATH = 'docs/pdf_menu_examples/Menu Subarashii.pdf';

function apiKey() { return process.env.MENU_IMPORT_GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY; }
function print(values: Record<string, unknown>) { for (const [key, value] of Object.entries(values)) console.log(`${key}=${value ?? 'unknown'}`); }

describe.skipIf(!RUN_EXPERIMENT)('one-shot native-PDF Gemini evaluation', () => {
  it('evaluates the full PDF in memory without persistence, fallback, or retries', async () => {
    const key = apiKey(); expect(key, 'a server-only Gemini API key is required').toBeTruthy(); if (!key) throw new Error('GEMINI_API_KEY_MISSING');
    const report = await executeFullDocumentEvaluation({ pdf: await readFullDocumentPdf(PDF_PATH), apiKey: key, expected: SUBARASHII_FIXTURE, onPreflight: (preflight) => print({ PREFLIGHT: 'PASS', PDF_EXISTS: 'yes', PDF_BYTES: preflight.pdfBytes, PDF_PAGES: preflight.pdfPages, PDF_SHA256: preflight.pdfSha256, PDF_MIME: preflight.mimeType, BASE64_LENGTH: preflight.base64Length, DECODED_BASE64_BYTES: preflight.decodedBase64Bytes, DECODED_BASE64_SHA256: preflight.decodedBase64Sha256, REQUEST_PDF_PART_PRESENT: preflight.requestPdfPartPresent, REQUEST_PDF_PAYLOAD_BYTES: preflight.requestPdfPayloadBytes, REQUEST_PDF_PAYLOAD_SHA256: preflight.requestPdfPayloadSha256, PAYLOAD_HASH_MATCH: preflight.requestPdfPayloadSha256 === preflight.pdfSha256 }) });
    print({ REQUEST_COUNT: report.requestCount, HTTP_STATUS: report.httpStatus, MODEL: report.model, API_VERSION: report.apiVersion, PDF_BYTES: report.preflight?.pdfBytes, PDF_PAGES: report.preflight?.pdfPages, PDF_SHA256: report.preflight?.pdfSha256, REQUEST_PAYLOAD_HASH: report.preflight?.requestPayloadHash, LATENCY_MS: report.latencyMs, INPUT_TOKENS: report.inputTokens, OUTPUT_TOKENS: report.outputTokens, TOTAL_TOKENS: report.totalTokens, FINISH_REASON: report.finishReason, RESPONSE_BYTES: report.responseBytes, EXPECTED_PAGE_COUNT: report.structural.expectedPageCount, RETURNED_PAGE_COUNT: report.structural.returnedPageCount, MISSING_PAGES: report.structural.missingPages.join(',') || 'none', DUPLICATED_PAGES: report.structural.duplicatedPages.join(',') || 'none', OUT_OF_ORDER_PAGES: report.structural.outOfOrderPages.join(',') || 'none', STRUCTURAL_VALID: report.structural.structuralValid, TOTAL_SECTIONS: report.metrics.totalSections, TOTAL_ITEMS: report.metrics.totalItems, VALID: report.metrics.valid, REVIEW: report.metrics.review, INVALID: report.metrics.invalid, VALIDATION_REASON_COUNTS: JSON.stringify(report.metrics.validationReasonCounts), FULL_DOCUMENT_EXTRACTION_VALID: report.fullDocumentExtractionValid, CLASSIFICATION: report.classification, ERROR_CLASS: report.errorClass, ERROR_STATUS: report.errorStatus, ERROR_MESSAGE: report.errorMessage, PERSISTENCE: 'not_run', TEXTUAL_FALLBACK: 'not_run' });
    for (const page of fixturePageReport(report.document)) { console.log(`PAGE=${page.page}`); console.log(`SECTIONS=${page.sections.join(' | ') || '[none]'}`); console.log(`ITEM_COUNT=${page.itemCount}`); for (const item of page.items) console.log(JSON.stringify(item)); }
    expect(report.requestCount).toBeLessThanOrEqual(1);
  }, 180_000);
});
