import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonAuthorizationError, jsonError, jsonSuccess, readJsonObject } from '@/lib/api-response';
import { getPoolClient } from '@/lib/db';
import {
  activeAssistedApprovalPolicy,
  deriveAssistedApprovalEligibility,
  parseProviderDecisionMetadata,
  type ProviderDecisionMetadata,
} from '@/lib/menu-import/assisted-approval-policy';
import { MENU_IMPORT_ANALYZER_V5 } from '@/lib/menu-import/analyzer-version';
import { isAssistedApprovalEnabled } from '@/lib/menu-import/assisted-approval-feature';
import { logger } from '@/lib/logger';

type DraftVersionMap = Record<string, string>;
type DraftRow = {
  id: string;
  draft_category_id: string | null;
  name: string | null;
  price: string | number | null;
  extraction_status: 'valid' | 'review' | 'invalid' | null;
  review_status: 'pending' | 'approved' | 'excluded' | 'published';
  review_reasons: unknown;
  extraction_attributes: unknown;
  updated_at: Date | string;
};
type ImportRow = { status: string; analyzer_version: string | null; analysis_execution_id: string | null };
type ApproveAllContext = { params: Promise<{ id: string }> };

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function draftVersions(value: Record<string, unknown> | null): DraftVersionMap | undefined {
  if (!value || !Object.hasOwn(value, 'draftVersions')) return undefined;
  const versions = object(value?.draftVersions);
  if (!versions || !Object.values(versions).every((entry) => {
    if (typeof entry !== 'string' || entry.length > 64) return false;
    const parsed = new Date(entry);
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === entry;
  })) return undefined;
  return versions as DraftVersionMap;
}

