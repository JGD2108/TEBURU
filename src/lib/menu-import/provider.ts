import 'server-only';
import type {
  ExtractedImage,
  ExtractedMenuItem,
  ImageSuggestion,
  PageText,
  PdfAnalysisProvider,
  PdfDocument,
} from './types';


const MIN_NATIVE_TEXT_CHARACTERS = 40;
const PRICE = /(?:\$|USD\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*(?:USD|COP))?\s*$/i;
const CATEGORY = /^[A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00D1][A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00D1 &/\-]{2,}$/;

function ppmFromRgba(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const header = new TextEncoder().encode(`P6\n${width} ${height}\n255\n`);
  const rgb = new Uint8Array(width * height * 3);
  for (let source = 0, target = 0; source < data.length; source += 4) {
    rgb[target++] = data[source];
    rgb[target++] = data[source + 1];
    rgb[target++] = data[source + 2];
  }
  const output = new Uint8Array(header.length + rgb.length);
  output.set(header);
  output.set(rgb, header.length);
  return output;
}

function confidence(value: string | undefined, threshold = 3): 'high' | 'medium' | 'low' {
  if (!value?.trim()) return 'low';
  return value.trim().length >= threshold ? 'high' : 'medium';
}

type NodeCanvasGlobals = { DOMMatrix: unknown; ImageData: unknown; Path2D: unknown };

/**
 * PDF.js uses these browser globals while reading some PDFs. Install the Node
 * implementations before PDF.js is loaded so this works in bundled runtimes
 * where PDF.js cannot dynamically require its optional canvas dependency.
 */
export function installNodeCanvasGlobals(canvas: NodeCanvasGlobals) {
  const target = globalThis as Record<string, unknown>;
  if (!target.DOMMatrix) target.DOMMatrix = canvas.DOMMatrix;
  if (!target.ImageData) target.ImageData = canvas.ImageData;
  if (!target.Path2D) target.Path2D = canvas.Path2D;
}

/**
 * PDF.js otherwise imports `workerSrc` at runtime for its Node fake worker.
 * That relative path is not emitted beside the bundled server chunk on Vercel.
 */
export function installPdfJsWorkerHandler(worker: { WorkerMessageHandler: unknown }) {
  const target = globalThis as typeof globalThis & { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
  if (!target.pdfjsWorker?.WorkerMessageHandler) {
    target.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
  }
}

async function loadNodePdfJs() {
  const canvas = await import('@napi-rs/canvas');
  installNodeCanvasGlobals(canvas);
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  installPdfJsWorkerHandler(worker);
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

export type PdfAnalysisOptions = {
  /** Disabled in production until durable image storage/conversion is available. */
  extractImages?: boolean;
  geminiStructurer?: GeminiTextStructurer;
};

const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
const GEMINI_DEFAULT_TIMEOUT_MS = 8_000;
const GEMINI_MAX_CHUNK_CHARS = 24_000;
const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low']);

export type GeminiTextStructurer = ((pages: PageText[]) => Promise<ExtractedMenuItem[] | undefined>) & { lastFallbackReason?: string; model?: string };
export type GeminiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type GeminiConfig = { key?: string; model?: string; timeoutMs?: number; fetch?: GeminiFetch };

function serverGeminiConfig(): GeminiConfig {
  const rawTimeout = Number(process.env.MENU_IMPORT_GEMINI_TIMEOUT_MS);
  return {
    key: process.env.MENU_IMPORT_GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY,
    model: process.env.MENU_IMPORT_GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    timeoutMs: Number.isFinite(rawTimeout) ? Math.min(30_000, Math.max(1_000, rawTimeout)) : GEMINI_DEFAULT_TIMEOUT_MS,
  };
}

export function chunkGeminiPages(pages: PageText[]) {
  const chunks: PageText[][] = [];
  let chunk: PageText[] = [];
  let size = 0;
  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;
    const bounded = { ...page, text: text.slice(0, GEMINI_MAX_CHUNK_CHARS) };
    if (chunk.length && size + bounded.text.length > GEMINI_MAX_CHUNK_CHARS) {
      chunks.push(chunk); chunk = []; size = 0;
    }
    chunk.push(bounded); size += bounded.text.length;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

export function buildGeminiRequestBody(pages: PageText[]) {
  return {
    contents: [{ role: 'user', parts: [{ text: `Extract menu items only from these page-numbered text records. Do not infer missing prices or pages.\n${JSON.stringify(pages.map(({ page, text }) => ({ page, text })))} ` }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object', additionalProperties: false, required: ['items'], properties: {
          items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['category', 'name', 'page', 'confidence'], properties: {
            category: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, price: { type: 'number', minimum: 0 }, page: { type: 'integer' },
            confidence: { type: 'object', additionalProperties: false, required: ['category', 'name', 'description', 'price'], properties: { category: { type: 'string', enum: ['high', 'medium', 'low'] }, name: { type: 'string', enum: ['high', 'medium', 'low'] }, description: { type: 'string', enum: ['high', 'medium', 'low'] }, price: { type: 'string', enum: ['high', 'medium', 'low'] } } },
          } } },
        },
      },
    },
  };
}

export function decodeGeminiItems(value: unknown, pages: PageText[]): ExtractedMenuItem[] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const root = value as { items?: unknown };
  if (!Array.isArray(root.items)) return undefined;
  const validPages = new Set(pages.map((page) => page.page));
  const items: ExtractedMenuItem[] = [];
  for (const value of root.items) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const item = value as Record<string, unknown>;
    const allowed = new Set(['category', 'name', 'description', 'price', 'page', 'confidence']);
    if (Object.keys(item).some((key) => !allowed.has(key))) return undefined;
    const page = item.page;
    if (typeof item.name !== 'string' || !item.name.trim() || typeof item.category !== 'string' || !item.category.trim() || typeof page !== 'number' || !Number.isInteger(page) || !validPages.has(page)) return undefined;
    if (item.description !== undefined && typeof item.description !== 'string') return undefined;
    if (item.price !== undefined && (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0)) return undefined;
    const confidence = item.confidence as Record<string, unknown> | null;
    if (!confidence || typeof confidence !== 'object' || ['category', 'name', 'description', 'price'].some((key) => !CONFIDENCE_VALUES.has(confidence[key] as string))) return undefined;
    const price = item.price as number | undefined;
    items.push({ category: item.category.trim(), name: item.name.trim(), description: item.description?.trim() || undefined, price, page, confidence: confidence as ExtractedMenuItem['confidence'] });
  }
  return items;
}

