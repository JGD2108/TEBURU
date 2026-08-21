import 'server-only';

import { contentHash, createMenuImportIdFactory, sanitizeLineageEvent } from '../lineage';
import {
  TEXT_DOCUMENT_SERIALIZER_VERSION,
  TEXT_ONLY_API_VERSION,
  TEXT_ONLY_DEFAULT_MODEL,
  TEXT_ONLY_MAX_OUTPUT_TOKENS,
  TEXT_ONLY_PROMPT_VERSION,
  TEXT_ONLY_SCHEMA_VERSION,
  TEXT_ONLY_TIMEOUT_MS,
  TextOnlyRequestBudget,
  adaptTextMenuDocument,
  applyTextValidation,
  buildTextOnlyRequest,
  decodeTextMenuDocument,
  extractTextDocument,
  preflightTextDocument,
  reconcileTextDocument,
  serializeTextDocument,
  textMetrics,
  validateTextStructure,
  type TextCanonicalDocument,
  type TextDocument,
  type TextMetrics,
  type TextPreflight,
  type TextStructuralValidation,
} from '../text-only-evaluation';
import type {
  AnalysisMetrics,
  AnalysisResult,
  Confidence,
  ExtractedMenuItem,
  ExtractedSection,
  LineageEvent,
} from '../types';

export const V5_TEXT_ANALYZER_VERSION = 'menu-import-v5-text';
export const V5_TEXT_DEFAULT_MODEL = TEXT_ONLY_DEFAULT_MODEL;
export const V5_TEXT_TIMEOUT_MS = TEXT_ONLY_TIMEOUT_MS;
export const V5_TEXT_MAX_OUTPUT_TOKENS = TEXT_ONLY_MAX_OUTPUT_TOKENS;
export const V5_TEXT_API_VERSION = TEXT_ONLY_API_VERSION;
export const V5_TEXT_SERIALIZER_VERSION = TEXT_DOCUMENT_SERIALIZER_VERSION;
export type { TextDocument } from '../text-only-evaluation';

type GeminiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type JsonRecord = Record<string, unknown>;

export type V5TextFailureCode =
  | 'INVALID_ANALYSIS_INPUT'
  | 'PDF_TEXT_EXTRACTION_FAILED'
  | 'TEXT_NOT_EVALUABLE'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_REQUEST_REJECTED'
  | 'MALFORMED_PROVIDER_RESPONSE'
  | 'OUTPUT_TRUNCATED'
  | 'STRUCTURAL_VALIDATION_FAILED'
  | 'DTO_DECODE_FAILED';

export type V5TextFailure = {
  code: V5TextFailureCode;
  retryable: boolean;
  httpStatus?: number;
  message: string;
};

export type V5TextAnalysisInput = {
  restaurantId: string;
  /** Stored PDF bytes. These are consumed only by PDF.js native text extraction. */
  pdf?: Uint8Array;
  /** Test-only/native-extraction boundary injection; never sent to Gemini as an object. */
  textDocument?: TextDocument;
  apiKey?: string;
  model?: string;
  attemptId?: string;
  fetcher?: GeminiFetch;
};

export type V5TextSuccess = {
  kind: 'success';
  restaurantId: string;
  attemptId: string;
  preflight: TextPreflight;
  structural: TextStructuralValidation;
  /** Valid and review candidates only. Invalid candidates remain outside normal drafts. */
  analysis: AnalysisResult;
  invalidCandidates: ExtractedMenuItem[];
};

export type V5TextFailureResult = {
  kind: 'failure';
  restaurantId: string;
  attemptId: string;
  preflight?: TextPreflight;
  structural?: TextStructuralValidation;
  analysis: AnalysisResult;
  failure: V5TextFailure;
};

export type V5TextAnalysisOutcome = V5TextSuccess | V5TextFailureResult;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function configuredModel(value?: string): string {
  const model = (value ?? process.env.MENU_IMPORT_TEXT_ONLY_GEMINI_MODEL ?? V5_TEXT_DEFAULT_MODEL).trim();
  if (!model) throw new Error('V5_TEXT_MODEL_INVALID');
  return model;
}

function endpoint(model: string) {
  return `https://generativelanguage.googleapis.com/${V5_TEXT_API_VERSION}/models/${model}:generateContent`;
}

function outputTruncated(finishReason?: string) {
  return /max_tokens|length|truncat/i.test(finishReason ?? '');
}

function sanitizedFailureMessage(code: V5TextFailureCode) {
  return `V5_TEXT_${code}`;
}

