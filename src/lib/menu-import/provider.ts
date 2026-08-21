import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { ExtractedImage, ExtractedMenuItem, ImageSuggestion, LineageEvent, PageText, PdfAnalysisProvider, PdfDocument, StructuredMenuOutput } from './types';
import {
  ANALYZER_PROMPT_VERSION,
  applyValidation,
  assignServerIds,
  createServerIdFactory,
  DEFAULT_RETRY_BUDGET,
  difficultRegions,
  flattenVisualDocument,
  isNormalizedBox,
  mergeRegionalSections,
  outcomeForPage,
  reconcileVisualDocument,
  regionToPageBox,
  retryInstructions,
  type NormalizedBox,
  type ValidationSignal,
  type VisualAsset,
  type VisualMenuDocument,
  type VisualMenuItem,
  type VisualMenuPage,
  type VisualPageEvidence,
  validateVisualDocument,
} from './visual-analysis';

const MIN_NATIVE_TEXT_CHARACTERS = 40;
const PRICE = /(?:\p{Sc}\s*)?(\d{1,6}(?:[.,]\d{1,2})?)(?:\s*[A-Za-z]{3,5})?\s*$/iu;
const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low']);
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
const GEMINI_DEFAULT_TIMEOUT_MS = 8_000;
const GEMINI_MAX_AUXILIARY_CHARS = 8_000;
const DEFAULT_RENDER_MAX_DIMENSION = 2_048;
const DEFAULT_RENDER_MAX_PIXELS = 4_000_000;
const DEFAULT_RENDER_MAX_BYTES = 3_000_000;
const DEFAULT_RENDER_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_PAGES = 20;

function boundedEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;
}

function confidence(value: string | undefined, threshold = 3): 'high' | 'medium' | 'low' {
  if (!value?.trim()) return 'low';
  return value.trim().length >= threshold ? 'high' : 'medium';
}

function isCategoryHeading(value: string) {
  const letters = value.replace(/[^\p{L}]/gu, '');
  return letters.length >= 3 && value === value.toLocaleUpperCase();
}

type NodeCanvasGlobals = { DOMMatrix: unknown; ImageData: unknown; Path2D: unknown };
type CanvasModule = NodeCanvasGlobals & {
  createCanvas: (width: number, height: number) => {
    width: number;
    height: number;
    getContext: (type: '2d') => unknown;
    toBuffer: (mime: 'image/jpeg', quality?: number) => Buffer;
  };
  loadImage?: (data: Uint8Array) => Promise<{ width: number; height: number }>;
};
type PdfViewport = { width: number; height: number };
type PdfRenderPage = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (parameters: { canvasContext: unknown; viewport: PdfViewport }) => { promise: Promise<unknown>; cancel?: () => void };
};

/** PDF.js needs these Node canvas globals before its module is loaded. */
export function installNodeCanvasGlobals(canvas: NodeCanvasGlobals) {
  const target = globalThis as Record<string, unknown>;
  if (!target.DOMMatrix) target.DOMMatrix = canvas.DOMMatrix;
  if (!target.ImageData) target.ImageData = canvas.ImageData;
  if (!target.Path2D) target.Path2D = canvas.Path2D;
}