export function createGeminiTextStructurer(config: GeminiConfig = serverGeminiConfig()): GeminiTextStructurer {
  const structurer: GeminiTextStructurer = async (pages) => {
    structurer.lastFallbackReason = undefined;
    structurer.model = config.model ?? GEMINI_DEFAULT_MODEL;
    if (!config.key) { structurer.lastFallbackReason = 'GEMINI_NOT_CONFIGURED'; return undefined; }
    if (!pages.some((page) => page.text.trim())) { structurer.lastFallbackReason = 'GEMINI_NO_TEXT'; return undefined; }
    const fetcher = config.fetch ?? fetch;
    const items: ExtractedMenuItem[] = [];
    try {
      for (const chunk of chunkGeminiPages(pages)) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? GEMINI_DEFAULT_TIMEOUT_MS);
        try {
          const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model ?? GEMINI_DEFAULT_MODEL)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': config.key }, body: JSON.stringify(buildGeminiRequestBody(chunk)), signal: controller.signal });
          if (!response.ok) { structurer.lastFallbackReason = response.status === 429 ? 'GEMINI_RATE_LIMITED' : 'GEMINI_REQUEST_FAILED'; return undefined; }
          const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text !== 'string') { structurer.lastFallbackReason = 'GEMINI_INVALID_RESPONSE'; return undefined; }
          let decoded: ExtractedMenuItem[] | undefined;
          try { decoded = decodeGeminiItems(JSON.parse(text), chunk); } catch { decoded = undefined; }
          if (!decoded) { structurer.lastFallbackReason = 'GEMINI_INVALID_RESPONSE'; return undefined; }
          items.push(...decoded);
        } finally { clearTimeout(timer); }
      }
      return items;
    } catch (error) { structurer.lastFallbackReason = error instanceof DOMException && error.name === 'AbortError' ? 'GEMINI_TIMEOUT' : 'GEMINI_REQUEST_FAILED'; return undefined; }
  };
  return structurer;
}

type PdfImagePage = {
  getOperatorList: () => Promise<{ argsArray: unknown[][]; fnArray: number[] }>;
  objs: { get: (id: string, callback?: (value: unknown) => void) => unknown };
};

type PdfJsOperators = { OPS: { paintImageXObject: number } };

/**
 * Embedded image extraction can be expensive on image-heavy PDFs. Keep it
 * opt-in until the production asset pipeline can safely persist its output.
 */
export async function extractEmbeddedImages(
  page: PdfImagePage,
  pdfjs: PdfJsOperators,
  images: ExtractedImage[],
  pageNumber: number,
  enabled = false,
) {
  if (!enabled) return;
  try {
    const operatorList = await page.getOperatorList();
    const imageOperator = pdfjs.OPS.paintImageXObject;
    const objectIds = operatorList.argsArray
      .filter((_, position) => operatorList.fnArray[position] === imageOperator)
      .map((args) => args[0]);

    for (const objectId of objectIds) {
      const image = await new Promise<{ data?: Uint8ClampedArray; width?: number; height?: number } | undefined>((resolve) => {
        page.objs.get(String(objectId), (value: unknown) => {
          resolve(value as { data?: Uint8ClampedArray; width?: number; height?: number });
        });
      });
      if (image?.data && image.width && image.height) {
        images.push({
          page: pageNumber,
          data: ppmFromRgba(image.data, image.width, image.height),
          mimeType: 'image/x-portable-pixmap',
          width: image.width,
          height: image.height,
        });
      }
    }
  } catch {
    // Image extraction is optional; retain text analysis on any asset failure.
  }
}

