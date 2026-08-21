import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { ObservedPrice } from './types';
import {
  PROVIDER_DECISION_REASONS,
  PROVIDER_DECISION_RECOMMENDATIONS,
  parseProviderDecisionMetadata,
  type ProviderDecisionMetadata,
} from './assisted-approval-policy';

export const TEXT_ONLY_DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const TEXT_ONLY_API_VERSION = 'v1beta';
export const TEXT_ONLY_MAX_OUTPUT_TOKENS = 32_768;
export const TEXT_ONLY_TIMEOUT_MS = 60_000;
export const TEXT_DOCUMENT_SERIALIZER_VERSION = 'text-document-v1';
export const TEXT_ONLY_PROMPT_VERSION = 'menu-import-text-only-v1';
export const TEXT_ONLY_SCHEMA_VERSION = 'text-menu-document-v1';
export const TEXT_ONLY_ASSISTED_APPROVAL_PROMPT_VERSION = 'menu-import-text-only-v2-assisted-approval';
export const TEXT_ONLY_ASSISTED_APPROVAL_SCHEMA_VERSION = 'text-menu-document-v2-assisted-approval';
export const MAX_GENERATE_CONTENT_REQUESTS = 1;

export type TextSeparator = 'space' | 'line-break' | 'unknown';
export type TextDocumentItem = { index: number; rawText: string; text: string; separator: TextSeparator; hasEOL: boolean | null };
export type TextDocumentPage = { pageNumber: number; items: TextDocumentItem[]; text: string };
export type TextDocument = { pages: TextDocumentPage[]; serializerVersion: string };
export type TextCoverage = { pageNumber: number; characters: number; nonEmptyItems: number; quality: 'empty' | 'limited' | 'usable' };
export type TextPreflight = {
  pdfPages: number; pdfSha256?: string; textDocumentPages: number; textCharacters: number; textDocumentHash: string;
  serializerVersion: string; nonEmptyPages: number; emptyPages: number[]; estimatedInputTokens: number; coverage: TextCoverage[]; status: 'ready' | 'not_evaluable'; reason?: string;
};
export type PriceAssociation = 'certain' | 'ambiguous' | 'absent';
export type TextPriceVariant = { raw: string; label?: string };
export type TextTransportItem = { name: string; description?: string; rawPrice?: string; priceVariants?: TextPriceVariant[]; priceAssociation?: PriceAssociation; descriptionAssociation?: PriceAssociation; providerDecision?: ProviderDecisionMetadata };
export type TextTransportSection = { title?: string; continuesPrevious?: boolean; items: TextTransportItem[] };
export type TextTransportPage = { pageNumber: number; sections: TextTransportSection[] };
export type TextMenuDocument = { pages: TextTransportPage[] };
export type TextStructuralValidation = {
  expectedPageCount: number; returnedPageCount: number; expectedPages: number[]; returnedPages: number[]; missingPages: number[]; unexpectedPages: Array<number | string>;
  duplicatedPages: number[]; outOfOrderPages: number[]; malformedPages: Array<number | string>; malformedSections: Array<number | string>; malformedItems: Array<number | string>; structuralValid: boolean;
};
export type TextValidationReason = 'EMPTY_NAME' | 'PRICE_ONLY_NAME' | 'MULTIPLE_PRICES_IN_NAME' | 'MERGED_NAME' | 'DECORATIVE_CONTENT' | 'MISSING_SECTION' | 'DESCRIPTION_FRAGMENT' | 'AMBIGUOUS_PRICE' | 'DUPLICATE_ITEM';
export type TextItemValidation = { status: 'valid' | 'review' | 'invalid'; reasons: TextValidationReason[] };
/**
 * An isolated canonical projection for this spike. It deliberately contains no
 * geometry, visual confidence, retry, persistence, or V4 analyzer state.
 */