/** Preload the worker for PDF.js's Node fake-worker path in bundled deployments. */
export function installPdfJsWorkerHandler(worker: { WorkerMessageHandler: unknown }) {
  const target = globalThis as typeof globalThis & { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
  if (!target.pdfjsWorker?.WorkerMessageHandler) target.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
}

async function loadNodePdfJs() {
  const canvas = await import('@napi-rs/canvas');
  installNodeCanvasGlobals(canvas);
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  installPdfJsWorkerHandler(worker);
  return { pdfjs: await import('pdfjs-dist/legacy/build/pdf.mjs'), canvas: canvas as unknown as CanvasModule };
}

export type RenderLimits = {
  maxDimension: number;
  maxPixels: number;
  maxBytes: number;
  timeoutMs: number;
};

function configuredRenderLimits(): RenderLimits {
  return {
    maxDimension: boundedEnv('MENU_IMPORT_RENDER_MAX_DIMENSION', DEFAULT_RENDER_MAX_DIMENSION, 512, 4_096),
    maxPixels: boundedEnv('MENU_IMPORT_RENDER_MAX_PIXELS', DEFAULT_RENDER_MAX_PIXELS, 500_000, 12_000_000),
    maxBytes: boundedEnv('MENU_IMPORT_RENDER_MAX_BYTES', DEFAULT_RENDER_MAX_BYTES, 250_000, 8_000_000),
    timeoutMs: boundedEnv('MENU_IMPORT_RENDER_TIMEOUT_MS', DEFAULT_RENDER_TIMEOUT_MS, 1_000, 30_000),
  };
}

export function renderedDimensions(viewport: PdfViewport, limits: Pick<RenderLimits, 'maxDimension' | 'maxPixels'>) {
  if (!(viewport.width > 0 && viewport.height > 0)) throw new Error('MENU_IMPORT_INVALID_PAGE_DIMENSIONS');
  const scale = Math.min(
    limits.maxDimension / Math.max(viewport.width, viewport.height),
    Math.sqrt(limits.maxPixels / (viewport.width * viewport.height)),
  );
  return { width: Math.max(1, Math.floor(viewport.width * scale)), height: Math.max(1, Math.floor(viewport.height * scale)), scale };
}

async function timed<T>(work: Promise<T>, timeoutMs: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => { onTimeout?.(); reject(new Error('MENU_IMPORT_RENDER_TIMEOUT')); }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Renders a single numbered PDF page with fixed bounds and always releases the canvas backing store. */
export async function renderPdfPage(page: PdfRenderPage, canvasModule: CanvasModule, limits = configuredRenderLimits()): Promise<VisualAsset> {
  const original = page.getViewport({ scale: 1 });
  let dimensions = renderedDimensions(original, limits);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const viewport = page.getViewport({ scale: dimensions.scale });
    const canvas = canvasModule.createCanvas(dimensions.width, dimensions.height);
    const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    try {
      await timed(task.promise, limits.timeoutMs, task.cancel);
      const data = new Uint8Array(canvas.toBuffer('image/jpeg', 85));
      if (data.byteLength <= limits.maxBytes || attempt === 2) {
        if (data.byteLength > limits.maxBytes) throw new Error('MENU_IMPORT_RENDER_TOO_LARGE');
        return { mimeType: 'image/jpeg', data, width: dimensions.width, height: dimensions.height };
      }
      dimensions = { ...dimensions, width: Math.max(1, Math.floor(dimensions.width * 0.72)), height: Math.max(1, Math.floor(dimensions.height * 0.72)), scale: dimensions.scale * 0.72 };
    } finally {
      // napi canvas releases native backing storage once dimensions are reset.
      canvas.width = 1;
      canvas.height = 1;
    }
  }
  throw new Error('MENU_IMPORT_RENDER_FAILED');
}

function ppmFromRgba(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const header = new TextEncoder().encode(`P6\n${width} ${height}\n255\n`);
  const rgb = new Uint8Array(width * height * 3);
  for (let source = 0, target = 0; source < data.length; source += 4) {
    rgb[target++] = data[source]; rgb[target++] = data[source + 1]; rgb[target++] = data[source + 2];
  }
  const output = new Uint8Array(header.length + rgb.length);
  output.set(header); output.set(rgb, header.length);
  return output;
}

export type GeminiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type GeminiConfig = { key?: string; model?: string; timeoutMs?: number; fetch?: GeminiFetch; architectureStage?: 1 | 2; analyzerVersion?: string; rawRetentionDays?: number };
export type GeminiTextStructurer = ((pages: PageText[]) => Promise<ExtractedMenuItem[] | undefined>) & {
  lastFallbackReason?: string;
  model?: string;
  lastSignals?: ValidationSignal[];
  lastRetries?: Array<{ page: number; reason: string; region?: NormalizedBox }>;
  lastLineage?: LineageEvent[];
};
export type GeminiVisualStructurer = ((pages: VisualPageEvidence[]) => Promise<VisualMenuDocument | undefined>) & {
  lastFallbackReason?: string;
  model?: string;
  lastSignals?: ValidationSignal[];
  lastRetries?: Array<{ page: number; reason: string; region?: NormalizedBox }>;
  lastLineage?: LineageEvent[];
  architectureStage?: 1 | 2;
};

export type PdfAnalysisOptions = {
  /** Disabled in production until durable image storage/conversion is available. */
  extractImages?: boolean;
  geminiStructurer?: GeminiTextStructurer;
  geminiVisualStructurer?: GeminiVisualStructurer;
  renderLimits?: Partial<RenderLimits>;
  maxPages?: number;
};

function serverGeminiConfig(): GeminiConfig {
  const analyzerVersion = process.env.MENU_IMPORT_ANALYZER_VERSION || 'menu-import-v4-visual';
  const requestedStage = process.env.MENU_IMPORT_VISUAL_ARCHITECTURE_STAGE === '2' ? 2 : 1;
  return {
    key: process.env.MENU_IMPORT_GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY,
    model: process.env.MENU_IMPORT_GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    timeoutMs: boundedEnv('MENU_IMPORT_GEMINI_TIMEOUT_MS', GEMINI_DEFAULT_TIMEOUT_MS, 1_000, 30_000),
    architectureStage: requestedStage === 2 && analyzerVersion === 'menu-import-v4-visual' && process.env.MENU_IMPORT_STAGE1_LINEAGE_VERIFIED === 'true' ? 2 : 1,
    analyzerVersion,
    rawRetentionDays: boundedEnv('MENU_IMPORT_LINEAGE_RAW_RETENTION_DAYS', 7, 0, 30),
  };
}

function pageAuxiliaryText(page: VisualPageEvidence) {
  return {
    page: page.page,
    nativeText: page.nativeText?.slice(0, GEMINI_MAX_AUXILIARY_CHARS) || undefined,
    ocrText: page.ocrText?.slice(0, GEMINI_MAX_AUXILIARY_CHARS) || undefined,
    selectedText: page.text.slice(0, GEMINI_MAX_AUXILIARY_CHARS),
  };
}

const BOX_SCHEMA = { type: 'object', additionalProperties: false, required: ['x', 'y', 'width', 'height'], properties: { x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } } } as const;
const PRICE_SCHEMA = { type: 'object', additionalProperties: false, properties: { raw: { type: 'string' }, amount: { type: ['number', 'null'] }, currency: { type: ['string', 'null'] }, label: { type: 'string' }, shared: { type: 'boolean' } } } as const;
const ITEM_SCHEMA = { type: 'object', additionalProperties: false, required: ['name'], properties: {
  name: { type: 'string' }, description: { type: 'string' }, rawPrice: { type: 'string' }, modifiers: { type: 'array', items: { type: 'string' } }, options: { type: 'array', items: { type: 'string' } }, attributes: { type: 'array', items: { type: 'string' } }, bbox: BOX_SCHEMA, price: PRICE_SCHEMA, variants: { type: 'array', items: PRICE_SCHEMA },
  confidence: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', enum: ['high', 'medium', 'low'] }, description: { type: 'string', enum: ['high', 'medium', 'low'] }, price: { type: 'string', enum: ['high', 'medium', 'low'] }, section: { type: 'string', enum: ['high', 'medium', 'low'] } } },
} } as const;
const SECTION_SCHEMA = { type: 'object', additionalProperties: false, required: ['id', 'items'], properties: { id: { type: 'string' }, title: { type: 'string' }, parentId: { type: 'string' }, continuationOf: { type: 'string' }, bbox: BOX_SCHEMA, items: { type: 'array', items: ITEM_SCHEMA } } } as const;
const PAGE_SCHEMA = { type: 'object', additionalProperties: false, required: ['page', 'sections'], properties: { page: { type: 'integer' }, metadata: { type: 'object', additionalProperties: { type: 'string' } }, decorative: { type: 'array', items: { type: 'string' } }, sections: { type: 'array', items: SECTION_SCHEMA } } } as const;
const VISUAL_RESPONSE_SCHEMA = { type: 'object', additionalProperties: false, required: ['pages'], properties: { metadata: { type: 'object', additionalProperties: { type: 'string' } }, globalPriceNotes: { type: 'array', items: { type: 'string' } }, pages: { type: 'array', items: PAGE_SCHEMA } } } as const;

