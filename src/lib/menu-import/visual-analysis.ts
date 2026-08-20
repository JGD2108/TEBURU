import type { Confidence, ExtractedMenuItem, PageText } from './types';

export const ANALYZER_PROMPT_VERSION = 'menu-import-visual-v1';
export const MAX_PAGE_RETRIES = 2;

export type NormalizedBox = { x: number; y: number; width: number; height: number };
export type VisualAsset = { mimeType: 'image/jpeg' | 'image/png'; data: Uint8Array; width: number; height: number };
export type VisualPageEvidence = PageText & {
  image?: VisualAsset;
  nativeText?: string;
  ocrText?: string;
};

export type ObservedPrice = {
  raw?: string;
  amount?: number | null;
  currency?: string | null;
  label?: string;
  shared?: boolean;
};

export type VisualMenuItem = {
  name: string;
  description?: string;
  rawPrice?: string;
  price?: ObservedPrice;
  variants?: ObservedPrice[];
  modifiers?: string[];
  options?: string[];
  attributes?: string[];
  bbox?: NormalizedBox;
  confidence?: Partial<Record<'name' | 'description' | 'price' | 'section', Confidence>>;
  reviewReasons?: string[];
};

export type VisualSection = {
  id: string;
  title?: string;
  parentId?: string;
  bbox?: NormalizedBox;
  continuationOf?: string;
  items: VisualMenuItem[];
};

export type VisualMenuPage = {
  page: number;
  sections: VisualSection[];
  metadata?: Record<string, string>;
  decorative?: string[];
};

export type VisualMenuDocument = {
  metadata?: Record<string, string>;
  pages: VisualMenuPage[];
  globalPriceNotes?: string[];
};

export type ValidationSignal = {
  code:
    | 'MERGED_NAME'
    | 'PRICE_ONLY_NAME'
    | 'MULTIPLE_PRICES_IN_NAME'
    | 'INVALID_PAGE_REFERENCE'
    | 'SUSPICIOUS_CATEGORY'
    | 'DECORATIVE_CONTENT'
    | 'SPARSE_PAGE_INCONSISTENCY'
    | 'INVALID_BBOX'
    | 'RECONCILIATION_CONFLICT';
  severity: 'error' | 'warning';
  page: number;
  sectionId?: string;
  itemName?: string;
};

export type PageOutcome = 'accepted' | 'retry' | 'manual_review';
export type RetryInstruction = { page: number; reason: ValidationSignal['code']; region?: NormalizedBox };

const PRICE_TOKEN = /(?:[$€£]|\b(?:usd|cop|eur|mxn)\b\s*)?\d{1,6}(?:[.,]\d{1,2})?(?:\s*(?:usd|cop|eur|mxn))?/gi;
const PRICE_ONLY = /^(?:[$€£]|\b(?:usd|cop|eur|mxn)\b\s*)?\d{1,6}(?:[.,]\d{1,2})?(?:\s*(?:usd|cop|eur|mxn))?$/i;
const DECORATIVE = /(?:https?:\/\/|www\.|@\w+|follow\s+us|thank\s+you|bienvenid[oa]|contact(?:o| us)?|tel(?:ephone)?\s*:)/i;
const SUSPICIOUS_SECTION = /^(?:menu|welcome|bienvenid[oa]|thank\s+you|follow\s+us|contact(?:o| us)?)$/i;

export function isNormalizedBox(value: unknown): value is NormalizedBox {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const box = value as Record<string, unknown>;
  const x = box.x;
  const y = box.y;
  const width = box.width;
  const height = box.height;
  return [x, y, width, height].every((value) => typeof value === 'number' && Number.isFinite(value))
    && (x as number) >= 0 && (y as number) >= 0 && (width as number) > 0 && (height as number) > 0
    && (x as number) + (width as number) <= 1 && (y as number) + (height as number) <= 1;
}

function nameSignals(page: number, section: VisualSection, item: VisualMenuItem): ValidationSignal[] {
  const name = item.name.trim();
  const signals: ValidationSignal[] = [];
  const prices = name.match(PRICE_TOKEN) ?? [];
  if (PRICE_ONLY.test(name)) signals.push({ code: 'PRICE_ONLY_NAME', severity: 'error', page, sectionId: section.id, itemName: name });
  if (prices.length > 1) signals.push({ code: 'MULTIPLE_PRICES_IN_NAME', severity: 'error', page, sectionId: section.id, itemName: name });
  if ((/\s(?:\/|\||;|•)\s/.test(name) || /\b(?:and|y)\b/i.test(name)) && name.length > 36) {
    signals.push({ code: 'MERGED_NAME', severity: 'warning', page, sectionId: section.id, itemName: name });
  }
  if (DECORATIVE.test(name)) signals.push({ code: 'DECORATIVE_CONTENT', severity: 'error', page, sectionId: section.id, itemName: name });
  if (item.bbox && !isNormalizedBox(item.bbox)) signals.push({ code: 'INVALID_BBOX', severity: 'error', page, sectionId: section.id, itemName: name });
  return signals;
}

