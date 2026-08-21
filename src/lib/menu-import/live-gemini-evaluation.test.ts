import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { analyzePdf, buildGeminiRequestBody, createGeminiVisualStructurer, createPdfAnalysisProvider } from './provider';
import { flattenVisualDocument } from './visual-analysis';
import { ANALYZER_PROMPT_VERSION } from './visual-analysis';
import { liveEvaluationCheckpointKey, readLiveEvaluationCheckpoints, writeLiveEvaluationCheckpoint } from './live-evaluation-checkpoint';
import type { LineageEvent } from './types';
import type { VisualPageEvidence, VisualMenuPage } from './visual-analysis';

const hasGemini = Boolean(process.env.MENU_IMPORT_GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY);
const smokeCanvas = createCanvas(640, 360);
const smokeContext = smokeCanvas.getContext('2d');
smokeContext.fillStyle = '#ffffff'; smokeContext.fillRect(0, 0, 640, 360);
smokeContext.fillStyle = '#000000'; smokeContext.font = '36px Arial';
smokeContext.fillText('SMOKE MENU', 40, 80); smokeContext.font = '30px Arial'; smokeContext.fillText('Soup', 60, 160); smokeContext.fillText('$10', 500, 160);
const smokeJpeg = new Uint8Array(smokeCanvas.toBuffer('image/jpeg', 90));

const smokePage: VisualPageEvidence = {
  page: 1, source: 'native', text: 'OCR evidence must not define boundaries', nativeText: 'OCR evidence must not define boundaries', ocrText: 'OCR evidence must not define boundaries',
  image: { mimeType: 'image/jpeg', data: smokeJpeg, width: 640, height: 360 },
};

