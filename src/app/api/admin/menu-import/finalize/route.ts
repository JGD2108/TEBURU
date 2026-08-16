import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonError, jsonSuccess, readJsonObject, requestId } from '@/lib/api-response';
import { getPoolClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { menuImportDatabaseFailure } from '@/lib/menu-import-errors';
import { PDF_MENU_MAX_BYTES } from '@/lib/menu-import';
import { menuImportBucket, menuImportStorage } from '@/lib/menu-import-storage';

type Authorization = { id: string; storage_path: string; source_filename: string; expected_size_bytes: number; expires_at: string; token_hash: string; import_job_id: string | null };

type StorageObject = { name: string; metadata?: { size?: number | string; mimetype?: string } };

async function verifyAuthorizedUpload(storage: NonNullable<ReturnType<typeof menuImportStorage>>, record: Authorization) {
  const slashIndex = record.storage_path.lastIndexOf('/');
  const folder = record.storage_path.slice(0, slashIndex);
  const filename = record.storage_path.slice(slashIndex + 1);
  const listed = await storage.storage.from(menuImportBucket).list(folder, { search: filename });

  if (listed.error) return { kind: 'storage_error' as const, error: listed.error };

  const object = (listed.data as StorageObject[] | null)?.find((entry) => entry.name === filename);
  if (!object) return { kind: 'missing' as const };

  const size = Number(object.metadata?.size);
  const type = object.metadata?.mimetype;
  if (!Number.isSafeInteger(size) || size < 1 || size > PDF_MENU_MAX_BYTES || size !== record.expected_size_bytes || type !== 'application/pdf') {
    return { kind: 'metadata_mismatch' as const, size, type };
  }

  return { kind: 'verified' as const, size };
}

export async function POST(request: Request) {
  const correlationId = requestId(request);
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return jsonError(request, 'AUTHORIZATION_FAILED', 'No tienes permiso para importar menús.', 403);
  const body = await readJsonObject(request);
  const authorizationId = typeof body?.authorizationId === 'string' ? body.authorizationId : '';
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!authorizationId || !token) return jsonError(request, 'INVALID_REQUEST', 'La autorización de carga no es válida. Vuelve a seleccionar el PDF.', 400);
  let client: PoolClient | undefined;
  try {
    client = await getPoolClient();
    await client.query('BEGIN');
    const authorization = await client.query<Authorization>(`SELECT id, storage_path, source_filename, expected_size_bytes, expires_at, token_hash, import_job_id
      FROM menu_import_upload_authorizations WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`, [authorizationId, staff.restaurantId]);
    const record = authorization.rows[0];
    if (!record || createHash('sha256').update(token).digest('hex') !== record.token_hash) {
      await client.query('ROLLBACK');
      return jsonError(request, 'IMPORT_UPLOAD_INVALID', 'La autorización de carga no es válida. Vuelve a intentar.', 400);
    }
    if (record.import_job_id) {
      const existing = await client.query('SELECT id, status, source_filename, source_size_bytes, created_at FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2', [record.import_job_id, staff.restaurantId]);
      await client.query('COMMIT');
      return jsonSuccess(request, { import: existing.rows[0] });
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return jsonError(request, 'IMPORT_UPLOAD_EXPIRED', 'La autorización expiró. Vuelve a cargar el PDF.', 410);
    }
    const storage = menuImportStorage();
    if (!storage) {
      await client.query('ROLLBACK');
      return jsonError(request, 'IMPORT_STORAGE_UNAVAILABLE', 'La importación está temporalmente no disponible. Inténtalo más tarde.', 503);
    }
    const verification = await verifyAuthorizedUpload(storage, record);
    if (verification.kind === 'storage_error') {
      await client.query('ROLLBACK');
      logger.warn('menu_import.upload_verification_unavailable', { requestId: correlationId, authorizationId: record.id, restaurantId: staff.restaurantId });
      return jsonError(request, 'IMPORT_STORAGE_UNAVAILABLE', 'No se pudo verificar el PDF cargado. Inténtalo nuevamente.', 503);
    }
    if (verification.kind !== 'verified') {
      await client.query('ROLLBACK');
      logger.warn(`menu_import.upload_${verification.kind}`, {
        requestId: correlationId,
        authorizationId: record.id,
        restaurantId: staff.restaurantId,
        storagePath: record.storage_path,
        expectedSize: record.expected_size_bytes,
        ...(verification.kind === 'metadata_mismatch' ? { storedSize: verification.size, storedType: verification.type } : {}),
      });
      return jsonError(request, 'IMPORT_UPLOAD_INCOMPLETE', 'No se encontró un PDF válido. Vuelve a cargar el archivo.', 422);
    }
    const inserted = await client.query(`INSERT INTO menu_import_jobs (restaurant_id, created_by, source_storage_path, source_filename, source_size_bytes)
      VALUES ($1,$2,$3,$4,$5) RETURNING id, status, source_filename, source_size_bytes, created_at`, [staff.restaurantId, staff.userId, record.storage_path, record.source_filename, verification.size]);
    await client.query('UPDATE menu_import_upload_authorizations SET import_job_id = $1, finalized_at = now() WHERE id = $2', [inserted.rows[0].id, record.id]);
    await client.query('COMMIT');
    logger.info('menu_import.job_created', { requestId: correlationId, authorizationId: record.id, importId: inserted.rows[0].id, restaurantId: staff.restaurantId });
    return jsonSuccess(request, { import: inserted.rows[0] }, { status: 201 });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => undefined);
    const databaseFailure = menuImportDatabaseFailure(error);
    logger.error('menu_import.finalization_failed', error, { requestId: correlationId, authorizationId, restaurantId: staff.restaurantId, databaseCode: databaseFailure?.databaseCode });
    if (databaseFailure) return jsonError(request, databaseFailure.code, databaseFailure.message, databaseFailure.status);
    return jsonError(request, 'IMPORT_FINALIZATION_FAILED', 'No se pudo crear la importación. Inténtalo nuevamente.', 502);
  } finally { client?.release(); }
}