export function textItemsToPageText(items: object[]) {
  return items.map((item) => {
    const textItem = item as { str?: unknown; hasEOL?: unknown };
    const text = typeof textItem.str === 'string' ? textItem.str : '';
    return `${text}${textItem.hasEOL ? '\n' : ' '}`;
  }).join('').trim();
}

/** Conservative local parser. It intentionally leaves ambiguous lines for human review. */
export function parseMenuText(pages: PageText[]): ExtractedMenuItem[] {
  const items: ExtractedMenuItem[] = [];
  let category = 'Uncategorized';
  for (const page of pages) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = rawLine.replace(/\s+/g, ' ').trim();
      if (!line) continue;
      if (CATEGORY.test(line) && !PRICE.test(line)) {
        category = line;
        continue;
      }
      const match = line.match(PRICE);
      if (!match) continue;
      const nameAndDescription = line.slice(0, match.index).replace(/[.\u00B7\u2022\-\u2013\u2014]+\s*$/, '').trim();
      if (nameAndDescription.length < 2) continue;
      const split = nameAndDescription.split(/\s+[\u2013\u2014-]\s+/);
      const name = split.shift()!.trim();
      const description = split.join(' - ').trim() || undefined;
      const price = Number(match[1].replace(',', '.'));
      items.push({
        category,
        name,
        description,
        price: Number.isFinite(price) ? price : undefined,
        page: page.page,
        confidence: {
          category: category === 'Uncategorized' ? 'low' : 'high',
          name: confidence(name),
          description: description ? confidence(description, 12) : 'low',
          price: Number.isFinite(price) ? 'high' : 'low',
        },
      });
    }
  }
  return items;
}

async function configuredOcr(pdf: Uint8Array): Promise<PageText[]> {
  const endpoint = process.env.MENU_IMPORT_OCR_ENDPOINT;
  if (!endpoint) throw new Error('OCR is required but MENU_IMPORT_OCR_ENDPOINT is not configured');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/pdf' },
    body: pdf as unknown as BodyInit,
  });
  if (!response.ok) throw new Error(`OCR provider failed (${response.status})`);
  const body = await response.json() as { pages?: Array<{ page: number; text: string }> };
  if (!Array.isArray(body.pages)) throw new Error('OCR provider returned an invalid response');
  return body.pages.map((page) => ({ page: page.page, text: page.text, source: 'ocr' }));
}

export function createPdfAnalysisProvider(
  overrides: Partial<PdfAnalysisProvider> = {},
  options: PdfAnalysisOptions = {},
): PdfAnalysisProvider {
  const geminiStructurer = options.geminiStructurer ?? createGeminiTextStructurer();
  let structureMetadata: import('./types').StructureMetadata = { provider: 'local-fallback', fallbackReason: 'GEMINI_UNAVAILABLE' };
  return {
    async extractNative(pdf) {
      const pdfjs = await loadNodePdfJs();
      const document = await pdfjs.getDocument({ data: pdf }).promise;
      const pages: PageText[] = [];
      const images: ExtractedImage[] = [];

      for (let index = 1; index <= document.numPages; index += 1) {
        const page = await document.getPage(index);
        const content = await page.getTextContent();
        pages.push({
          page: index,
          source: 'native',
          text: textItemsToPageText(content.items),
        });
        await extractEmbeddedImages(page, pdfjs, images, index, options.extractImages === true);
      }

      return { pages, images };
    },
    ocr: configuredOcr,
    structure: async (pages: PageText[]) => {
      const structured = await geminiStructurer(pages);
      if (structured) {
        structureMetadata = { provider: 'gemini', model: (geminiStructurer.model || process.env.MENU_IMPORT_GEMINI_MODEL || GEMINI_DEFAULT_MODEL).slice(0, 100) };
        return structured;
      }
      structureMetadata = { provider: 'local-fallback', fallbackReason: (geminiStructurer.lastFallbackReason || 'GEMINI_REQUEST_FAILED').slice(0, 200) };
      return parseMenuText(pages);
    },
    getStructureMetadata: () => structureMetadata,
    associateImages: async (items, images) =>
      images.map((_, assetIndex): ImageSuggestion => ({
        assetIndex,
        confidence: 'low',
        reason:
          items.length === 1
            ? 'Only one candidate item exists; administrator confirmation required'
            : 'No reliable item-image association from document layout',
      })),
    ...overrides,
  };
}

export async function analyzePdf(pdf: Uint8Array, provider = createPdfAnalysisProvider()) {
  const native = await provider.extractNative(pdf);
  const nativeText = native.pages.map((page) => page.text.trim()).join('');
  const ocrPages = nativeText.length < MIN_NATIVE_TEXT_CHARACTERS ? await provider.ocr(pdf) : [];
  const document: PdfDocument = {
    pages: ocrPages.length ? ocrPages : native.pages,
    images: native.images,
    usedOcr: ocrPages.length > 0,
  };
  const items = await provider.structure(document.pages);
  return {
    items,
    images: document.images,
    suggestions: await provider.associateImages(items, document.images),
    structureMetadata: provider.getStructureMetadata?.(),
  };
}
