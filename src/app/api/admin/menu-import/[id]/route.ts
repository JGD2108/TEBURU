import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request, context: RouteContext<'/api/admin/menu-import/[id]'>) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const { id } = await context.params;
  const imported = await query(`SELECT id, status, source_filename, source_size_bytes, failure_reason, created_at, updated_at, published_at
    FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2`, [id, staff.restaurantId]);
  if (!imported.rows[0]) return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 });
  const [categories, items, evidence, images] = await Promise.all([
    query(`SELECT * FROM menu_import_draft_categories WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY sort_order, name`, [id, staff.restaurantId]),
    query(`SELECT * FROM menu_import_draft_items WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY created_at`, [id, staff.restaurantId]),
    query(`SELECT e.* FROM menu_import_source_evidence e JOIN menu_import_draft_items i ON i.id = e.draft_item_id WHERE e.import_job_id = $1 AND i.restaurant_id = $2`, [id, staff.restaurantId]),
    query(`SELECT * FROM menu_import_image_suggestions WHERE import_job_id = $1 AND restaurant_id = $2`, [id, staff.restaurantId]),
  ]);
  return NextResponse.json({ import: imported.rows[0], draft: { categories: categories.rows, items: items.rows, evidence: evidence.rows, imageSuggestions: images.rows } });
}