export function buildGeminiRequestBody(pages: VisualPageEvidence[], retry?: { reason: string; region?: NormalizedBox }, stage: 1 | 2 = 2) {
  const retryText = retry ? ` Retry focus: ${retry.reason}.${retry.region ? ` Focus region ${JSON.stringify(retry.region)}.` : ''}` : '';
  const text = stage === 2
    ? `Analyze the supplied restaurant-menu PAGE IMAGE(S). The rendered image is the VISUAL SOURCE OF TRUTH for boundaries, columns, tables, hierarchy, and price associations. Return JSON matching the schema. Discover labels and currencies from the page; never invent labels, translations, categories, or prices. Preserve raw prices and leave amount/currency null when uncertain. Use normalized bboxes (0..1). Decorative/contact/social content is not a product.${retryText}`
    : `Analyze the supplied restaurant-menu PAGE IMAGE(S) as the primary evidence. Reconstruct visual columns, typography, tables, hierarchy, aligned prices, and continuation. Auxiliary extracted text is only corroborating evidence; never derive layout from its reading order. Return JSON matching the schema. Discover section titles and currencies from the page—never invent labels, translations, categories, or prices. Preserve raw prices and leave amount/currency null when uncertain. Use normalized bboxes (0..1). Treat decorative/contact/social content as decorative, not products.${retryText}\nAUXILIARY EVIDENCE:\n${JSON.stringify(pages.map(pageAuxiliaryText))}`;
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text }];
  for (const page of pages) {
    if (!page.image) continue;
    parts.push({ text: `PAGE ${page.page} image` });
    parts.push({ inlineData: { mimeType: page.image.mimeType, data: Buffer.from(page.image.data).toString('base64') } });
  }
  return { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: VISUAL_RESPONSE_SCHEMA } };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function stringArray(value: unknown) { return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value.map((entry) => entry.trim()).filter(Boolean) : undefined; }
function stringRecord(value: unknown) {
  const entry = record(value);
  return entry && Object.values(entry).every((item) => typeof item === 'string') ? entry as Record<string, string> : undefined;
}
function decodedPrice(value: unknown) {
  const price = record(value);
  if (!price) return undefined;
  if (price.raw !== undefined && typeof price.raw !== 'string') return undefined;
  if (price.amount !== undefined && price.amount !== null && (typeof price.amount !== 'number' || !Number.isFinite(price.amount) || price.amount < 0)) return undefined;
  if (price.currency !== undefined && price.currency !== null && typeof price.currency !== 'string') return undefined;
  if (price.label !== undefined && typeof price.label !== 'string') return undefined;
  if (price.shared !== undefined && typeof price.shared !== 'boolean') return undefined;
  return price as VisualMenuItem['price'];
}