export type TextCanonicalItem = {
  itemId: string; candidateId: string; name: string; description?: string; rawPrice?: string; price?: ObservedPrice; variants?: ObservedPrice[];
  priceAssociation?: PriceAssociation; descriptionAssociation?: PriceAssociation; providerDecision?: ProviderDecisionMetadata; validation?: TextItemValidation;
};
export type TextCanonicalSection = { id: string; modelSectionHint?: string; title?: string; parentId?: string; continuationOf?: string; continuesPrevious?: boolean; items: TextCanonicalItem[] };
export type TextCanonicalPage = { page: number; sections: TextCanonicalSection[] };
export type TextCanonicalDocument = { pages: TextCanonicalPage[] };
export type TextMetrics = { totalSections: number; totalItems: number; valid: number; review: number; invalid: number; validationReasonCounts: Record<string, number> };
export type TextOnlyClassification = 'A' | 'B' | 'C' | 'D';
export type TextOnlyReport = {
  requestCount: number; httpStatus?: number; errorStatus?: string; errorMessage?: string; errorClass?: 'NOT_EVALUABLE' | 'REQUEST_CONTRACT' | 'QUOTA' | 'MODEL' | 'PROVIDER' | 'OUTPUT/SCHEMA' | 'TIMEOUT' | 'OTHER';
  model: string; apiVersion: string; endpoint: string; promptVersion: string; schemaVersion: string; serializerVersion: string; preflight?: TextPreflight;
  latencyMs?: number; inputTokens?: number; outputTokens?: number; totalTokens?: number; finishReason?: string; responseBytes?: number;
  structural: TextStructuralValidation; metrics: TextMetrics; fullTextDocumentValid: boolean; classification: TextOnlyClassification; document?: TextCanonicalDocument;
};

type GeminiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type JsonRecord = Record<string, unknown>;
type PdfJsPage = { getTextContent: () => Promise<{ items: unknown[] }> };

export class TextOnlyRequestBudget {
  private used = 0;
  consume() { if (this.used >= MAX_GENERATE_CONTENT_REQUESTS) throw new Error('TEXT_ONLY_REQUEST_BUDGET_EXHAUSTED'); this.used += 1; }
  get count() { return this.used; }
  get remaining() { return MAX_GENERATE_CONTENT_REQUESTS - this.used; }
}

