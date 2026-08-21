import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { applyValidation, assignServerIds, createServerIdFactory, reconcileVisualDocument, type VisualMenuDocument, type VisualPageEvidence } from './visual-analysis';
import { decodeGeminiVisualDocument, VISUAL_RESPONSE_SCHEMA } from './provider';

export const FULL_DOCUMENT_MODEL = 'gemini-3.7-flash';
export const FULL_DOCUMENT_API_VERSION = 'v1beta';
export const MAX_GENERATE_CONTENT_REQUESTS = 1;
export const FULL_DOCUMENT_MAX_OUTPUT_TOKENS = 65_536;
export const FULL_DOCUMENT_MIME = 'application/pdf';
export const FULL_DOCUMENT_TARGET_PAGES = [2, 3, 4, 5, 6, 9, 19, 20] as const;
export const SUBARASHII_FIXTURE = { bytes: 7_049_549, pages: 28, sha256: '200363208d92a1ea2cd1814a25237e8283bdd81ea46301ec82966d5a4cd4f387' } as const;

export const FULL_DOCUMENT_RESPONSE_SCHEMA = VISUAL_RESPONSE_SCHEMA;

export type PdfPreflight = { pdfBytes: number; pdfPages: number; pdfSha256: string; mimeType: string; base64Length: number; decodedBase64Bytes: number; decodedBase64Sha256: string; requestPdfPartPresent: boolean; requestPdfPayloadBytes: number; requestPdfPayloadSha256: string; requestPayloadHash: string };
export type StructuralValidation = { expectedPageCount: number; returnedPageCount: number; expectedPages: number[]; returnedPages: number[]; missingPages: number[]; duplicatedPages: number[]; outOfOrderPages: number[]; malformedPages: number[]; structuralValid: boolean };
export type EvaluationClassification = 'A' | 'B' | 'C' | 'D';
export type FullDocumentMetrics = { totalSections: number; totalItems: number; valid: number; review: number; invalid: number; validationReasonCounts: Record<string, number> };
export type FullDocumentReport = { requestCount: number; httpStatus?: number; errorStatus?: string; errorMessage?: string; errorClass?: 'LOCAL_IMPLEMENTATION' | 'REQUEST_CONTRACT' | 'QUOTA' | 'MODEL' | 'PROVIDER' | 'OUTPUT/SCHEMA' | 'TIMEOUT' | 'OTHER'; model: string; apiVersion: string; endpoint: string; promptVersion: string; preflight?: PdfPreflight; latencyMs?: number; inputTokens?: number; outputTokens?: number; totalTokens?: number; finishReason?: string; responseBytes?: number; decodedPageCount: number; structural: StructuralValidation; metrics: FullDocumentMetrics; fullDocumentExtractionValid: boolean; classification: EvaluationClassification; document?: VisualMenuDocument };

export class GenerateContentRequestBudget {
  private used = 0;
  consume() { if (this.used >= MAX_GENERATE_CONTENT_REQUESTS) throw new Error('FULL_DOCUMENT_REQUEST_BUDGET_EXHAUSTED'); this.used += 1; }
  get count() { return this.used; }
}

function hash(value: Uint8Array | string) { return createHash('sha256').update(value).digest('hex'); }
function record(value: unknown): Record<string, unknown> | undefined { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }

export async function readFullDocumentPdf(path: string) {
  try { return new Uint8Array(await readFile(path)); } catch { throw new Error('FULL_DOCUMENT_PREFLIGHT_PDF_NOT_FOUND'); }
}

export async function countFullDocumentPdfPages(pdf: Uint8Array) {
  const canvas = await import('@napi-rs/canvas');
  const target = globalThis as Record<string, unknown>;
  target.DOMMatrix ??= canvas.DOMMatrix; target.ImageData ??= canvas.ImageData; target.Path2D ??= canvas.Path2D;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: pdf }).promise;
  try { return document.numPages; } finally { await document.destroy(); }
}