function extractionLineage(input: {
  attemptId: string;
  preflight: TextPreflight;
  model: string;
}): LineageEvent {
  const { attemptId, preflight, model } = input;
  const ids = createMenuImportIdFactory();
  return sanitizeLineageEvent({
    id: ids.event(),
    attemptId,
    analyzerVersion: V5_TEXT_ANALYZER_VERSION,
    sourceKind: 'unknown',
    stage: 'normalization',
    model,
    metadata: {
      evidenceAuthority: 'native-text',
      inputKind: 'native_pdf_text',
      fallbackUsage: 'none',
      pdfSha256: preflight.pdfSha256,
      textDocumentHash: preflight.textDocumentHash,
      serializerVersion: preflight.serializerVersion,
      promptVersion: TEXT_ONLY_PROMPT_VERSION,
      schemaVersion: TEXT_ONLY_SCHEMA_VERSION,
      pdfPages: preflight.pdfPages,
      textDocumentPages: preflight.textDocumentPages,
      textCharacters: preflight.textCharacters,
      estimatedInputTokens: preflight.estimatedInputTokens,
    },
  });
}

function requestLineage(attemptId: string, model: string): LineageEvent {
  const ids = createMenuImportIdFactory();
  return sanitizeLineageEvent({
    id: ids.event(),
    attemptId,
    analyzerVersion: V5_TEXT_ANALYZER_VERSION,
    sourceKind: 'unknown',
    stage: 'provider_request',
    model,
    metadata: {
      evidenceAuthority: 'native-text',
      apiVersion: V5_TEXT_API_VERSION,
      maxOutputTokens: V5_TEXT_MAX_OUTPUT_TOKENS,
      timeoutMs: V5_TEXT_TIMEOUT_MS,
      requestBudget: 1,
      fallbackUsage: 'none',
    },
  });
}

function terminalLineage(input: {
  attemptId: string;
  model: string;
  stage: LineageEvent['stage'];
  failure?: V5TextFailure;
  rawPayloadHash?: string;
  metadata?: Record<string, unknown>;
}): LineageEvent {
  const ids = createMenuImportIdFactory();
  return sanitizeLineageEvent({
    id: ids.event(),
    attemptId: input.attemptId,
    analyzerVersion: V5_TEXT_ANALYZER_VERSION,
    sourceKind: 'unknown',
    stage: input.stage,
    model: input.model,
    latencyMs: number(input.metadata?.latencyMs),
    inputTokens: number(input.metadata?.inputTokens),
    outputTokens: number(input.metadata?.outputTokens),
    rawPayloadHash: input.rawPayloadHash,
    metadata: {
      evidenceAuthority: 'native-text',
      fallbackUsage: 'none',
      outcome: input.failure?.code ?? 'ACCEPTED',
      retryable: input.failure?.retryable ?? false,
      httpStatus: input.failure?.httpStatus,
      ...input.metadata,
    },
  });
}

function emptyAnalysis(lineage: LineageEvent[], providerCalls = 0): AnalysisResult {
  return {
    items: [],
    images: [],
    suggestions: [],
    sections: [],
    lineage,
    metrics: { analyzerVersion: V5_TEXT_ANALYZER_VERSION, providerCalls, fallbackUsage: 0, textualSourceRate: 1, visualSourceRate: 0 },
    structureMetadata: { provider: 'gemini', textualFallbackUsed: false },
  };
}

function failureOutcome(input: {
  restaurantId: string;
  attemptId: string;
  model: string;
  lineage: LineageEvent[];
  code: V5TextFailureCode;
  retryable: boolean;
  httpStatus?: number;
  preflight?: TextPreflight;
  structural?: TextStructuralValidation;
  metadata?: Record<string, unknown>;
}): V5TextFailureResult {
  const failure: V5TextFailure = {
    code: input.code,
    retryable: input.retryable,
    httpStatus: input.httpStatus,
    message: sanitizedFailureMessage(input.code),
  };
  const lineage = [...input.lineage, terminalLineage({
    attemptId: input.attemptId,
    model: input.model,
    stage: input.code === 'STRUCTURAL_VALIDATION_FAILED' ? 'validation' : 'decode',
    failure,
    metadata: input.metadata,
  })];
  return {
    kind: 'failure',
    restaurantId: input.restaurantId,
    attemptId: input.attemptId,
    preflight: input.preflight,
    structural: input.structural,
    analysis: emptyAnalysis(lineage, number(input.metadata?.requestCount) ?? 0),
    failure,
  };
}