/** Deterministic checks intentionally inspect evidence, never infer menu content. */
export function validateVisualDocument(document: VisualMenuDocument, evidence: VisualPageEvidence[]): ValidationSignal[] {
  const expectedPages = new Set(evidence.map((page) => page.page));
  const signals: ValidationSignal[] = [];
  for (const page of document.pages) {
    if (!expectedPages.has(page.page)) {
      signals.push({ code: 'INVALID_PAGE_REFERENCE', severity: 'error', page: page.page });
      continue;
    }
    const pageEvidence = evidence.find((entry) => entry.page === page.page);
    const itemCount = page.sections.reduce((total, section) => total + section.items.length, 0);
    if ((pageEvidence?.text.trim().length ?? 0) >= 80 && itemCount === 0) {
      signals.push({ code: 'SPARSE_PAGE_INCONSISTENCY', severity: 'warning', page: page.page });
    }
    for (const section of page.sections) {
      if (section.bbox && !isNormalizedBox(section.bbox)) signals.push({ code: 'INVALID_BBOX', severity: 'error', page: page.page, sectionId: section.id });
      if (!section.title?.trim() || SUSPICIOUS_SECTION.test(section.title.trim()) || DECORATIVE.test(section.title)) {
        signals.push({ code: 'SUSPICIOUS_CATEGORY', severity: 'warning', page: page.page, sectionId: section.id });
      }
      if (section.title && DECORATIVE.test(section.title)) signals.push({ code: 'DECORATIVE_CONTENT', severity: 'error', page: page.page, sectionId: section.id });
      for (const item of section.items) signals.push(...nameSignals(page.page, section, item));
    }
  }
  return signals;
}

export function outcomeForPage(signals: ValidationSignal[], modelConfidence: Confidence | undefined, attempt: number): PageOutcome {
  if (signals.some((signal) => signal.severity === 'error')) return attempt < MAX_PAGE_RETRIES ? 'retry' : 'manual_review';
  if (signals.length || modelConfidence === 'low') return 'manual_review';
  return 'accepted';
}

export function retryInstructions(signals: ValidationSignal[], attempt: number): RetryInstruction[] {
  if (attempt >= MAX_PAGE_RETRIES) return [];
  const instructions: RetryInstruction[] = [];
  for (const signal of signals) {
    if (signal.severity !== 'error' && signal.code !== 'MERGED_NAME' && signal.code !== 'SPARSE_PAGE_INCONSISTENCY') continue;
    if (!instructions.some((entry) => entry.page === signal.page && entry.reason === signal.code)) {
      instructions.push({ page: signal.page, reason: signal.code });
    }
  }
  return instructions;
}

export function difficultRegions(page: VisualPageEvidence, signals: ValidationSignal[]): NormalizedBox[] {
  if (!signals.some((signal) => signal.page === page.page)) return [];
  // Two stable halves preserve enough surrounding alignment while bounding retry payloads.
  return [{ x: 0, y: 0, width: 0.5, height: 1 }, { x: 0.5, y: 0, width: 0.5, height: 1 }];
}

function sameItem(left: VisualMenuItem, right: VisualMenuItem) {
  return left.name.trim().toLocaleLowerCase() === right.name.trim().toLocaleLowerCase()
    && (left.description ?? '').trim().toLocaleLowerCase() === (right.description ?? '').trim().toLocaleLowerCase()
    && (left.rawPrice ?? left.price?.raw ?? '') === (right.rawPrice ?? right.price?.raw ?? '');
}

/** Reconciles only source-equivalent candidates; same names in different sections/pages survive. */
export function reconcileVisualDocument(document: VisualMenuDocument): { document: VisualMenuDocument; signals: ValidationSignal[] } {
  const signals: ValidationSignal[] = [];
  const sections = new Map<string, VisualSection>();
  const pages: VisualMenuPage[] = [];
  let previousSection: VisualSection | undefined;
  for (const page of [...document.pages].sort((a, b) => a.page - b.page)) {
    const nextSections: VisualSection[] = [];
    for (const section of page.sections) {
      const key = `${page.page}:${section.id}`;
      const copy = { ...section, items: [...section.items] };
      if (!copy.title?.trim() && previousSection && copy.continuationOf === previousSection.id) {
        copy.title = previousSection.title;
      } else if (!copy.title?.trim() && copy.items.length) {
        signals.push({ code: 'RECONCILIATION_CONFLICT', severity: 'warning', page: page.page, sectionId: copy.id });
      }
      const existing = sections.get(key);
      if (existing) {
        copy.items = copy.items.filter((item) => !existing.items.some((candidate) => sameItem(candidate, item)));
      }
      sections.set(key, copy);
      nextSections.push(copy);
      if (copy.title?.trim()) previousSection = copy;
    }
    pages.push({ ...page, sections: nextSections });
  }
  return { document: { ...document, pages }, signals };
}

export function flattenVisualDocument(document: VisualMenuDocument): ExtractedMenuItem[] {
  const items: ExtractedMenuItem[] = [];
  for (const page of document.pages) {
    for (const section of page.sections) {
      for (const item of section.items) {
        const price = item.price?.amount ?? (item.variants?.length === 1 ? item.variants[0].amount ?? undefined : undefined);
        items.push({
          category: section.title?.trim() ?? '',
          name: item.name.trim(),
          description: item.description?.trim() || undefined,
          ingredients: item.attributes?.map((attribute) => attribute.trim()).filter(Boolean),
          price: typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : undefined,
          page: page.page,
          confidence: {
            category: item.confidence?.section ?? (section.title?.trim() ? 'medium' : 'low'),
            name: item.confidence?.name ?? 'medium',
            description: item.confidence?.description ?? 'low',
            price: item.confidence?.price ?? (typeof price === 'number' ? 'medium' : 'low'),
          },
        });
      }
    }
  }
  return items;
}