function hash(value: Uint8Array | string) { return createHash('sha256').update(value).digest('hex'); }
function record(value: unknown): JsonRecord | undefined { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined; }
function text(value: unknown) { return typeof value === 'string' ? value : undefined; }
function onlyKeys(value: JsonRecord, keys: string[]) { return Object.keys(value).every((key) => keys.includes(key)); }
function normalized(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function configuredTextOnlyModel() {
  const model = (process.env.MENU_IMPORT_TEXT_ONLY_GEMINI_MODEL || TEXT_ONLY_DEFAULT_MODEL).trim();
  if (!model) throw new Error('TEXT_ONLY_MODEL_INVALID');
  return model;
}

export async function readTextOnlyPdf(path: string) {
  try { return new Uint8Array(await readFile(path)); } catch { throw new Error('TEXT_ONLY_PREFLIGHT_PDF_NOT_FOUND'); }
}

async function loadTextOnlyPdfJs() {
  const canvas = await import('@napi-rs/canvas');
  const target = globalThis as Record<string, unknown>;
  target.DOMMatrix ??= canvas.DOMMatrix; target.ImageData ??= canvas.ImageData; target.Path2D ??= canvas.Path2D;
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const workerTarget = globalThis as typeof globalThis & { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
  workerTarget.pdfjsWorker ??= { WorkerMessageHandler: worker.WorkerMessageHandler };
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

/** Native extraction only. It never renders pages or consults OCR. */
export async function extractTextDocument(pdf: Uint8Array): Promise<TextDocument> {
  if (!pdf.byteLength) throw new Error('TEXT_ONLY_PREFLIGHT_EMPTY_PDF');
  const pdfjs = await loadTextOnlyPdfJs();
  const document = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  try {
    const pages: TextDocumentPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const content = await (await document.getPage(pageNumber) as unknown as PdfJsPage).getTextContent();
      const items = content.items.map((raw, index) => {
        const item = record(raw); const rawText = text(item?.str) ?? '';
        return {
          index,
          rawText,
          text: normalized(rawText),
          hasEOL: typeof item?.hasEOL === 'boolean' ? item.hasEOL : null,
          separator: item?.hasEOL === true ? 'line-break' as const : item?.hasEOL === false ? 'space' as const : 'unknown' as const,
        };
      });
      pages.push({ pageNumber, items, text: items.map((item) => item.text).filter(Boolean).join(' ') });
    }
    return { pages, serializerVersion: TEXT_DOCUMENT_SERIALIZER_VERSION };
  } finally { await document.destroy(); }
}

export function serializeTextDocument(document: TextDocument) {
  return document.pages.map((page) => [`=== PAGE ${page.pageNumber} ===`, ...page.items.map((item) => `${item.index}|${item.separator}|${item.text}`)].join('\n')).join('\n\n');
}

export function preflightTextDocument(document: TextDocument, options: { pdf?: Uint8Array; expectedPages?: number } = {}): TextPreflight {
  const pages = document.pages; const coverage = pages.map((page) => {
    const characters = page.items.reduce((sum, item) => sum + item.text.replace(/\s/g, '').length, 0);
    const nonEmptyItems = page.items.filter((item) => Boolean(item.text)).length;
    return { pageNumber: page.pageNumber, characters, nonEmptyItems, quality: characters === 0 ? 'empty' as const : characters < 60 || nonEmptyItems < 3 ? 'limited' as const : 'usable' as const };
  });
  const textCharacters = pages.reduce((sum, page) => sum + page.items.reduce((pageSum, item) => pageSum + item.text.length, 0), 0);
  const textItemCount = coverage.reduce((sum, page) => sum + page.nonEmptyItems, 0);
  const nonEmptyPages = coverage.filter((page) => page.characters > 0).length;
  const emptyPages = coverage.filter((page) => page.characters === 0).map((page) => page.pageNumber);
  const coveragePages = coverage.filter((page) => page.characters >= 20).length;
  const serialized = serializeTextDocument(document);
  const expectedMismatch = options.expectedPages !== undefined && pages.length !== options.expectedPages;
  const insufficient = textCharacters < 200 || textItemCount < 10 || coveragePages / Math.max(1, pages.length) < 0.2;
  return {
    pdfPages: options.expectedPages ?? pages.length, pdfSha256: options.pdf ? hash(options.pdf) : undefined, textDocumentPages: pages.length, textCharacters,
    textDocumentHash: hash(serialized), serializerVersion: document.serializerVersion, nonEmptyPages, emptyPages, estimatedInputTokens: Math.ceil(serialized.length / 3), coverage,
    status: insufficient || expectedMismatch ? 'not_evaluable' : 'ready', reason: expectedMismatch ? 'TEXT_ONLY_PAGE_COUNT_MISMATCH' : insufficient ? 'TEXT_ONLY_NATIVE_TEXT_INSUFFICIENT' : undefined,
  };
}

export function textOnlyPrompt(options: { requireProviderDecision?: boolean } = {}) {
  return [
    'Extract restaurant menu sections and independent dishes from the provided PDF-extracted text.',
    'Preserve the original language. Extract section/category, dish name, description, price, and price variants.',
    'The source preserves PAGE boundaries and extraction order, but visual layout may have been lost or reordered.',
    'Do not invent missing associations. Do not create dishes from isolated prices, description fragments, headers, footers, page numbers, or decorative text.',
    'Do not merge independent dishes. When the text does not reliably establish which price or description belongs to an item, preserve uncertainty rather than guessing.',
    'Respect PAGE markers. A clear heading on the current page takes precedence over inherited context.',
    ...(options.requireProviderDecision ? [
      'For every item, include providerDecision with recommendation approve, review, or reject; decisionConfidence from 0 through 1; and one or more supported decisionReasons. This is advisory evidence only: preserve uncertainty rather than approving an ambiguous association.',
    ] : []),
    'Return JSON matching the supplied schema.',
  ].join(' ');
}

const associationSchema = { type: 'string', enum: ['certain', 'ambiguous', 'absent'] };
const variantSchema = { type: 'object', additionalProperties: false, properties: { raw: { type: 'string' }, label: { type: 'string' } }, required: ['raw'] };
const providerDecisionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    recommendation: { type: 'string', enum: PROVIDER_DECISION_RECOMMENDATIONS },
    decisionConfidence: { type: 'number', minimum: 0, maximum: 1 },
    decisionReasons: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: PROVIDER_DECISION_REASONS } },
  },
  required: ['recommendation', 'decisionConfidence', 'decisionReasons'],
};
const itemSchema = { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, description: { type: 'string' }, rawPrice: { type: 'string' }, priceVariants: { type: 'array', items: variantSchema }, priceAssociation: associationSchema, descriptionAssociation: associationSchema }, required: ['name'] };
const assistedApprovalItemSchema = { ...itemSchema, properties: { ...itemSchema.properties, providerDecision: providerDecisionSchema }, required: [...itemSchema.required, 'providerDecision'] };
const sectionSchema = { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, continuesPrevious: { type: 'boolean' }, items: { type: 'array', items: itemSchema } }, required: ['items'] };
const assistedApprovalSectionSchema = { ...sectionSchema, properties: { ...sectionSchema.properties, items: { type: 'array', items: assistedApprovalItemSchema } } };
const pageSchema = { type: 'object', additionalProperties: false, properties: { pageNumber: { type: 'integer' }, sections: { type: 'array', items: sectionSchema } }, required: ['pageNumber', 'sections'] };
const assistedApprovalPageSchema = { ...pageSchema, properties: { ...pageSchema.properties, sections: { type: 'array', items: assistedApprovalSectionSchema } } };
export const TEXT_ONLY_RESPONSE_SCHEMA = { type: 'object', additionalProperties: false, properties: { pages: { type: 'array', items: pageSchema } }, required: ['pages'] };
export const TEXT_ONLY_ASSISTED_APPROVAL_RESPONSE_SCHEMA = { type: 'object', additionalProperties: false, properties: { pages: { type: 'array', items: assistedApprovalPageSchema } }, required: ['pages'] };