/** Production V5 native extraction. It has no page renderer, OCR, image, or provider fallback path. */
export async function extractV5NativeText(pdf: Uint8Array): Promise<TextDocument> {
  return extractTextDocument(pdf);
}

/** Deterministic, safe native-text evidence intended for diagnostics, never provider input. */
export function describeV5NativeText(document: TextDocument, pdf?: Uint8Array): TextPreflight {
  return preflightTextDocument(document, { pdf, expectedPages: document.pages.length });
}

/** This remains separately exported so callers can prove the exact page/item serialization before authorizing a request. */
export function serializeV5NativeText(document: TextDocument) {
  return serializeTextDocument(document);
}

function confidenceFor(status: 'valid' | 'review' | 'invalid', kind: 'category' | 'name' | 'description' | 'price', explicitSection: boolean, ambiguousPrice: boolean): Confidence {
  if (kind === 'category') return explicitSection ? 'high' : 'low';
  if (kind === 'price' && ambiguousPrice) return 'low';
  if (status === 'valid') return kind === 'description' ? 'medium' : 'high';
  return status === 'invalid' ? 'low' : 'medium';
}

function projectCanonical(document: TextCanonicalDocument): { sections: ExtractedSection[]; normalCandidates: ExtractedMenuItem[]; invalidCandidates: ExtractedMenuItem[] } {
  const sections: ExtractedSection[] = [];
  const normalCandidates: ExtractedMenuItem[] = [];
  const invalidCandidates: ExtractedMenuItem[] = [];
  let sortOrder = 0;
  for (const page of document.pages) {
    for (const section of page.sections) {
      // A carried heading is useful category evidence, but is weaker than a
      // heading returned on this page. `continuationOf` is set only by the
      // adjacent-page reconciliation step.
      const explicitSection = Boolean(section.title?.trim()) && !section.continuationOf;
      sections.push({
        key: section.id,
        name: section.title ?? null,
        parentKey: section.continuationOf,
        sortOrder: sortOrder++,
        source: { page: page.page },
        confidence: explicitSection ? 'high' : 'low',
        reviewReasons: explicitSection ? undefined : [{ code: 'MISSING_SECTION' }],
      });
      for (const item of section.items) {
        const status = item.validation?.status ?? 'review';
        const ambiguousPrice = item.priceAssociation === 'ambiguous';
        const reasons = item.validation?.reasons.map((code) => ({ code }));
        const candidate: ExtractedMenuItem = {
          itemId: item.itemId,
          candidateId: item.candidateId,
          extractionStatus: status,
          category: section.title ?? null,
          sectionKey: section.id,
          name: item.name,
          rawName: item.name,
          description: item.description,
          price: ambiguousPrice ? undefined : item.price?.amount ?? undefined,
          rawPrice: item.rawPrice ?? null,
          currency: item.price?.currency ?? null,
          priceVariants: item.variants,
          page: page.page,
          source: { page: page.page },
          confidence: {
            category: confidenceFor(status, 'category', explicitSection, ambiguousPrice),
            name: confidenceFor(status, 'name', explicitSection, ambiguousPrice),
            description: confidenceFor(status, 'description', explicitSection, ambiguousPrice),
            price: confidenceFor(status, 'price', explicitSection, ambiguousPrice),
          },
          reviewReasons: reasons,
          validationSignals: item.validation?.reasons.map((code) => ({
            code,
            severity: status === 'invalid' ? 'error' : 'warning',
          })),
        };
        (status === 'invalid' ? invalidCandidates : normalCandidates).push(candidate);
      }
    }
  }
  return { sections, normalCandidates, invalidCandidates };
}

function projectMetrics(input: {
  metrics: TextMetrics;
  preflight: TextPreflight;
  model: string;
  providerCalls: number;
  latencyMs: number;
  usage?: JsonRecord;
}): AnalysisMetrics {
  const total = input.metrics.totalItems;
  const usage = input.usage;
  return {
    analyzerVersion: V5_TEXT_ANALYZER_VERSION,
    promptVersion: TEXT_ONLY_PROMPT_VERSION,
    model: input.model,
    pageCount: input.preflight.pdfPages,
    providerCalls: input.providerCalls,
    retryCount: 0,
    durationMs: input.latencyMs,
    inputTokens: number(usage?.promptTokenCount),
    outputTokens: number(usage?.candidatesTokenCount),
    totalTokens: number(usage?.totalTokenCount),
    nativeTextCharacters: input.preflight.textCharacters,
    nonEmptyPages: input.preflight.nonEmptyPages,
    textDocumentHash: input.preflight.textDocumentHash,
    validItemRate: total ? input.metrics.valid / total : 0,
    invalidFragmentRate: total ? input.metrics.invalid / total : 0,
    pagesRequiringReview: undefined,
    fallbackUsage: 0,
    textualSourceRate: 1,
    visualSourceRate: 0,
  };
}

