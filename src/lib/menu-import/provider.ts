import type { ExtractedImage, ExtractedMenuItem, ImageSuggestion, PageText, PdfAnalysisProvider, PdfDocument } from './types';

const MIN_NATIVE_TEXT_CHARACTERS = 40;
const PRICE = /(?:\$|USD\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*(?:USD|COP))?\s*$/i;
const CATEGORY = /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ &/\-]{2,}$/;

function ppmFromRgba(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const header = new TextEncoder().encode(`P6\n${width} ${height}\n255\n`);
  const rgb = new Uint8Array(width * height * 3);
  for (let source = 0, target = 0; source < data.length; source += 4) {
    rgb[target++] = data[source]; rgb[target++] = data[source + 1]; rgb[target++] = data[source + 2];
  }
  const output = new Uint8Array(header.length + rgb.length); output.set(header); output.set(rgb, header.length);
  return output;
}

function confidence(value: string | undefined, threshold = 3): 'high' | 'medium' | 'low' {
  if (!value?.trim()) return 'low';
  return value.trim().length >= threshold ? 'high' : 'medium';
}

/** Conservative local parser. It intentionally leaves ambiguous lines for human review. */
export function parseMenuText(pages: PageText[]): ExtractedMenuItem[] {
  const items: ExtractedMenuItem[] = [];
  let category = 'Uncategorized';
  for (const page of pages) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = rawLine.replace(/\s+/g, ' ').trim();
      if (!line) continue;
      if (CATEGORY.test(line) && !PRICE.test(line)) { category = line; continue; }
      const match = line.match(PRICE);
      if (!match) continue;
      const nameAndDescription = line.slice(0, match.index).replace(/[·•\-–—]+\s*$/, '').trim();
      if (nameAndDescription.length < 2) continue;
      const split = nameAndDescription.split(/\s+[–—-]\s+/);
      const name = split.shift()!.trim();
      const description = split.join(' - ').trim() || undefined;
      const price = Number(match[1].replace(',', '.'));
      items.push({
        category, name, description, price: Number.isFinite(price) ? price : undefined, page: page.page,
        confidence: {
          category: category === 'Uncategorized' ? 'low' : 'high', name: confidence(name),
          description: description ? confidence(description, 12) : 'low', price: Number.isFinite(price) ? 'high' : 'low',
        },
      });
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
  return body.pages.map((page) => ({ page: page.page, text: page.text, source: 'ocr' }));
}

export function createPdfAnalysisProvider(overrides: Partial<PdfAnalysisProvider> = {}): PdfAnalysisProvider {
  return {
    async extractNative(pdf) {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const document = await pdfjs.getDocument({ data: pdf }).promise;
      const pages: PageText[] = []; const images: ExtractedImage[] = [];
      for (let index = 1; index <= document.numPages; index += 1) {
        const page = await document.getPage(index);
        const content = await page.getTextContent();
        pages.push({ page: index, source: 'native', text: content.items.map((item) => ('str' in item ? item.str : '')).join(' ') });
        const operatorList = await page.getOperatorList();
        const imageOperator = pdfjs.OPS.paintImageXObject;
        const objectIds = operatorList.argsArray.filter((_, position) => operatorList.fnArray[position] === imageOperator).map((args) => args[0]);
        for (const objectId of objectIds) {
          const image = await new Promise<{ data?: Uint8ClampedArray; width?: number; height?: number } | undefined>((resolve) => {
            page.objs.get(objectId, (value) => resolve(value as { data?: Uint8ClampedArray; width?: number; height?: number }));
          });
          if (image?.data && image.width && image.height) images.push({ page: index, data: ppmFromRgba(image.data, image.width, image.height), mimeType: 'image/x-portable-pixmap', width: image.width, height: image.height });
        }
      }
      return { pages, images };
    },
    ocr: configuredOcr,
    structure: async (document: PdfDocument) => parseMenuText(document.pages),
    associateImages: async (items, images) => images.map((_, assetIndex): ImageSuggestion => ({
      assetIndex, confidence: 'low', reason: items.length === 1 ? 'Only one candidate item exists; administrator confirmation required' : 'No reliable item-image association from document layout',
    })),
    ...overrides,
  };
}

export async function analyzePdf(pdf: Uint8Array, provider = createPdfAnalysisProvider()) {
  const native = await provider.extractNative(pdf);
  const nativeText = native.pages.map((page) => page.text.trim()).join('');
  const ocrPages = nativeText.length < MIN_NATIVE_TEXT_CHARACTERS ? await provider.ocr(pdf) : [];
  const document: PdfDocument = { pages: ocrPages.length ? ocrPages : native.pages, images: native.images, usedOcr: ocrPages.length > 0 };
  const items = await provider.structure(document);
  return { items, images: document.images, suggestions: await provider.associateImages(items, document.images) };
}