export function buildTextOnlyRequest(document: TextDocument, options: { requireProviderDecision?: boolean } = {}) {
  const serialized = serializeTextDocument(document);
  const responseJsonSchema = options.requireProviderDecision ? TEXT_ONLY_ASSISTED_APPROVAL_RESPONSE_SCHEMA : TEXT_ONLY_RESPONSE_SCHEMA;
  const body = { contents: [{ role: 'user', parts: [{ text: `${textOnlyPrompt(options)}\n\n${serialized}` }] }], generationConfig: { responseMimeType: 'application/json', responseJsonSchema, maxOutputTokens: TEXT_ONLY_MAX_OUTPUT_TOKENS } };
  return { body, bodyText: JSON.stringify(body), serialized };
}

function association(value: unknown): PriceAssociation | undefined { return value === 'certain' || value === 'ambiguous' || value === 'absent' ? value : undefined; }
function decodeItem(value: unknown, options: { requireProviderDecision?: boolean } = {}): TextTransportItem | undefined {
  const item = record(value); if (!item || !onlyKeys(item, ['name', 'description', 'rawPrice', 'priceVariants', 'priceAssociation', 'descriptionAssociation', 'providerDecision']) || !text(item.name)?.trim()) return undefined;
  if ((item.description !== undefined && typeof item.description !== 'string') || (item.rawPrice !== undefined && typeof item.rawPrice !== 'string')) return undefined;
  if ((item.priceAssociation !== undefined && !association(item.priceAssociation)) || (item.descriptionAssociation !== undefined && !association(item.descriptionAssociation))) return undefined;
  let priceVariants: TextPriceVariant[] | undefined;
  if (item.priceVariants !== undefined) {
    if (!Array.isArray(item.priceVariants)) return undefined;
    priceVariants = [];
    for (const raw of item.priceVariants) {
      const variant = record(raw); const variantRaw = text(variant?.raw)?.trim(); const variantLabel = text(variant?.label)?.trim();
      if (!variant || !onlyKeys(variant, ['raw', 'label']) || !variantRaw || (variant.label !== undefined && typeof variant.label !== 'string')) return undefined;
      priceVariants.push({ raw: variantRaw, label: variantLabel || undefined });
    }
  }
  const name = text(item.name)?.trim();
  if (!name) return undefined;
  const decodedProviderDecision = item.providerDecision === undefined ? undefined : parseProviderDecisionMetadata(item.providerDecision);
  if ((options.requireProviderDecision && !decodedProviderDecision) || (item.providerDecision !== undefined && !decodedProviderDecision)) return undefined;
  return { name, description: text(item.description)?.trim() || undefined, rawPrice: text(item.rawPrice)?.trim() || undefined, priceVariants, priceAssociation: association(item.priceAssociation), descriptionAssociation: association(item.descriptionAssociation), providerDecision: decodedProviderDecision };
}
function decodeSection(value: unknown, options: { requireProviderDecision?: boolean } = {}): TextTransportSection | undefined {
  const section = record(value); if (!section || !onlyKeys(section, ['title', 'continuesPrevious', 'items']) || !Array.isArray(section.items) || (section.title !== undefined && typeof section.title !== 'string') || (section.continuesPrevious !== undefined && typeof section.continuesPrevious !== 'boolean')) return undefined;
  const items = section.items.map((item) => decodeItem(item, options)); if (items.some((item) => !item)) return undefined;
  return { title: text(section.title)?.trim() || undefined, continuesPrevious: section.continuesPrevious === true, items: items as TextTransportItem[] };
}
export function decodeTextMenuDocument(value: unknown, options: { requireProviderDecision?: boolean } = {}): TextMenuDocument | undefined {
  const root = record(value); if (!root || !onlyKeys(root, ['pages']) || !Array.isArray(root.pages)) return undefined;
  const pages: TextTransportPage[] = [];
  for (const raw of root.pages) { const page = record(raw); if (!page || !onlyKeys(page, ['pageNumber', 'sections']) || !Number.isInteger(page.pageNumber) || !Array.isArray(page.sections)) return undefined; const sections = page.sections.map((section) => decodeSection(section, options)); if (sections.some((section) => !section)) return undefined; pages.push({ pageNumber: page.pageNumber as number, sections: sections as TextTransportSection[] }); }
  return { pages };
}