export function decodeGeminiVisualDocument(value: unknown, evidence: VisualPageEvidence[]): VisualMenuDocument | undefined {
  const root = record(value);
  if (!root || !Array.isArray(root.pages)) return undefined;
  const validPages = new Set(evidence.map((page) => page.page));
  const pages: VisualMenuPage[] = [];
  for (const rawPage of root.pages) {
    const page = record(rawPage);
    if (!page || typeof page.page !== 'number' || !Number.isInteger(page.page) || !validPages.has(page.page) || !Array.isArray(page.sections)) return undefined;
    const sections = [];
    for (const rawSection of page.sections) {
      const section = record(rawSection);
      if (!section || typeof section.id !== 'string' || !section.id.trim() || !Array.isArray(section.items)) return undefined;
      if (section.title !== undefined && typeof section.title !== 'string') return undefined;
      if (section.parentId !== undefined && typeof section.parentId !== 'string') return undefined;
      if (section.continuationOf !== undefined && typeof section.continuationOf !== 'string') return undefined;
      if (section.bbox !== undefined && !isNormalizedBox(section.bbox)) return undefined;
      const items: VisualMenuItem[] = [];
      for (const rawItem of section.items) {
        const item = record(rawItem);
        if (!item || typeof item.name !== 'string' || !item.name.trim()) return undefined;
        if (item.description !== undefined && typeof item.description !== 'string') return undefined;
        if (item.rawPrice !== undefined && typeof item.rawPrice !== 'string') return undefined;
        if (item.bbox !== undefined && !isNormalizedBox(item.bbox)) return undefined;
        const price = decodedPrice(item.price); if (item.price !== undefined && !price) return undefined;
        const variants = item.variants === undefined ? undefined : Array.isArray(item.variants) ? item.variants.map(decodedPrice) : undefined;
        if (item.variants !== undefined && (!variants || variants.some((entry) => !entry))) return undefined;
        const itemConfidence = record(item.confidence);
        if (itemConfidence && Object.values(itemConfidence).some((entry) => !CONFIDENCE_VALUES.has(entry as string))) return undefined;
        const modifiers = stringArray(item.modifiers); const options = stringArray(item.options); const attributes = stringArray(item.attributes);
        if ((item.modifiers !== undefined && !modifiers) || (item.options !== undefined && !options) || (item.attributes !== undefined && !attributes)) return undefined;
        const cropRegion = evidence.find((entry) => entry.page === page.page)?.region;
        const itemBox = item.bbox as NormalizedBox | undefined;
        items.push({ name: item.name.trim(), description: typeof item.description === 'string' ? item.description.trim() || undefined : undefined, rawPrice: typeof item.rawPrice === 'string' ? item.rawPrice.trim() || undefined : undefined, price, variants: variants as VisualMenuItem['variants'], modifiers, options, attributes, bbox: itemBox && cropRegion ? regionToPageBox(itemBox, cropRegion) : itemBox, confidence: itemConfidence as VisualMenuItem['confidence'] });
      }
      const cropRegion = evidence.find((entry) => entry.page === page.page)?.region;
      const sectionBox = section.bbox as NormalizedBox | undefined;
      sections.push({ id: section.id.trim(), modelSectionHint: section.id.trim(), title: typeof section.title === 'string' ? section.title.trim() || undefined : undefined, parentId: section.parentId as string | undefined, continuationOf: section.continuationOf as string | undefined, bbox: sectionBox && cropRegion ? regionToPageBox(sectionBox, cropRegion) : sectionBox, items });
    }
    pages.push({ page: page.page, sections, metadata: stringRecord(page.metadata), decorative: stringArray(page.decorative) });
  }
  return { metadata: stringRecord(root.metadata), globalPriceNotes: stringArray(root.globalPriceNotes), pages };
}

function sha256Text(value: string) { return createHash('sha256').update(value).digest('hex'); }

async function callGemini(fetcher: GeminiFetch, config: GeminiConfig, pages: VisualPageEvidence[], retry?: { reason: string; region?: NormalizedBox }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? GEMINI_DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model ?? GEMINI_DEFAULT_MODEL)}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': config.key ?? '' }, body: JSON.stringify(buildGeminiRequestBody(pages, retry, config.architectureStage ?? 1)), signal: controller.signal,
    });
    if (!response.ok) return { reason: response.status === 429 ? 'GEMINI_RATE_LIMITED' : 'GEMINI_REQUEST_FAILED' as const };
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const rawPayload = JSON.stringify(payload);
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') return { reason: 'GEMINI_INVALID_RESPONSE' as const };
    try { return { document: JSON.parse(text) as unknown, rawPayloadHash: sha256Text(rawPayload), rawPayload: config.rawRetentionDays ? rawPayload.slice(0, 16_000) : undefined }; } catch { return { reason: 'GEMINI_INVALID_RESPONSE' as const }; }
  } catch (error) {
    return { reason: error instanceof DOMException && error.name === 'AbortError' ? 'GEMINI_TIMEOUT' as const : 'GEMINI_REQUEST_FAILED' as const };
  } finally { clearTimeout(timer); }
}

async function cropVisualPage(page: VisualPageEvidence, region: NormalizedBox): Promise<VisualPageEvidence | undefined> {
  if (!page.image) return undefined;
  // Region retries send a physical crop, not merely coordinates in a prompt.
  const canvas = await import('@napi-rs/canvas');
  const source = await canvas.loadImage(Buffer.from(page.image.data));
  const sx = Math.floor(source.width * region.x); const sy = Math.floor(source.height * region.y);
  const width = Math.max(1, Math.floor(source.width * region.width)); const height = Math.max(1, Math.floor(source.height * region.height));
  const target = canvas.createCanvas(width, height); const context = target.getContext('2d');
  context.drawImage(source, sx, sy, width, height, 0, 0, width, height);
  try { return { ...page, region, image: { mimeType: 'image/jpeg', data: new Uint8Array(target.toBuffer('image/jpeg', 85)), width, height } }; }
  finally { target.width = 1; target.height = 1; }
}