function snapshotHash(versions: DraftVersionMap) {
  const normalized = Object.entries(versions).sort(([left], [right]) => left.localeCompare(right));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/** Structural parsing only: the centralized policy remains the vocabulary authority. */
function providerDecision(attributes: unknown): ProviderDecisionMetadata | undefined {
  return parseProviderDecisionMetadata(object(attributes)?.providerDecision);
}

function hasValidationReasons(value: unknown) { return Array.isArray(value) && value.length > 0; }
function version(value: Date | string) { return new Date(value).toISOString(); }

function reasonTotals(reasons: string[]) {
  return Object.entries(reasons.reduce<Record<string, number>>((totals, reason) => {
    totals[reason] = (totals[reason] ?? 0) + 1;
    return totals;
  }, {})).sort(([left], [right]) => left.localeCompare(right)).map(([reason, count]) => ({ reason, count }));
}

function reasonCodes(reasons: { reason: string; count: number }[]) { return reasons.map(({ reason }) => reason); }

async function recordBulkAudit(client: PoolClient, input: {
  importId: string; restaurantId: string; executionId: string; actorId: string;
  policyVersion: string; confidenceThreshold: number; snapshotHash: string; outcome: 'completed' | 'conflict';
  approved: number; skipped: number; reasons: { reason: string; count: number }[];
}) {
  await client.query(`INSERT INTO menu_import_analysis_lineage_events
    (id, import_job_id, restaurant_id, analysis_execution_id, event_stage, source_kind, event_data)
    VALUES ($1,$2,$3,$4,'persistence','synthetic',$5::jsonb)`, [
    randomUUID(), input.importId, input.restaurantId, input.executionId,
    JSON.stringify({ bulkApproval: {
      actorId: input.actorId, policyVersion: input.policyVersion,
      confidenceThreshold: input.confidenceThreshold,
      precondition: { type: 'draft-versions', snapshotHash: input.snapshotHash }, outcome: input.outcome,
      approved: input.approved, skipped: input.skipped, reasons: input.reasons,
    } }),
  ]);
}

type RecordedBulkApproval = {
  policyVersion: string;
  confidenceThreshold: number;
  approved: number;
  skipped: number;
  reasons: { reason: string; count: number }[];
};

function recordedSummary(value: unknown): RecordedBulkApproval | undefined {
  const bulk = object(value);
  const reasons = Array.isArray(bulk?.reasons) ? bulk.reasons : undefined;
  if (!bulk || typeof bulk.policyVersion !== 'string' || typeof bulk.confidenceThreshold !== 'number'
    || !Number.isInteger(bulk.approved) || !Number.isInteger(bulk.skipped) || !reasons
    || !reasons.every((reason) => object(reason) && typeof object(reason)?.reason === 'string' && Number.isInteger(object(reason)?.count))) return undefined;
  return bulk as unknown as RecordedBulkApproval;
}

async function priorCompletedSummary(client: PoolClient, input: { importId: string; restaurantId: string; executionId: string; actorId: string; snapshotHash: string }) {
  const result = await client.query<{ bulk_approval: unknown }>(`SELECT event_data->'bulkApproval' AS bulk_approval
    FROM menu_import_analysis_lineage_events
    WHERE import_job_id = $1 AND restaurant_id = $2 AND analysis_execution_id = $3
      AND event_stage = 'persistence' AND source_kind = 'synthetic'
      AND event_data->'bulkApproval'->>'actorId' = $4
      AND event_data->'bulkApproval'->>'outcome' = 'completed'
      AND event_data->'bulkApproval'->'precondition'->>'type' = 'draft-versions'
      AND event_data->'bulkApproval'->'precondition'->>'snapshotHash' = $5
    ORDER BY created_at DESC, id DESC LIMIT 1`, [input.importId, input.restaurantId, input.executionId, input.actorId, input.snapshotHash]);
  return recordedSummary(result.rows[0]?.bulk_approval);
}

export async function POST(request: Request, context: ApproveAllContext) {
  let client: PoolClient | undefined;
  try {
    const staff = await requireRole(request, 'admin');
    if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    const snapshots = draftVersions(await readJsonObject(request));
    if (!snapshots) return jsonError(request, 'INVALID_REQUEST', 'Se requieren las versiones actuales de los borradores.', 400);
    if (!isAssistedApprovalEnabled()) return jsonError(request, 'INVALID_REQUEST', 'La aprobación asistida no está habilitada.', 409);
    const { id } = await context.params;
    client = await getPoolClient();
    await client.query('BEGIN');
    const locked = await client.query<ImportRow>(`SELECT status, analyzer_version, analysis_execution_id
      FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`, [id, staff.restaurantId]);
    const imported = locked.rows[0];
    if (!imported) { await client.query('ROLLBACK'); return jsonError(request, 'IMPORT_UPLOAD_NOT_FOUND', 'Importación no encontrada.', 404); }
    if (imported.analyzer_version !== MENU_IMPORT_ANALYZER_V5 || imported.status !== 'needs_review' || !imported.analysis_execution_id) {
      await client.query('ROLLBACK');
      return jsonError(request, 'INVALID_REQUEST', 'La importación no está disponible para aprobación asistida.', 409);
    }
    const preconditionHash = snapshotHash(snapshots);
    const replay = await priorCompletedSummary(client, {
      importId: id, restaurantId: staff.restaurantId, executionId: imported.analysis_execution_id,
      actorId: staff.userId, snapshotHash: preconditionHash,
    });
    if (replay) {
      await client.query('COMMIT');
      return jsonSuccess(request, {
        approved: replay.approved, skipped: replay.skipped, skipReasons: reasonCodes(replay.reasons),
        policyVersion: replay.policyVersion, confidenceThreshold: replay.confidenceThreshold,
      });
    }
    const drafts = await client.query<DraftRow>(`SELECT id, draft_category_id, name, price, extraction_status, review_status,
      review_reasons, extraction_attributes, updated_at
      FROM menu_import_draft_items
      WHERE import_job_id = $1 AND restaurant_id = $2
      ORDER BY id FOR UPDATE`, [id, staff.restaurantId]);
    const changed = drafts.rows.filter((draft) => draft.review_status !== 'approved' && draft.review_status !== 'published'
      && snapshots[draft.id] !== version(draft.updated_at));
    const policy = activeAssistedApprovalPolicy();
    if (changed.length) {
      await recordBulkAudit(client, {
        importId: id, restaurantId: staff.restaurantId, executionId: imported.analysis_execution_id, actorId: staff.userId,
        policyVersion: policy.version, confidenceThreshold: policy.confidenceThreshold, snapshotHash: preconditionHash, outcome: 'conflict',
        approved: 0, skipped: drafts.rows.length, reasons: reasonTotals(['DRAFT_CHANGED']),
      });
      await client.query('COMMIT');
      return jsonError(request, 'INVALID_REQUEST', 'Los borradores cambiaron; actualiza la importación antes de aprobar.', 409);
    }
    const assessments = drafts.rows.map((draft) => ({
      draft,
      eligibility: deriveAssistedApprovalEligibility({
        analyzerVersion: imported.analyzer_version,
        serverStatus: draft.extraction_status,
        providerDecision: providerDecision(draft.extraction_attributes),
        requiredFieldsComplete: Boolean(draft.draft_category_id && draft.name?.trim() && draft.price !== null && Number(draft.price) >= 0),
        hasValidationReasons: hasValidationReasons(draft.review_reasons),
        alreadyApproved: draft.review_status === 'approved' || draft.review_status === 'published',
        excluded: draft.review_status === 'excluded',
      }, policy),
    }));
    const approvedIds = assessments.filter(({ eligibility }) => eligibility.eligible).map(({ draft }) => draft.id);
    if (approvedIds.length) {
      const approved = await client.query(`UPDATE menu_import_draft_items
        SET review_status = 'approved', updated_at = now()
        WHERE import_job_id = $1 AND restaurant_id = $2 AND id = ANY($3::uuid[]) AND review_status = 'pending'`, [id, staff.restaurantId, approvedIds]);
      if (approved.rowCount !== approvedIds.length) throw new Error('MENU_IMPORT_BULK_APPROVAL_CONCURRENT_UPDATE');
    }
    const skipReasons = assessments.flatMap(({ eligibility }) => eligibility.blockingReasons);
    const skipReasonCounts = reasonTotals(skipReasons);
    const summary = { approved: approvedIds.length, skipped: assessments.length - approvedIds.length, skipReasons: reasonCodes(skipReasonCounts) };
    await recordBulkAudit(client, {
      importId: id, restaurantId: staff.restaurantId, executionId: imported.analysis_execution_id, actorId: staff.userId,
      policyVersion: policy.version, confidenceThreshold: policy.confidenceThreshold, snapshotHash: preconditionHash, outcome: 'completed',
      approved: summary.approved, skipped: summary.skipped, reasons: skipReasonCounts,
    });
    await client.query('COMMIT');
    return jsonSuccess(request, { ...summary, policyVersion: policy.version, confidenceThreshold: policy.confidenceThreshold });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => undefined);
    logger.error('menu_import.approve_all_failed', error);
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudieron aprobar los borradores elegibles.', 500);
  } finally { client?.release(); }
}