export function validateTextStructure(value: unknown, expectedPageCount: number, options: { requireProviderDecision?: boolean } = {}): TextStructuralValidation {
  const expectedPages = Array.from({ length: expectedPageCount }, (_, index) => index + 1); const root = record(value); const rawPages = root && onlyKeys(root, ['pages']) && Array.isArray(root.pages) ? root.pages : [];
  const returnedPages: number[] = []; const malformedPages: Array<number | string> = []; const malformedSections: Array<number | string> = []; const malformedItems: Array<number | string> = [];
  rawPages.forEach((rawPage, index) => {
    const page = record(rawPage); const marker = Number.isInteger(page?.pageNumber) ? page!.pageNumber as number : `index:${index}`;
    if (!page || !Number.isInteger(page.pageNumber) || !Array.isArray(page.sections)) { malformedPages.push(marker); return; }
    returnedPages.push(page.pageNumber as number);
    page.sections.forEach((rawSection, sectionIndex) => { const section = decodeSection(rawSection, options); if (!section) { malformedSections.push(`${page.pageNumber}:${sectionIndex}`); const candidate = record(rawSection); if (Array.isArray(candidate?.items)) candidate.items.forEach((rawItem, itemIndex) => { if (!decodeItem(rawItem, options)) malformedItems.push(`${page.pageNumber}:${sectionIndex}:${itemIndex}`); }); } });
  });
  if (!root || !Array.isArray(root.pages) || !onlyKeys(root, ['pages'])) malformedPages.push('root');
  const counts = new Map<number, number>(); returnedPages.forEach((page) => counts.set(page, (counts.get(page) ?? 0) + 1));
  const duplicatedPages = [...counts].filter(([, count]) => count > 1).map(([page]) => page); const returnedSet = new Set(returnedPages);
  const unexpectedPages = returnedPages.filter((page) => !expectedPages.includes(page)); const missingPages = expectedPages.filter((page) => !returnedSet.has(page));
  const outOfOrderPages = returnedPages.filter((page, index) => index > 0 && page <= returnedPages[index - 1]);
  return { expectedPageCount, returnedPageCount: returnedPages.length, expectedPages, returnedPages, missingPages, unexpectedPages, duplicatedPages, outOfOrderPages, malformedPages, malformedSections, malformedItems, structuralValid: returnedPages.length === expectedPages.length && !missingPages.length && !unexpectedPages.length && !duplicatedPages.length && !outOfOrderPages.length && !malformedPages.length && !malformedSections.length && !malformedItems.length };
}

function observedPrice(raw: string): ObservedPrice {
  const amountMatch = raw.match(/\d{1,6}(?:[.,]\d{1,2})?/); const amount = amountMatch ? Number(amountMatch[0].replace(',', '.')) : undefined;
  return { raw, amount: Number.isFinite(amount) ? amount : null, currency: null };
}
export function adaptTextMenuDocument(document: TextMenuDocument) {
  return {
    pages: document.pages.map((page) => ({
      page: page.pageNumber,
      sections: page.sections.map((section) => ({
        id: randomUUID(),
        modelSectionHint: undefined,
        title: section.title,
        continuesPrevious: section.continuesPrevious,
        items: section.items.map((item) => ({
          itemId: randomUUID(),
          candidateId: randomUUID(),
          name: item.name,
          description: item.description,
          rawPrice: item.rawPrice,
          price: item.rawPrice && item.priceAssociation !== 'ambiguous' ? observedPrice(item.rawPrice) : undefined,
          variants: item.priceVariants?.map((variant) => ({ ...observedPrice(variant.raw), label: variant.label ?? null })),
          priceAssociation: item.priceAssociation,
          descriptionAssociation: item.descriptionAssociation,
          providerDecision: item.providerDecision,
        })),
      })),
    })),
  };
}