/** Server-only multimodal provider boundary. It records bounded retry evidence but never returns provider payloads. */
export function createGeminiVisualStructurer(config: GeminiConfig = serverGeminiConfig()): GeminiVisualStructurer {
  const structurer: GeminiVisualStructurer = async (pages) => {
    structurer.lastFallbackReason = undefined; structurer.lastSignals = []; structurer.lastRetries = []; structurer.lastLineage = []; structurer.model = config.model ?? GEMINI_DEFAULT_MODEL;
    if (!config.key) { structurer.lastFallbackReason = 'GEMINI_NOT_CONFIGURED'; return undefined; }
    if (!pages.some((page) => page.image)) { structurer.lastFallbackReason = 'GEMINI_NO_RENDERED_PAGES'; return undefined; }
    const fetcher = config.fetch ?? fetch;
    const stage = config.architectureStage ?? 1;
    structurer.architectureStage = stage;
    const ids = createServerIdFactory(randomUUID());
    const event = (entry: Omit<LineageEvent, 'id' | 'analysisRunId'>) => structurer.lastLineage!.push({ ...entry, id: ids.next('lineage', entry.page, 0), analysisRunId: ids.analysisRunId });
    const accepted: VisualMenuPage[] = [];
    for (const page of pages) {
      if (!page.image) continue;
      const imageHash = createHash('sha256').update(page.image.data).digest('hex');
      event({ sourceKind: 'gemini-visual', stage: 'render', page: page.page, analyzerVersion: config.analyzerVersion, imageMimeType: page.image.mimeType, imageWidth: page.image.width, imageHeight: page.image.height, imageByteSize: page.image.data.byteLength, imageHash, imageIncluded: true });
      let attempt = 0;
      let decoded: VisualMenuDocument | undefined;
      let signals: ValidationSignal[] = [];
      const maxAttempts = stage === 2 ? DEFAULT_RETRY_BUDGET.primary + DEFAULT_RETRY_BUDGET.semanticFullPage : 3;
      while (attempt < maxAttempts) {
        const retry = attempt ? retryInstructions(signals, attempt - 1).find((entry) => entry.page === page.page) : undefined;
        if (retry) structurer.lastRetries.push(retry);
        const attemptId = ids.next('attempt', page.page, attempt + 1);
        const auxiliary = retry ? pageAuxiliaryText(page) : undefined;
        event({ sourceKind: 'gemini-visual', stage: 'provider_request', page: page.page, attemptId, analyzerVersion: config.analyzerVersion, model: structurer.model, retryReason: retry?.reason, imageIncluded: true, auxiliaryTextType: retry ? (auxiliary?.ocrText ? 'ocr' : auxiliary?.nativeText ? 'native' : auxiliary?.selectedText ? 'selected' : undefined) : undefined, auxiliaryTextLength: retry ? (auxiliary?.ocrText ?? auxiliary?.nativeText ?? auxiliary?.selectedText ?? '').length : undefined });
        const startedAt = Date.now();
        let response = await callGemini(fetcher, config, [page], retry);
        let providerRetry = 0;
        while (!('document' in response) && providerRetry < DEFAULT_RETRY_BUDGET.providerTransient && ['GEMINI_RATE_LIMITED', 'GEMINI_TIMEOUT', 'GEMINI_REQUEST_FAILED'].includes(response.reason)) {
          providerRetry += 1;
          event({ sourceKind: 'provider-transient-retry', stage: 'retry', page: page.page, attemptId, analyzerVersion: config.analyzerVersion, model: structurer.model, retryReason: response.reason });
          response = await callGemini(fetcher, config, [page], retry);
        }
        if (!('document' in response)) { structurer.lastFallbackReason = response.reason; return undefined; }
        event({ sourceKind: 'gemini-visual', stage: 'provider_raw', page: page.page, attemptId, analyzerVersion: config.analyzerVersion, model: structurer.model, retryReason: retry?.reason, latencyMs: Date.now() - startedAt, rawPayloadHash: response.rawPayloadHash, rawPayload: response.rawPayload, metadata: { rawRetentionDays: config.rawRetentionDays ?? 7 } });
        decoded = decodeGeminiVisualDocument(response.document, [page]);
        if (!decoded) { structurer.lastFallbackReason = 'GEMINI_INVALID_RESPONSE'; return undefined; }
        decoded = assignServerIds(decoded, ids, attempt + 1);
        if (stage === 2) decoded = applyValidation(decoded);
        for (const section of decoded.pages[0]?.sections ?? []) for (const item of section.items) event({ sourceKind: 'gemini-visual', stage: 'decode', page: page.page, attemptId, candidateId: item.candidateId, itemId: item.itemId, sectionId: section.id, analyzerVersion: config.analyzerVersion, model: structurer.model });
        signals = validateVisualDocument(decoded, [page]);
        for (const section of decoded.pages[0]?.sections ?? []) for (const item of section.items) event({ sourceKind: 'gemini-visual', stage: 'validation', page: page.page, attemptId, candidateId: item.candidateId, itemId: item.itemId, sectionId: section.id, analyzerVersion: config.analyzerVersion, validationStatus: item.validation?.status, validationReasons: item.validation?.reasons, metadata: { rawName: item.name } });
        const pageConfidence = decoded.pages[0]?.sections.flatMap((section) => section.items).some((item) => item.confidence?.name === 'low') ? 'low' : 'medium';
        const outcome = outcomeForPage(signals, pageConfidence, attempt);
        if (outcome !== 'retry') break;
        attempt += 1;
      }
      if (!decoded) continue;
      // A remaining hard ambiguity receives at most two physical region retries.
      if (signals.some((signal) => signal.severity === 'error')) {
        for (const region of difficultRegions(page, signals).slice(0, stage === 2 ? DEFAULT_RETRY_BUDGET.semanticRegional : 2)) {
          const cropped = await cropVisualPage(page, region).catch(() => undefined);
          if (!cropped) continue;
          structurer.lastRetries.push({ page: page.page, reason: 'VISUAL_REGION_RETRY', region });
          const response = await callGemini(fetcher, config, [cropped], { reason: 'VISUAL_REGION_RETRY', region });
          if (!('document' in response)) continue;
          let regional = decodeGeminiVisualDocument(response.document, [cropped]);
          if (regional) regional = assignServerIds(stage === 2 ? applyValidation(regional) : regional, ids, attempt + 2);
          if (regional?.pages[0]) decoded.pages[0].sections = stage === 2 ? mergeRegionalSections(decoded.pages[0].sections, regional.pages[0].sections) : [...decoded.pages[0].sections, ...regional.pages[0].sections];
        }
        signals = validateVisualDocument(decoded, [page]);
      }
      structurer.lastSignals.push(...signals);
      accepted.push(...decoded.pages);
    }
    const reconciled = reconcileVisualDocument({ pages: accepted }, ids);
    structurer.lastSignals.push(...reconciled.signals);
    for (const page of reconciled.document.pages) for (const section of page.sections) for (const item of section.items) {
      const common = { sourceKind: 'gemini-visual' as const, page: page.page, candidateId: item.candidateId, itemId: item.itemId, sectionId: section.id, analyzerVersion: config.analyzerVersion };
      event({ ...common, stage: 'reconciliation', reconciliationDecision: section.parentId ? 'adjacent-continuation' : 'page-local' });
      event({ ...common, stage: 'normalization' });
      event({ ...common, stage: 'projection' });
    }
    return reconciled.document;
  };
  return structurer;
}

