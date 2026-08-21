import { createHash, randomUUID } from 'node:crypto';
import type {
  AnalysisAttemptId,
  AnalysisRunId,
  ExtractedItemId,
  ExtractedSectionId,
  ExtractionCandidateId,
  LineageEvent,
  LineageEventId,
  ReconciledSectionId,
  RenderedPageMetadata,
} from './types';

/**
 * Server identity factory. IDs intentionally do not derive from model output:
 * retries can return changed, repeated, or absent provider IDs safely.
 */
export type MenuImportIdFactory = {
  item(): ExtractedItemId;
  section(): ExtractedSectionId;
  candidate(): ExtractionCandidateId;
  attempt(): AnalysisAttemptId;
  event(): LineageEventId;
  reconciledSection(): ReconciledSectionId;
};

export function createMenuImportIdFactory(): MenuImportIdFactory {
  return {
    item: randomUUID,
    section: randomUUID,
    candidate: randomUUID,
    attempt: randomUUID,
    event: randomUUID,
    reconciledSection: randomUUID,
  };
}

export function contentHash(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex');
}

export function isServerLineageId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function renderedPageLineage(
  runId: AnalysisRunId,
  attemptId: AnalysisAttemptId,
  page: RenderedPageMetadata,
  ids = createMenuImportIdFactory(),
): LineageEvent {
  return {
    id: ids.event(), analysisRunId: runId, attemptId, page: page.page,
    sourceKind: 'gemini-visual', stage: 'render', imageMimeType: page.mimeType,
    imageWidth: page.width, imageHeight: page.height, imageByteSize: page.byteSize,
    imageHash: page.contentHash, metadata: page.storageReference ? { storageReference: page.storageReference } : undefined,
  };
}

/** Strip unsafe/oversized diagnostics before they reach durable JSON or HTTP projections. */
export function sanitizeLineageEvent(event: LineageEvent): LineageEvent {
  const metadata = event.metadata && Object.fromEntries(
    Object.entries(event.metadata)
      .filter(([key, value]) => !/authorization|credential|secret|token|api[_-]?key/i.test(key) && typeof value !== 'function')
      .slice(0, 32)
      .map(([key, value]) => [key.slice(0, 100), typeof value === 'string' ? value.slice(0, 2_000) : value]),
  );
  const rawPayload = event.rawPayload;
  const configuredDays = Number.parseInt(process.env.MENU_IMPORT_RAW_LINEAGE_RETENTION_DAYS ?? process.env.MENU_IMPORT_LINEAGE_RAW_RETENTION_DAYS ?? '7', 10);
  const retentionDays = Number.isFinite(configuredDays) ? Math.min(Math.max(configuredDays, 0), 30) : 7;
  const retainRaw = Boolean(rawPayload && rawPayload.length <= 128_000 && retentionDays > 0);
  return {
    ...event,
    page: event.page && event.page > 0 ? event.page : undefined,
    rawPayload: retainRaw ? rawPayload : undefined,
    rawPayloadHash: event.rawPayloadHash ?? (rawPayload ? contentHash(rawPayload) : undefined),
    rawPayloadExpiresAt: retainRaw ? event.rawPayloadExpiresAt ?? new Date(Date.now() + retentionDays * 86_400_000).toISOString() : undefined,
    validationReasons: event.validationReasons?.slice(0, 32).map((reason) => reason.slice(0, 100)),
    metadata: metadata && Object.keys(metadata).length ? metadata : undefined,
  };
}

export function safeLineageProjection(event: LineageEvent) {
  const safe = { ...sanitizeLineageEvent(event) };
  delete safe.rawPayload;
  delete safe.metadata;
  return safe;
}