export function reconcileTextDocument(document: TextCanonicalDocument): TextCanonicalDocument {
  let prior: TextCanonicalSection[] = []; let priorPageNumber: number | undefined;
  return { ...document, pages: document.pages.map((page) => {
    const sections = page.sections.map((section) => {
      if (section.title?.trim() || !section.continuesPrevious) return { ...section, items: [...section.items] };
      const candidates = priorPageNumber === page.page - 1 ? prior.filter((entry) => Boolean(entry.title?.trim())) : [];
      const continuation = candidates.length === 1 ? candidates[0] : undefined;
      return continuation ? { ...section, title: continuation.title, continuationOf: continuation.id, parentId: randomUUID(), items: [...section.items] } : { ...section, items: [...section.items] };
    });
    prior = sections; priorPageNumber = page.page;
    return { ...page, sections };
  }) };
}

const PRICE_TOKEN = /(?:\p{Sc}\s*)?\d{1,6}(?:[.,]\d{1,2})?(?:\s*[A-Za-z]{3,5})?/giu;
const PRICE_ONLY = /^(?:\p{Sc}\s*)?\d{1,6}(?:[.,]\d{1,2})?(?:\s*[A-Za-z]{3,5})?$/iu;
const DECORATIVE = /(?:https?:\/\/|www\.|@\w+|follow\s+us|thank\s+you|bienvenid[oa]|contact(?:o| us)?|tel(?:ephone)?\s*:)/i;
function candidateReasons(section: TextCanonicalSection, item: TextCanonicalItem, duplicate: boolean): TextValidationReason[] {
  const name = item.name?.trim() ?? ''; const reasons: TextValidationReason[] = []; const prices = name.match(PRICE_TOKEN) ?? [];
  if (!name) reasons.push('EMPTY_NAME'); if (PRICE_ONLY.test(name)) reasons.push('PRICE_ONLY_NAME'); if (prices.length > 1) reasons.push('MULTIPLE_PRICES_IN_NAME');
  if ((/\s(?:\/|\||;|•)\s/.test(name) || /\b(?:and|y)\b/i.test(name)) && name.length > 36) reasons.push('MERGED_NAME');
  if (DECORATIVE.test(name)) reasons.push('DECORATIVE_CONTENT'); if (!section.title?.trim()) reasons.push('MISSING_SECTION'); if (item.priceAssociation === 'ambiguous') reasons.push('AMBIGUOUS_PRICE');
  if (!item.description?.trim() && !item.rawPrice && /^[\p{Ll}]/u.test(name) && name.split(/\s+/).length >= 7 && /[,:;.]$/.test(name)) reasons.push('DESCRIPTION_FRAGMENT');
  if (duplicate) reasons.push('DUPLICATE_ITEM'); return reasons;
}
export function applyTextValidation(document: TextCanonicalDocument): TextCanonicalDocument {
  return { ...document, pages: document.pages.map((page) => {
    const counts = new Map<string, number>();
    for (const section of page.sections) for (const item of section.items) { const key = `${normalized(item.name ?? '').toLocaleLowerCase()}|${normalized(item.rawPrice ?? item.price?.raw ?? '')}`; if (key !== '|') counts.set(key, (counts.get(key) ?? 0) + 1); }
    return { ...page, sections: page.sections.map((section) => ({ ...section, items: section.items.map((item) => {
      const key = `${normalized(item.name ?? '').toLocaleLowerCase()}|${normalized(item.rawPrice ?? item.price?.raw ?? '')}`; const reasons = candidateReasons(section, item, (counts.get(key) ?? 0) > 1);
      const invalid = reasons.some((reason) => ['EMPTY_NAME', 'PRICE_ONLY_NAME', 'MULTIPLE_PRICES_IN_NAME', 'DECORATIVE_CONTENT'].includes(reason));
      return { ...item, validation: { status: invalid ? 'invalid' : reasons.length ? 'review' : 'valid', reasons } };
    }) })) };
  }) };
}