export function fullDocumentPrompt() {
  return [
    'Analyze the COMPLETE restaurant menu PDF as one visual document.',
    'Identify the structure separately for every page. Return all pages in page order.',
    'For each page, identify visual menu sections/headings; each independent menu item; its description; and its price or price variants.',
    'Preserve the original language. Do not invent missing information. Do not merge multiple independent items into one.',
    'Do not treat isolated prices, description fragments, decorative text, headers, footers, logos, or page artifacts as menu products.',
    'A section may continue between pages, but a clear new heading on a later page takes precedence.',
    'The PDF itself is the only source of truth. Return JSON matching the supplied schema.',
  ].join(' ');
}

export function buildFullDocumentRequest(pdf: Uint8Array) {
  const data = Buffer.from(pdf).toString('base64');
  const body = { contents: [{ role: 'user', parts: [{ text: fullDocumentPrompt() }, { inlineData: { mimeType: FULL_DOCUMENT_MIME, data } }] }], generationConfig: { responseMimeType: 'application/json', responseJsonSchema: FULL_DOCUMENT_RESPONSE_SCHEMA, maxOutputTokens: FULL_DOCUMENT_MAX_OUTPUT_TOKENS } };
  return { body, bodyText: JSON.stringify(body), data };
}

export function verifyFullDocumentPayload(pdf: Uint8Array, request: ReturnType<typeof buildFullDocumentRequest>) {
  const pdfSha256 = hash(pdf); const decoded = Buffer.from(request.data, 'base64'); const decodedBase64Sha256 = hash(decoded);
  if (decoded.byteLength !== pdf.byteLength) throw new Error('FULL_DOCUMENT_PREFLIGHT_BASE64_BYTES_MISMATCH');
  if (decodedBase64Sha256 !== pdfSha256) throw new Error('FULL_DOCUMENT_PREFLIGHT_BASE64_HASH_MISMATCH');
  const part = (request.body.contents[0].parts[1] as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
  const outgoing = part?.data ? Buffer.from(part.data, 'base64') : undefined;
  if (!part || part.mimeType !== FULL_DOCUMENT_MIME || !outgoing?.byteLength) throw new Error('FULL_DOCUMENT_PREFLIGHT_REQUEST_PDF_PART_MISSING');
  const requestPdfPayloadSha256 = hash(outgoing);
  if (outgoing.byteLength !== pdf.byteLength) throw new Error('FULL_DOCUMENT_PREFLIGHT_REQUEST_PDF_BYTES_MISMATCH');
  if (requestPdfPayloadSha256 !== pdfSha256) throw new Error('FULL_DOCUMENT_PREFLIGHT_REQUEST_PDF_HASH_MISMATCH');
  return { decodedBase64Bytes: decoded.byteLength, decodedBase64Sha256, requestPdfPartPresent: true, requestPdfPayloadBytes: outgoing.byteLength, requestPdfPayloadSha256 };
}

async function prepareFullDocumentPdf(pdf: Uint8Array, options: { expected?: { bytes?: number; pages?: number; sha256?: string }; countPages?: (copy: Uint8Array) => Promise<number> } = {}): Promise<{ preflight: PdfPreflight; requestBody: string }> {
  if (!pdf.byteLength) throw new Error('FULL_DOCUMENT_PREFLIGHT_EMPTY_PDF');
  const pdfSha256 = hash(pdf);
  const pdfPages = await (options.countPages ?? countFullDocumentPdfPages)(new Uint8Array(pdf));
  if (!pdf.byteLength) throw new Error('FULL_DOCUMENT_PREFLIGHT_ORIGINAL_BUFFER_DETACHED');
  if (!(pdfPages > 0)) throw new Error('FULL_DOCUMENT_PREFLIGHT_INVALID_PAGE_COUNT');
  const expected = options.expected;
  if (expected?.bytes !== undefined && pdf.byteLength !== expected.bytes) throw new Error('FULL_DOCUMENT_PREFLIGHT_BYTES_MISMATCH');
  if (expected?.pages !== undefined && pdfPages !== expected.pages) throw new Error('FULL_DOCUMENT_PREFLIGHT_PAGE_COUNT_MISMATCH');
  if (expected?.sha256 !== undefined && pdfSha256 !== expected.sha256) throw new Error('FULL_DOCUMENT_PREFLIGHT_HASH_MISMATCH');
  const request = buildFullDocumentRequest(pdf); const integrity = verifyFullDocumentPayload(pdf, request);
  return { preflight: { pdfBytes: pdf.byteLength, pdfPages, pdfSha256, mimeType: FULL_DOCUMENT_MIME, base64Length: request.data.length, ...integrity, requestPayloadHash: hash(request.bodyText) }, requestBody: request.bodyText };
}

export async function preflightFullDocumentPdf(pdf: Uint8Array, options: { expected?: { bytes?: number; pages?: number; sha256?: string }; countPages?: (copy: Uint8Array) => Promise<number> } = {}): Promise<PdfPreflight> {
  return (await prepareFullDocumentPdf(pdf, options)).preflight;
}

export function validateFullDocumentStructure(value: unknown, expectedPageCount: number): StructuralValidation {
  const expectedPages = Array.from({ length: expectedPageCount }, (_, index) => index + 1);
  const pages = record(value)?.pages;
  if (!Array.isArray(pages)) return { expectedPageCount, returnedPageCount: 0, expectedPages, returnedPages: [], missingPages: expectedPages, duplicatedPages: [], outOfOrderPages: [], malformedPages: [], structuralValid: false };
  const returnedPages: number[] = []; const malformedPages: number[] = [];
  pages.forEach((entry, index) => {
    const page = record(entry); const pageNumber = page?.page;
    const malformed = !page || !Number.isInteger(pageNumber) || !Array.isArray(page.sections) || page.sections.some((rawSection) => { const section = record(rawSection); return !section || typeof section.id !== 'string' || !section.id.trim() || !Array.isArray(section.items) || section.items.some((rawItem) => { const candidate = record(rawItem); return !candidate || typeof candidate.name !== 'string' || !candidate.name.trim(); }); });
    if (malformed) malformedPages.push(typeof pageNumber === 'number' ? pageNumber : index + 1); else returnedPages.push(pageNumber as number);
  });
  const counts = new Map<number, number>(); returnedPages.forEach((page) => counts.set(page, (counts.get(page) ?? 0) + 1));
  const duplicatedPages = [...counts].filter(([, count]) => count > 1).map(([page]) => page);
  const actualUnique = new Set(returnedPages);
  const missingPages = expectedPages.filter((page) => !actualUnique.has(page));
  const outOfOrderPages = returnedPages.filter((page, index) => index > 0 && page <= returnedPages[index - 1]);
  const decoderEvidence: VisualPageEvidence[] = expectedPages.map((page) => ({ page, source: 'native', text: '' }));
  if (!malformedPages.length && !decodeGeminiVisualDocument(value, decoderEvidence)) malformedPages.push(...returnedPages);
  const exactSet = returnedPages.length === expectedPages.length && expectedPages.every((page) => actualUnique.has(page));
  return { expectedPageCount, returnedPageCount: returnedPages.length, expectedPages, returnedPages, missingPages, duplicatedPages, outOfOrderPages, malformedPages, structuralValid: exactSet && !duplicatedPages.length && !outOfOrderPages.length && !malformedPages.length };
}

export function emptyMetrics(): FullDocumentMetrics { return { totalSections: 0, totalItems: 0, valid: 0, review: 0, invalid: 0, validationReasonCounts: {} }; }
export function metricsForDocument(document?: VisualMenuDocument): FullDocumentMetrics {
  if (!document) return emptyMetrics();
  const metrics = emptyMetrics();
  for (const page of document.pages) for (const section of page.sections) { metrics.totalSections += 1; for (const candidate of section.items) { metrics.totalItems += 1; const status = candidate.validation?.status ?? 'review'; metrics[status] += 1; for (const reason of candidate.validation?.reasons ?? []) metrics.validationReasonCounts[reason] = (metrics.validationReasonCounts[reason] ?? 0) + 1; } }
  return metrics;
}

/** Central thresholds are evaluation-only and are reported, never applied to production. */
export const FULL_DOCUMENT_CLASSIFICATION_POLICY = { maxReviewRateForA: 0.05, maxInvalidRateForB: 0.1 } as const;
export function classifyFullDocument(input: { httpStatus?: number; finishReason?: string; structuralValid: boolean; metrics: FullDocumentMetrics }): EvaluationClassification {
  if (input.httpStatus !== 200 || !input.structuralValid || /max_tokens|length|truncat/i.test(input.finishReason ?? '')) return 'D';
  if (!input.metrics.totalItems) return 'C';
  const reviewRate = input.metrics.review / input.metrics.totalItems; const invalidRate = input.metrics.invalid / input.metrics.totalItems;
  if (input.metrics.invalid === 0 && reviewRate <= FULL_DOCUMENT_CLASSIFICATION_POLICY.maxReviewRateForA) return 'A';
  if (invalidRate <= FULL_DOCUMENT_CLASSIFICATION_POLICY.maxInvalidRateForB) return 'B';
  return 'C';
}

function errorClass(status?: number, message?: string): FullDocumentReport['errorClass'] { if (status === 429) return 'QUOTA'; if (status === 400 || status === 413) return 'REQUEST_CONTRACT'; if (status === 404) return 'MODEL'; if (/abort|timeout/i.test(message ?? '')) return 'TIMEOUT'; return status && status >= 500 ? 'PROVIDER' : 'OTHER'; }
function baseReport(preflight?: PdfPreflight): Omit<FullDocumentReport, 'classification'> { const structural = validateFullDocumentStructure(undefined, preflight?.pdfPages ?? 0); return { requestCount: 0, model: FULL_DOCUMENT_MODEL, apiVersion: FULL_DOCUMENT_API_VERSION, endpoint: `https://generativelanguage.googleapis.com/${FULL_DOCUMENT_API_VERSION}/models/${FULL_DOCUMENT_MODEL}:generateContent`, promptVersion: 'menu-import-full-document-evaluation-v1', preflight, decodedPageCount: 0, structural, metrics: emptyMetrics(), fullDocumentExtractionValid: false }; }

export async function executeFullDocumentEvaluation(input: { pdf: Uint8Array; apiKey: string; expected?: { bytes?: number; pages?: number; sha256?: string }; fetcher?: typeof fetch; countPages?: (copy: Uint8Array) => Promise<number>; onPreflight?: (preflight: PdfPreflight) => void }): Promise<FullDocumentReport> {
  let prepared: { preflight: PdfPreflight; requestBody: string };
  try { prepared = await prepareFullDocumentPdf(input.pdf, { expected: input.expected, countPages: input.countPages }); } catch (error) { const report = baseReport(); return { ...report, errorClass: 'LOCAL_IMPLEMENTATION', errorMessage: error instanceof Error ? error.message : 'FULL_DOCUMENT_PREFLIGHT_FAILED', classification: 'D' }; }
  const { preflight, requestBody } = prepared;
  input.onPreflight?.(preflight);
  const budget = new GenerateContentRequestBudget(); const report = baseReport(preflight); const startedAt = Date.now();
  try {
    budget.consume();
    const response = await (input.fetcher ?? fetch)(report.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': input.apiKey }, body: requestBody });
    const responseText = await response.text(); const latencyMs = Date.now() - startedAt; const responseBytes = Buffer.byteLength(responseText); let payload: Record<string, unknown>;
    try { payload = JSON.parse(responseText || '{}') as Record<string, unknown>; } catch { return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, errorClass: 'OUTPUT/SCHEMA', errorMessage: 'FULL_DOCUMENT_INVALID_PROVIDER_JSON', classification: 'D' }; }
    const usage = record(payload.usageMetadata); const candidate = Array.isArray(payload.candidates) ? record(payload.candidates[0]) : undefined; const finishReason = typeof candidate?.finishReason === 'string' ? candidate.finishReason : undefined;
    if (!response.ok) { const error = record(payload.error); return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, errorStatus: typeof error?.status === 'string' ? error.status : undefined, errorMessage: typeof error?.message === 'string' ? error.message.replaceAll(/AIza[0-9A-Za-z_-]+/g, '[REDACTED_KEY]').slice(0, 500) : undefined, errorClass: errorClass(response.status, typeof error?.message === 'string' ? error.message : undefined), classification: 'D' }; }
    const text = (record(candidate?.content)?.parts as Array<Record<string, unknown>> | undefined)?.map((part) => part.text).find((part): part is string => typeof part === 'string');
    let rawDocument: unknown; try { rawDocument = JSON.parse(text ?? ''); } catch { return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, finishReason, inputTokens: usage?.promptTokenCount as number | undefined, outputTokens: usage?.candidatesTokenCount as number | undefined, totalTokens: usage?.totalTokenCount as number | undefined, errorClass: 'OUTPUT/SCHEMA', errorMessage: 'FULL_DOCUMENT_INVALID_JSON', classification: 'D' }; }
    const structural = validateFullDocumentStructure(rawDocument, preflight.pdfPages); const evidence: VisualPageEvidence[] = Array.from({ length: preflight.pdfPages }, (_, index) => ({ page: index + 1, source: 'native', text: '' }));
    const decoded = decodeGeminiVisualDocument(rawDocument, evidence); if (!decoded) return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, finishReason, inputTokens: usage?.promptTokenCount as number | undefined, outputTokens: usage?.candidatesTokenCount as number | undefined, totalTokens: usage?.totalTokenCount as number | undefined, structural, errorClass: 'OUTPUT/SCHEMA', errorMessage: 'FULL_DOCUMENT_DECODE_FAILED', classification: 'D' };
    const assigned = assignServerIds(decoded, createServerIdFactory(randomUUID())); const validated = applyValidation(assigned); const reconciled = reconcileVisualDocument(validated, createServerIdFactory(randomUUID())).document; const metrics = metricsForDocument(reconciled); const fullDocumentExtractionValid = structural.structuralValid;
    return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, finishReason, inputTokens: usage?.promptTokenCount as number | undefined, outputTokens: usage?.candidatesTokenCount as number | undefined, totalTokens: usage?.totalTokenCount as number | undefined, decodedPageCount: decoded.pages.length, structural, metrics, fullDocumentExtractionValid, document: reconciled, classification: classifyFullDocument({ httpStatus: response.status, finishReason, structuralValid: structural.structuralValid, metrics }) };
  } catch (error) { const message = error instanceof Error ? error.message : 'FULL_DOCUMENT_REQUEST_FAILED'; return { ...report, requestCount: budget.count, latencyMs: Date.now() - startedAt, errorClass: errorClass(undefined, message), errorMessage: message.slice(0, 500), classification: 'D' }; }
}

export function fixturePageReport(document?: VisualMenuDocument) { return (document?.pages ?? []).filter((page) => FULL_DOCUMENT_TARGET_PAGES.includes(page.page as typeof FULL_DOCUMENT_TARGET_PAGES[number])).map((page) => ({ page: page.page, sections: page.sections.map((section) => section.title?.trim() || '[untitled]'), itemCount: page.sections.reduce((sum, section) => sum + section.items.length, 0), items: page.sections.flatMap((section) => section.items.map((candidate) => ({ name: candidate.name, descriptionPresent: Boolean(candidate.description?.trim()), rawPrice: candidate.rawPrice ?? candidate.price?.raw ?? null, variants: candidate.variants?.map((variant) => ({ raw: variant.raw, label: variant.label ?? null })) ?? [], semanticStatus: candidate.validation?.status ?? 'review', validationReasons: candidate.validation?.reasons ?? [] }))) })); }
