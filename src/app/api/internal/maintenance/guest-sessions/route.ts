import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { menuImportBucket, menuImportStorage } from '@/lib/menu-import-storage';

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { rows } = await query<{ deleted: string }>('SELECT cleanup_expired_guest_access_tokens() AS deleted');
  const pending = await query<{ id: string; storage_path: string }>(`SELECT id, storage_path FROM menu_import_upload_authorizations
    WHERE expires_at < now() AND import_job_id IS NULL ORDER BY expires_at LIMIT 100`);
  const storage = menuImportStorage();
  const cleaned: string[] = [];
  for (const upload of pending.rows) {
    if (storage) {
      const removed = await storage.storage.from(menuImportBucket).remove([upload.storage_path]);
      if (removed.error) {
        logger.warn('menu_import.expired_upload_cleanup_failed', { authorizationId: upload.id });
        continue;
      }
    }
    cleaned.push(upload.id);
  }
  if (cleaned.length) await query('DELETE FROM menu_import_upload_authorizations WHERE id = ANY($1::uuid[]) AND import_job_id IS NULL', [cleaned]);
  logger.info('menu_import.expired_uploads_cleaned', { count: cleaned.length });
  return NextResponse.json({ deleted: Number(rows[0]?.deleted ?? 0), expiredImportUploadsDeleted: cleaned.length });
}

export const POST = GET;