export function textMetrics(document?: TextCanonicalDocument): TextMetrics {
  const metrics: TextMetrics = { totalSections: 0, totalItems: 0, valid: 0, review: 0, invalid: 0, validationReasonCounts: {} }; if (!document) return metrics;
  for (const page of document.pages) for (const section of page.sections) { metrics.totalSections += 1; for (const item of section.items) { metrics.totalItems += 1; const status = item.validation?.status ?? 'review'; metrics[status] += 1; for (const reason of item.validation?.reasons ?? []) metrics.validationReasonCounts[reason] = (metrics.validationReasonCounts[reason] ?? 0) + 1; } }
  return metrics;
}
export const TEXT_ONLY_CLASSIFICATION_POLICY = { maxInvalidRateForA: 0.02, maxReviewRateForA: 0.1, maxAmbiguousPriceRateForA: 0.05, maxInvalidRateForB: 0.1, maxReviewRateForB: 0.35 } as const;
function isTruncated(finishReason?: string) { return /max_tokens|length|truncat/i.test(finishReason ?? ''); }
export function classifyTextOnly(input: { httpStatus?: number; finishReason?: string; structuralValid: boolean; metrics: TextMetrics }): TextOnlyClassification {
  if (input.httpStatus !== 200 || !input.structuralValid || isTruncated(input.finishReason) || !input.metrics.totalItems) return 'D';
  const invalidRate = input.metrics.invalid / input.metrics.totalItems; const reviewRate = input.metrics.review / input.metrics.totalItems; const ambiguousRate = (input.metrics.validationReasonCounts.AMBIGUOUS_PRICE ?? 0) / input.metrics.totalItems;
  if (invalidRate <= TEXT_ONLY_CLASSIFICATION_POLICY.maxInvalidRateForA && reviewRate <= TEXT_ONLY_CLASSIFICATION_POLICY.maxReviewRateForA && ambiguousRate <= TEXT_ONLY_CLASSIFICATION_POLICY.maxAmbiguousPriceRateForA) return 'A';
  if (invalidRate <= TEXT_ONLY_CLASSIFICATION_POLICY.maxInvalidRateForB && reviewRate <= TEXT_ONLY_CLASSIFICATION_POLICY.maxReviewRateForB) return 'B'; return 'C';
}

function baseStructural(expectedPageCount = 0): TextStructuralValidation { const expectedPages = Array.from({ length: expectedPageCount }, (_, index) => index + 1); return { expectedPageCount, returnedPageCount: 0, expectedPages, returnedPages: [], missingPages: expectedPages, unexpectedPages: [], duplicatedPages: [], outOfOrderPages: [], malformedPages: [], malformedSections: [], malformedItems: [], structuralValid: false }; }
function baseReport(model: string, preflight?: TextPreflight): Omit<TextOnlyReport, 'classification'> { return { requestCount: 0, model, apiVersion: TEXT_ONLY_API_VERSION, endpoint: `https://generativelanguage.googleapis.com/${TEXT_ONLY_API_VERSION}/models/${model}:generateContent`, promptVersion: TEXT_ONLY_PROMPT_VERSION, schemaVersion: TEXT_ONLY_SCHEMA_VERSION, serializerVersion: TEXT_DOCUMENT_SERIALIZER_VERSION, preflight, structural: baseStructural(preflight?.pdfPages ?? 0), metrics: textMetrics(), fullTextDocumentValid: false }; }
function sanitize(message: unknown) { return typeof message === 'string' ? message.replaceAll(/AIza[0-9A-Za-z_-]+/g, '[REDACTED_KEY]').slice(0, 500) : undefined; }
function errorClass(status?: number, message?: string): TextOnlyReport['errorClass'] { if (status === 429) return 'QUOTA'; if (status === 400 || status === 413) return 'REQUEST_CONTRACT'; if (status === 404) return 'MODEL'; if (/abort|timeout/i.test(message ?? '')) return 'TIMEOUT'; return status && status >= 500 ? 'PROVIDER' : 'OTHER'; }