/**
 * Required optimistic-concurrency contract for review clients. POST must echo
 * this exact `draftVersions` map so stale screens cannot approve changed drafts.
 */
export async function GET(request: Request, context: ApproveAllContext) {
  try {
    const staff = await requireRole(request, 'admin');
    if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    const { id } = await context.params;
    const client = await getPoolClient();
    try {
      const imported = await client.query<ImportRow>('SELECT status, analyzer_version, analysis_execution_id FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2', [id, staff.restaurantId]);
      if (!imported.rows[0]) return jsonError(request, 'IMPORT_UPLOAD_NOT_FOUND', 'Importación no encontrada.', 404);
      const drafts = await client.query<Pick<DraftRow, 'id' | 'updated_at'>>('SELECT id, updated_at FROM menu_import_draft_items WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY id', [id, staff.restaurantId]);
      const draftVersions = Object.fromEntries(drafts.rows.map((draft) => [draft.id, version(draft.updated_at)]));
      return jsonSuccess(request, {
        enabled: isAssistedApprovalEnabled(),
        eligibleImport: imported.rows[0].analyzer_version === MENU_IMPORT_ANALYZER_V5 && imported.rows[0].status === 'needs_review',
        draftVersions,
      });
    } finally { client.release(); }
  } catch (error) {
    logger.error('menu_import.approve_all_precondition_failed', error);
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudo preparar la aprobación asistida.', 500);
  }
}