/** Compatibility adapter while persistence still consumes the legacy flat item type. */
export function createGeminiTextStructurer(config: GeminiConfig = serverGeminiConfig()): GeminiTextStructurer {
  const visual = createGeminiVisualStructurer(config);
  const structurer: GeminiTextStructurer = async (pages) => {
    const document = await visual(pages as VisualPageEvidence[]);
    structurer.model = visual.model; structurer.lastSignals = visual.lastSignals; structurer.lastRetries = visual.lastRetries; structurer.lastLineage = visual.lastLineage; structurer.lastFallbackReason = visual.lastFallbackReason;
    return document ? flattenVisualDocument(document) : undefined;
  };
  return structurer;
}

/** Legacy alias retained for external tests while the provider boundary is visual. */
export function decodeGeminiItems(value: unknown, pages: PageText[]): ExtractedMenuItem[] | undefined {
  const document = decodeGeminiVisualDocument(value, pages as VisualPageEvidence[]);
  return document ? flattenVisualDocument(document) : undefined;
}

type PdfImagePage = { getOperatorList: () => Promise<{ argsArray: unknown[][]; fnArray: number[] }>; objs: { get: (id: string, callback?: (value: unknown) => void) => unknown } };
type PdfJsOperators = { OPS: { paintImageXObject: number } };

export async function extractEmbeddedImages(page: PdfImagePage, pdfjs: PdfJsOperators, images: ExtractedImage[], pageNumber: number, enabled = false) {
  if (!enabled) return;
  try {
    const list = await page.getOperatorList(); const imageOperator = pdfjs.OPS.paintImageXObject;
    for (const objectId of list.argsArray.filter((_, index) => list.fnArray[index] === imageOperator).map((args) => args[0])) {
      const image = await new Promise<{ data?: Uint8ClampedArray; width?: number; height?: number } | undefined>((resolve) => page.objs.get(String(objectId), (value) => resolve(value as { data?: Uint8ClampedArray; width?: number; height?: number })));
      if (image?.data && image.width && image.height) images.push({ page: pageNumber, data: ppmFromRgba(image.data, image.width, image.height), mimeType: 'image/x-portable-pixmap', width: image.width, height: image.height });
    }
  } catch { /* Embedded assets are optional and never invalidate page analysis. */ }
}

export function textItemsToPageText(items: object[]) {
  return items.map((item) => { const value = item as { str?: unknown; hasEOL?: unknown }; return `${typeof value.str === 'string' ? value.str : ''}${value.hasEOL ? '\n' : ' '}`; }).join('').trim();
}