export async function executeTextOnlyEvaluation(input: { pdf?: Uint8Array; textDocument?: TextDocument; apiKey: string; model?: string; fetcher?: GeminiFetch; onPreflight?: (preflight: TextPreflight) => void }): Promise<TextOnlyReport> {
  let model: string; try { model = input.model?.trim() || configuredTextOnlyModel(); } catch (error) { return { ...baseReport(TEXT_ONLY_DEFAULT_MODEL), errorClass: 'REQUEST_CONTRACT', errorMessage: error instanceof Error ? error.message : 'TEXT_ONLY_MODEL_INVALID', classification: 'D' }; }
  let document: TextDocument; try { document = input.textDocument ?? await extractTextDocument(input.pdf ?? new Uint8Array()); } catch (error) { return { ...baseReport(model), errorClass: 'OTHER', errorMessage: error instanceof Error ? error.message : 'TEXT_ONLY_EXTRACTION_FAILED', classification: 'D' }; }
  const preflight = preflightTextDocument(document, { pdf: input.pdf, expectedPages: document.pages.length }); const report = baseReport(model, preflight);
  if (preflight.status !== 'ready') return { ...report, errorClass: 'NOT_EVALUABLE', errorMessage: preflight.reason, classification: 'D' };
  const request = buildTextOnlyRequest(document); input.onPreflight?.(preflight); const budget = new TextOnlyRequestBudget(); const startedAt = Date.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TEXT_ONLY_TIMEOUT_MS);
  try {
    budget.consume(); const response = await (input.fetcher ?? fetch)(report.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': input.apiKey }, body: request.bodyText, signal: controller.signal });
    const responseText = await response.text(); const latencyMs = Date.now() - startedAt; const responseBytes = Buffer.byteLength(responseText); let payload: JsonRecord;
    try { payload = JSON.parse(responseText || '{}') as JsonRecord; } catch { return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, errorClass: 'OUTPUT/SCHEMA', errorMessage: 'TEXT_ONLY_INVALID_PROVIDER_JSON', classification: 'D' }; }
    const usage = record(payload.usageMetadata); const candidate = Array.isArray(payload.candidates) ? record(payload.candidates[0]) : undefined; const finishReason = text(candidate?.finishReason);
    if (!response.ok) { const error = record(payload.error); return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, errorStatus: text(error?.status), errorMessage: sanitize(error?.message), errorClass: errorClass(response.status, text(error?.message)), classification: 'D' }; }
    const resultText = (record(candidate?.content)?.parts as Array<JsonRecord> | undefined)?.map((part) => text(part.text)).find((value): value is string => Boolean(value)); let raw: unknown;
    try { raw = JSON.parse(resultText ?? ''); } catch { return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, finishReason, inputTokens: usage?.promptTokenCount as number | undefined, outputTokens: usage?.candidatesTokenCount as number | undefined, totalTokens: usage?.totalTokenCount as number | undefined, errorClass: 'OUTPUT/SCHEMA', errorMessage: 'TEXT_ONLY_INVALID_JSON', classification: 'D' }; }
    const structural = validateTextStructure(raw, preflight.pdfPages); const decoded = decodeTextMenuDocument(raw);
    if (!decoded) return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, finishReason, inputTokens: usage?.promptTokenCount as number | undefined, outputTokens: usage?.candidatesTokenCount as number | undefined, totalTokens: usage?.totalTokenCount as number | undefined, structural, errorClass: 'OUTPUT/SCHEMA', errorMessage: 'TEXT_ONLY_DECODE_FAILED', classification: 'D' };
    const validated = applyTextValidation(reconcileTextDocument(adaptTextMenuDocument(decoded))); const metrics = textMetrics(validated); const fullTextDocumentValid = structural.structuralValid && !isTruncated(finishReason);
    return { ...report, requestCount: budget.count, httpStatus: response.status, latencyMs, responseBytes, finishReason, inputTokens: usage?.promptTokenCount as number | undefined, outputTokens: usage?.candidatesTokenCount as number | undefined, totalTokens: usage?.totalTokenCount as number | undefined, structural, metrics, fullTextDocumentValid, document: validated, classification: classifyTextOnly({ httpStatus: response.status, finishReason, structuralValid: structural.structuralValid, metrics }) };
  } catch (error) { const message = error instanceof Error ? error.message : 'TEXT_ONLY_REQUEST_FAILED'; return { ...report, requestCount: budget.count, latencyMs: Date.now() - startedAt, errorClass: errorClass(undefined, message), errorMessage: sanitize(message), classification: 'D' }; } finally { clearTimeout(timer); }
}

export function pageEvaluationReport(document: TextCanonicalDocument | undefined, source: TextDocument, pageNumbers: number[]) {
  return pageNumbers.map((pageNumber) => { const page = document?.pages.find((entry) => entry.page === pageNumber); const sourcePage = source.pages.find((entry) => entry.pageNumber === pageNumber); const coverage = preflightTextDocument({ pages: sourcePage ? [sourcePage] : [], serializerVersion: source.serializerVersion }).coverage[0]; const items = page?.sections.flatMap((section) => section.items.map((item) => ({ name: item.name, descriptionPresent: Boolean(item.description?.trim()), rawPrice: item.rawPrice ?? item.price?.raw ?? null, variants: item.variants?.map((variant) => ({ raw: variant.raw, label: variant.label ?? null })) ?? [], status: item.validation?.status ?? 'review', reasons: item.validation?.reasons ?? [] }))) ?? []; return { page: pageNumber, sourceTextQuality: coverage?.quality ?? 'empty', sections: page?.sections.map((section) => section.title ?? '[untitled]') ?? [], itemCount: items.length, valid: items.filter((item) => item.status === 'valid').length, review: items.filter((item) => item.status === 'review').length, invalid: items.filter((item) => item.status === 'invalid').length, items }; });
}