function providerFailureCode(status: number): Pick<V5TextFailure, 'code' | 'retryable'> {
  if (status === 429) return { code: 'PROVIDER_RATE_LIMITED', retryable: true };
  if (status === 503 || status >= 500) return { code: 'PROVIDER_UNAVAILABLE', retryable: true };
  return { code: 'PROVIDER_REQUEST_REJECTED', retryable: false };
}

/**
 * Isolated production V5 boundary. It accepts native text only, calls Gemini once at most,
 * and returns invalid candidates separately so they cannot be mistaken for normal drafts.
 */
export async function analyzeV5Text(input: V5TextAnalysisInput): Promise<V5TextAnalysisOutcome> {
  const ids = createMenuImportIdFactory();
  const attemptId = input.attemptId ?? ids.attempt();
  let model: string;
  try {
    if (!input.restaurantId.trim()) throw new Error('V5_TEXT_RESTAURANT_REQUIRED');
    model = configuredModel(input.model);
  } catch {
    return failureOutcome({ restaurantId: input.restaurantId, attemptId, model: V5_TEXT_DEFAULT_MODEL, lineage: [], code: 'INVALID_ANALYSIS_INPUT', retryable: false });
  }

  let document: TextDocument;
  try {
    document = input.textDocument ?? await extractV5NativeText(input.pdf ?? new Uint8Array());
  } catch {
    return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage: [], code: 'PDF_TEXT_EXTRACTION_FAILED', retryable: false });
  }

  const preflight = describeV5NativeText(document, input.pdf);
  const lineage = [extractionLineage({ attemptId, preflight, model })];
  if (preflight.status !== 'ready') {
    return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage, preflight, code: 'TEXT_NOT_EVALUABLE', retryable: false });
  }
  if (!input.apiKey?.trim()) {
    return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage, preflight, code: 'PROVIDER_NOT_CONFIGURED', retryable: true });
  }

  const request = buildTextOnlyRequest(document);
  const budget = new TextOnlyRequestBudget();
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), V5_TEXT_TIMEOUT_MS);
  try {
    budget.consume();
    lineage.push(requestLineage(attemptId, model));
    const response = await (input.fetcher ?? fetch)(endpoint(model), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': input.apiKey },
      body: request.bodyText,
      signal: controller.signal,
    });
    const responseText = await response.text();
    const latencyMs = Date.now() - startedAt;
    let payload: JsonRecord;
    try {
      payload = JSON.parse(responseText || '{}') as JsonRecord;
    } catch {
      return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage, preflight, code: 'MALFORMED_PROVIDER_RESPONSE', retryable: false, httpStatus: response.status, metadata: { latencyMs, requestCount: budget.count } });
    }
    if (!response.ok) {
      const providerFailure = providerFailureCode(response.status);
      return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage, preflight, code: providerFailure.code, retryable: providerFailure.retryable, httpStatus: response.status, metadata: { latencyMs, requestCount: budget.count } });
    }

    const candidate = Array.isArray(payload.candidates) ? record(payload.candidates[0]) : undefined;
    const finishReason = text(candidate?.finishReason);
    const usage = record(payload.usageMetadata);
    lineage.push(terminalLineage({
      attemptId,
      model,
      stage: 'provider_raw',
      rawPayloadHash: contentHash(responseText),
      metadata: {
        responseBytes: Buffer.byteLength(responseText),
        finishReason,
        latencyMs,
        inputTokens: number(usage?.promptTokenCount),
        outputTokens: number(usage?.candidatesTokenCount),
      },
    }));
    if (outputTruncated(finishReason)) {
      return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage, preflight, code: 'OUTPUT_TRUNCATED', retryable: false, httpStatus: response.status, metadata: { latencyMs, requestCount: budget.count, finishReason, inputTokens: number(usage?.promptTokenCount), outputTokens: number(usage?.candidatesTokenCount) } });
    }
    const responseParts = record(candidate?.content)?.parts;
    const resultText = Array.isArray(responseParts)
      ? responseParts.map((part) => text(record(part)?.text)).find((part): part is string => Boolean(part))
      : undefined;
    let raw: unknown;
    try {
      raw = JSON.parse(resultText ?? '');
    } catch {
      return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage, preflight, code: 'MALFORMED_PROVIDER_RESPONSE', retryable: false, httpStatus: response.status, metadata: { latencyMs, requestCount: budget.count } });
    }
    const structural = validateTextStructure(raw, preflight.pdfPages);
    if (!structural.structuralValid) {
      return failureOutcome({
        restaurantId: input.restaurantId,
        attemptId,
        model,
        lineage,
        preflight,
        structural,
        code: 'STRUCTURAL_VALIDATION_FAILED',
        retryable: false,
        httpStatus: response.status,
        metadata: {
          latencyMs,
          requestCount: budget.count,
          missingPages: structural.missingPages,
          unexpectedPages: structural.unexpectedPages,
          duplicatedPages: structural.duplicatedPages,
          outOfOrderPages: structural.outOfOrderPages,
        },
      });
    }
    const decoded = decodeTextMenuDocument(raw);
    if (!decoded) {
      return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage, preflight, structural, code: 'DTO_DECODE_FAILED', retryable: false, httpStatus: response.status, metadata: { latencyMs, requestCount: budget.count } });
    }

    const canonical = applyTextValidation(reconcileTextDocument(adaptTextMenuDocument(decoded)));
    const semanticMetrics = textMetrics(canonical);
    const projected = projectCanonical(canonical);
    const metrics = projectMetrics({ metrics: semanticMetrics, preflight, model, providerCalls: budget.count, latencyMs, usage });
    const completedLineage = [
      ...lineage,
      terminalLineage({
        attemptId,
        model,
        stage: 'decode',
        metadata: { decodedPages: decoded.pages.length, serverGeneratedIds: true },
      }),
      terminalLineage({
        attemptId,
        model,
        stage: 'reconciliation',
        metadata: { continuityPolicy: 'adjacent-only', currentPageHeadingPrecedence: true },
      }),
      ...canonical.pages.flatMap((page) => page.sections.flatMap((section) => section.items.map((item) =>
        sanitizeLineageEvent({
          id: ids.event(),
          attemptId,
          candidateId: item.candidateId,
          itemId: item.itemId,
          sectionId: section.id,
          page: page.page,
          analyzerVersion: V5_TEXT_ANALYZER_VERSION,
          sourceKind: 'unknown',
          stage: 'validation',
          model,
          validationStatus: item.validation?.status ?? 'review',
          validationReasons: item.validation?.reasons ?? [],
          metadata: { evidenceAuthority: 'native-text', geometry: 'none' },
        }),
      ))),
      terminalLineage({
        attemptId,
        model,
        stage: 'validation',
        metadata: {
          latencyMs,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          requestCount: budget.count,
          structuralValid: true,
          semanticTotals: semanticMetrics,
          fallbackUsage: 'none',
        },
      }),
      terminalLineage({
        attemptId,
        model,
        stage: 'projection',
        metadata: {
          validCandidates: semanticMetrics.valid,
          reviewCandidates: semanticMetrics.review,
          invalidCandidates: semanticMetrics.invalid,
          normalDraftCandidates: projected.normalCandidates.length,
        },
      }),
    ];
    return {
      kind: 'success',
      restaurantId: input.restaurantId,
      attemptId,
      preflight,
      structural,
      invalidCandidates: projected.invalidCandidates,
      analysis: {
        items: projected.normalCandidates,
        images: [],
        suggestions: [],
        sections: projected.sections,
        metrics,
        lineage: completedLineage,
        structureMetadata: { provider: 'gemini', model, textualFallbackUsed: false },
      },
    };
  } catch (error) {
    const timeout = controller.signal.aborted || (error instanceof Error && /abort|timeout/i.test(error.message));
    return failureOutcome({ restaurantId: input.restaurantId, attemptId, model, lineage, preflight, code: timeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE', retryable: true, metadata: { latencyMs: Date.now() - startedAt, requestCount: budget.count } });
  } finally {
    clearTimeout(timer);
  }
}

export const V5_TEXT_LINEAGE_VERSIONS = {
  serializer: TEXT_DOCUMENT_SERIALIZER_VERSION,
  prompt: TEXT_ONLY_PROMPT_VERSION,
  schema: TEXT_ONLY_SCHEMA_VERSION,
} as const;