/** Generic, deliberately conservative local fallback. It makes no restaurant or currency assumptions. */
export function parseMenuText(pages: PageText[], options: { allowNonRenderableRecovery?: boolean } = {}): ExtractedMenuItem[] {
  const items: ExtractedMenuItem[] = [];
  for (const page of pages) {
    // Text fallback is page-local evidence; category state never crosses a page boundary.
    let category = '';
    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = rawLine.replace(/\s+/g, ' ').trim(); if (!line) continue;
      if (isCategoryHeading(line) && !PRICE.test(line)) { category = line; continue; }
      const match = line.match(PRICE); if (!match) continue;
      const nameAndDescription = line.slice(0, match.index).replace(/[.\u00B7\u2022\-\u2013\u2014]+\s*$/, '').trim();
      if (nameAndDescription.length < 2) continue;
      const split = nameAndDescription.split(/\s+[\u2013\u2014-]\s+/); const name = split.shift()!.trim(); const description = split.join(' - ').trim() || undefined;
      const price = Number(match[1].replace(',', '.'));
      const extractionStatus = options.allowNonRenderableRecovery ? 'valid' : 'review';
      items.push({ category, sectionKey: category || null, name, rawName: name, description, price: Number.isFinite(price) ? price : undefined, rawPrice: match[0].trim(), extractionStatus, page: page.page, source: { page: page.page, excerpt: line }, validationSignals: options.allowNonRenderableRecovery ? undefined : [{ code: 'provider_fallback', severity: 'warning', source: { page: page.page, excerpt: line } }], reviewReasons: options.allowNonRenderableRecovery ? undefined : [{ code: 'provider_fallback', source: { page: page.page, excerpt: line } }], confidence: { category: category ? 'high' : 'low', name: confidence(name), description: description ? confidence(description, 12) : 'low', price: Number.isFinite(price) ? 'high' : 'low' } });
    }
  }
  return items;
}

async function configuredOcr(pdf: Uint8Array): Promise<PageText[]> {
  const endpoint = process.env.MENU_IMPORT_OCR_ENDPOINT;
  if (!endpoint) throw new Error('OCR is required but MENU_IMPORT_OCR_ENDPOINT is not configured');
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/pdf' }, body: pdf as unknown as BodyInit });
  if (!response.ok) throw new Error(`OCR provider failed (${response.status})`);
  const body = await response.json() as { pages?: Array<{ page: number; text: string }> };
  if (!Array.isArray(body.pages)) throw new Error('OCR provider returned an invalid response');
  return body.pages.filter((page) => Number.isInteger(page.page) && page.page > 0 && typeof page.text === 'string').map((page) => ({ page: page.page, text: page.text.slice(0, GEMINI_MAX_AUXILIARY_CHARS), source: 'ocr' }));
}

export function selectPageEvidence(nativePages: VisualPageEvidence[], ocrPages: PageText[]): VisualPageEvidence[] {
  const ocr = new Map(ocrPages.map((page) => [page.page, page]));
  return nativePages.map((native) => {
    const ocrPage = ocr.get(native.page); const nativeText = native.text.trim(); const ocrText = ocrPage?.text.trim() ?? '';
    const selectedOcr = nativeText.length < MIN_NATIVE_TEXT_CHARACTERS && ocrText.length > nativeText.length;
    return { ...native, source: selectedOcr ? 'ocr' : 'native', text: selectedOcr ? ocrText : nativeText, nativeText, ocrText: ocrText || undefined };
  });
}