describe('live Gemini v4 evaluation', () => {
  it.skipIf(!hasGemini)('runs the v4 visual smoke test and proves lineage gates', async () => {
    let requestBody = '';
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = String(init?.body ?? '');
      try {
        const response = await fetch(input, init);
        if (!response.ok) console.log(JSON.stringify({ smokeHttpStatus: response.status }));
        return response;
      } catch (error) {
        console.log(JSON.stringify({ smokeNetworkError: error instanceof Error ? error.name : 'unknown' }));
        throw error;
      }
    };
    const structurer = createGeminiVisualStructurer({ key: process.env.MENU_IMPORT_GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY, fetch: fetcher, architectureStage: 2, analyzerVersion: 'menu-import-v4-visual', rawRetentionDays: 7 });
    const document = await structurer([smokePage]);
    console.log(JSON.stringify({ smokeFallbackReason: structurer.lastFallbackReason, smokeLineageEvents: structurer.lastLineage?.length ?? 0 }));
    expect(document).toBeTruthy();
    expect(requestBody).toContain('inlineData');
    expect(requestBody).not.toContain('nativeText');
    expect(requestBody).not.toContain('ocrText');
    expect(requestBody).not.toContain('selectedText');
    expect(structurer.lastLineage).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'render', imageIncluded: true }),
      expect.objectContaining({ stage: 'provider_request', model: structurer.model, imageIncluded: true }),
      expect.objectContaining({ stage: 'provider_raw' }),
      expect.objectContaining({ stage: 'decode', itemId: expect.stringMatching(/^[0-9a-f-]{36}$/i) }),
      expect.objectContaining({ stage: 'validation' }),
      expect.objectContaining({ stage: 'reconciliation' }),
      expect.objectContaining({ stage: 'normalization' }),
      expect.objectContaining({ stage: 'projection' }),
    ]));
    const persistedProjection = flattenVisualDocument({ pages: [{ page: 1, sections: [{ id: 'server-section', title: 'SMOKE', items: [{ name: '$30', validation: { status: 'invalid', reasons: ['PRICE_ONLY_NAME'] } }] }] }] });
    expect(persistedProjection).toHaveLength(0);
    console.log(JSON.stringify({ smoke: 'passed', analyzer: 'menu-import-v4-visual', model: structurer.model, lineageEvents: structurer.lastLineage?.length ?? 0 }));
  }, 120_000);

  it.skipIf(!hasGemini)('runs v4 against Menu Subarashii.pdf and prints structural page results', async () => {
    const fixture = resolve(process.cwd(), 'docs/pdf_menu_examples/Menu Subarashii.pdf');
    const pdf = new Uint8Array(readFileSync(fixture));
    const pdfHash = createHash('sha256').update(pdf).digest('hex');
    const requestedPages = (process.env.MENU_IMPORT_LIVE_PAGES || '').split(',').map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
    const pageSelection = requestedPages.length ? new Set(requestedPages) : undefined;
    const checkpointPath = process.env.MENU_IMPORT_LIVE_CHECKPOINT || join(tmpdir(), 'teburu-menu-import-live-checkpoints.json');
    const checkpoints = process.env.MENU_IMPORT_LIVE_RESUME === 'true' ? await readLiveEvaluationCheckpoints(checkpointPath) : [];
    const checkpointMatch = (page: number) => checkpoints.find((entry) => entry.key === liveEvaluationCheckpointKey({ pdfHash, analyzerVersion: 'menu-import-v4-visual', model: 'gemini-3.7-flash', promptVersion: ANALYZER_PROMPT_VERSION, page }));
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const response = await fetch(input, init);
        if (!response.ok) console.log(JSON.stringify({ fixtureHttpStatus: response.status }));
        return response;
      } catch (error) {
        console.log(JSON.stringify({ fixtureNetworkError: error instanceof Error ? error.name : 'unknown' }));
        throw error;
      }
    };
    const visualStructurer = createGeminiVisualStructurer({ key: process.env.MENU_IMPORT_GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY, model: 'gemini-3.7-flash', timeoutMs: 30_000, fetch: fetcher, architectureStage: 2, analyzerVersion: 'menu-import-v4-visual', rawRetentionDays: 7, concurrency: Number(process.env.MENU_IMPORT_GEMINI_CONCURRENCY || 1), minIntervalMs: Number(process.env.MENU_IMPORT_GEMINI_MIN_INTERVAL_MS || 0), maxRateRetries: Number(process.env.MENU_IMPORT_GEMINI_MAX_RATE_RETRIES || 2), onPageComplete: async (page: VisualMenuPage, lineage) => { await writeLiveEvaluationCheckpoint(checkpointPath, { key: liveEvaluationCheckpointKey({ pdfHash, analyzerVersion: 'menu-import-v4-visual', model: 'gemini-3.7-flash', promptVersion: ANALYZER_PROMPT_VERSION, page: page.page }), pdfHash, analyzerVersion: 'menu-import-v4-visual', model: 'gemini-3.7-flash', promptVersion: ANALYZER_PROMPT_VERSION, page: page.page, completedAt: new Date().toISOString(), canonicalResult: page, lineage }); } });
    const baseProvider = createPdfAnalysisProvider({}, { geminiVisualStructurer: visualStructurer });
    const extractNative = baseProvider.extractNative;
    baseProvider.extractNative = async (source) => { const native = await extractNative(source); const pages = native.pages.filter((page) => !pageSelection || pageSelection.has(page.page)).filter((page) => !checkpointMatch(page.page)); return { ...native, pages }; };
    const result = await analyzePdf(pdf, baseProvider);
    const currentPages = (result as typeof result & { canonicalDocument?: { pages: Array<{ page: number; sections: Array<{ title?: string; items: Array<{ name: string; validation?: { status: string }; }> }> }> } }).canonicalDocument?.pages ?? [];
    const resumedPages = checkpoints.filter((entry) => !pageSelection || pageSelection.has(entry.page)).map((entry) => entry.canonicalResult as { page: number; sections: Array<{ title?: string; items: Array<{ name: string; validation?: { status: string }; }> }> });
    const pages = [...new Map([...resumedPages, ...currentPages].map((page) => [page.page, page])).values()].sort((left, right) => left.page - right.page);
    const allLineage: LineageEvent[] = [...checkpoints.filter((entry) => !pageSelection || pageSelection.has(entry.page)).flatMap((entry) => entry.lineage as LineageEvent[]), ...(visualStructurer.lastLineage ?? [])];
    const projectedItems = flattenVisualDocument({ pages } as Parameters<typeof flattenVisualDocument>[0]);
    const outputPages = requestedPages.length ? requestedPages : [2, 3, 4, 5, 6, 9, 19, 20];
    const pageResults = outputPages.map((pageNumber) => {
      const page = pages.find((entry) => entry.page === pageNumber);
      const lineage = allLineage.filter((event) => event.page === pageNumber);
      return { page: pageNumber, requests: lineage.filter((event) => event.stage === 'provider_request').length, providerTransientRetries: lineage.filter((event) => event.sourceKind === 'provider-transient-retry').length, sections: page?.sections.map((section) => section.title ?? '(untitled)') ?? [], itemCount: page?.sections.reduce((sum, section) => sum + section.items.length, 0) ?? 0, items: page?.sections.flatMap((section) => section.items.map((item) => ({ name: item.name, status: item.validation?.status ?? 'unknown' }))) ?? [] };
    });
    console.log(JSON.stringify({ analyzer: 'menu-import-v4-visual', model: result.structureMetadata?.model, fallbackReason: result.structureMetadata?.fallbackReason, failureClass: result.structureMetadata?.failureClass, textualFallbackUsed: result.structureMetadata?.textualFallbackUsed ?? result.lineage?.some((event) => event.sourceKind === 'textual-fallback') ?? false, resumedPages: resumedPages.map((page) => page.page), lineageEvents: allLineage.length, totalPages: pages.length, valid: projectedItems.filter((item) => item.extractionStatus === 'valid').length, review: projectedItems.filter((item) => item.extractionStatus === 'review').length, invalid: pages.flatMap((page) => page.sections.flatMap((section) => section.items)).filter((item) => item.validation?.status === 'invalid').length, retries: allLineage.filter((event) => event.stage === 'retry').length, fallbackUsage: result.structureMetadata?.textualFallbackUsed ?? false, pages: pageResults }));
  }, 600_000);
});

void buildGeminiRequestBody;