export function createPdfAnalysisProvider(overrides: Partial<PdfAnalysisProvider> = {}, options: PdfAnalysisOptions = {}): PdfAnalysisProvider {
  const geminiStructurer = options.geminiStructurer ?? createGeminiTextStructurer();
  const geminiVisualStructurer = options.geminiVisualStructurer ?? (options.geminiStructurer ? undefined : createGeminiVisualStructurer());
  let structureMetadata: import('./types').StructureMetadata = { provider: 'local-fallback', fallbackReason: 'GEMINI_UNAVAILABLE' };
  const limits = { ...configuredRenderLimits(), ...options.renderLimits };
  const maxPages = Math.max(1, Math.min(50, options.maxPages ?? boundedEnv('MENU_IMPORT_RENDER_MAX_PAGES', DEFAULT_MAX_PAGES, 1, 50)));
  type ProviderStructureOutput = StructuredMenuOutput & { canonicalDocument?: VisualMenuDocument; lineage?: LineageEvent[] };
  const structureDocument = async (pages: PageText[]): Promise<ProviderStructureOutput> => {
    if (geminiVisualStructurer) {
      const visualDocument = await geminiVisualStructurer(pages as VisualPageEvidence[]);
      if (visualDocument) {
        structureMetadata = { provider: 'gemini', model: (geminiVisualStructurer.model || GEMINI_DEFAULT_MODEL).slice(0, 100) };
        return {
          items: flattenVisualDocument(visualDocument, { excludeInvalid: geminiVisualStructurer.architectureStage === 2 }),
          sections: visualDocument.pages.flatMap((page) => page.sections.map((section, sortOrder) => ({ key: `${page.page}:${section.id}`, name: section.title ?? null, sortOrder, source: section.bbox ? { page: page.page, bbox: section.bbox } : { page: page.page }, confidence: section.items.some((item) => item.confidence?.section === 'low') ? 'low' : 'medium' as const }))),
          documentMetadata: { pageCount: visualDocument.pages.length },
          metrics: { analyzerVersion: process.env.MENU_IMPORT_ANALYZER_VERSION || 'menu-import-v4-visual', promptVersion: ANALYZER_PROMPT_VERSION, model: geminiVisualStructurer.model, pageCount: visualDocument.pages.length, retryCount: geminiVisualStructurer.lastRetries?.length ?? 0, suspiciousPages: [...new Set(geminiVisualStructurer.lastSignals?.map((signal) => signal.page) ?? [])] },
          canonicalDocument: visualDocument,
          lineage: geminiVisualStructurer.lastLineage,
        };
      }
      structureMetadata = { provider: 'local-fallback', fallbackReason: (geminiVisualStructurer.lastFallbackReason || 'GEMINI_REQUEST_FAILED').slice(0, 200) };
    }
    const structured = await geminiStructurer(pages);
    if (structured) {
      structureMetadata = { provider: 'gemini', model: (geminiStructurer.model || GEMINI_DEFAULT_MODEL).slice(0, 100) };
      return { items: structured, metrics: { analyzerVersion: process.env.MENU_IMPORT_ANALYZER_VERSION || 'menu-import-v4-visual', promptVersion: ANALYZER_PROMPT_VERSION, model: geminiStructurer.model, pageCount: pages.length, retryCount: geminiStructurer.lastRetries?.length ?? 0 }, lineage: geminiStructurer.lastLineage };
    }
    structureMetadata = { provider: 'local-fallback', fallbackReason: (geminiStructurer.lastFallbackReason || 'GEMINI_REQUEST_FAILED').slice(0, 200) };
    const fallbackRunId = randomUUID();
    const fallbackItems = parseMenuText(pages);
    return { items: fallbackItems, metrics: { analyzerVersion: process.env.MENU_IMPORT_ANALYZER_VERSION || 'menu-import-v4-visual', promptVersion: ANALYZER_PROMPT_VERSION, pageCount: pages.length, fallbackReasons: [structureMetadata.fallbackReason ?? 'GEMINI_REQUEST_FAILED'] }, lineage: fallbackItems.map((item) => ({ id: randomUUID(), analysisRunId: fallbackRunId, page: item.page, candidateId: randomUUID(), sourceKind: 'textual-fallback', stage: 'decode' as const, analyzerVersion: process.env.MENU_IMPORT_ANALYZER_VERSION || 'menu-import-v4-visual', validationStatus: item.extractionStatus, validationReasons: item.reviewReasons?.map((reason) => reason.code) })) };
  };
  return {
    async extractNative(pdf) {
      const { pdfjs, canvas } = await loadNodePdfJs(); const document = await pdfjs.getDocument({ data: pdf }).promise;
      const pages: VisualPageEvidence[] = []; const images: ExtractedImage[] = [];
      for (let index = 1; index <= Math.min(document.numPages, maxPages); index += 1) {
        const page = await document.getPage(index); const content = await page.getTextContent(); const text = textItemsToPageText(content.items);
        let image: VisualAsset | undefined;
        try { image = await renderPdfPage(page as unknown as PdfRenderPage, canvas, limits); } catch { /* Fallback remains reviewable when rendering is unavailable. */ }
        pages.push({ page: index, source: 'native', text, nativeText: text, image });
        await extractEmbeddedImages(page, pdfjs, images, index, options.extractImages === true);
      }
      return { pages, images };
    },
    ocr: configuredOcr,
    structureDocument,
    structure: async (pages) => (await structureDocument(pages)).items,
    getStructureMetadata: () => structureMetadata,
    associateImages: async (items, images) => images.map((_, assetIndex): ImageSuggestion => ({ assetIndex, confidence: 'low', reason: items.length === 1 ? 'Only one candidate item exists; administrator confirmation required' : 'No reliable item-image association from document layout' })),
    ...overrides,
  };
}

export async function analyzePdf(pdf: Uint8Array, provider = createPdfAnalysisProvider()) {
  const native = await provider.extractNative(pdf);
  const visualNative = native.pages as VisualPageEvidence[];
  const weakPages = visualNative.filter((page) => page.text.trim().length < MIN_NATIVE_TEXT_CHARACTERS);
  let ocrPages: PageText[] = [];
  if (weakPages.length) ocrPages = await provider.ocr(pdf).catch(() => []);
  const selectedPages = selectPageEvidence(visualNative, ocrPages);
  const document: PdfDocument = { pages: selectedPages, images: native.images, usedOcr: selectedPages.some((page) => page.source === 'ocr') };
  const structured = (provider.structureDocument ? await provider.structureDocument(document.pages) : { items: await provider.structure(document.pages) }) as StructuredMenuOutput & { canonicalDocument?: VisualMenuDocument; lineage?: LineageEvent[] };
  return { ...structured, images: document.images, suggestions: await provider.associateImages(structured.items, document.images), structureMetadata: provider.getStructureMetadata?.() };
}
