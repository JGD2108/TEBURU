import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { getPoolClient } from '@/lib/db';
import { validatePublicationInput } from '@/lib/menu-import';
import { menuImportBucket, menuImportStorage } from '@/lib/menu-import-storage';

const publicBucket = 'menu-images';
export async function POST(request: Request, context: RouteContext<'/api/admin/menu-import/[id]/publish'>) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  if (!validatePublicationInput(await request.json())) return NextResponse.json({ error: 'Solo se admite publicación append' }, { status: 400 });
  const { id } = await context.params;
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');
    const job = await client.query<{ status: string }>('SELECT status FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2 FOR UPDATE', [id, staff.restaurantId]);
    if (!job.rows[0] || job.rows[0].status === 'published') { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Importación no disponible' }, { status: 404 }); }
    const invalid = await client.query(`SELECT i.id FROM menu_import_draft_items i LEFT JOIN menu_import_draft_categories c ON c.id = i.draft_category_id
      WHERE i.import_job_id = $1 AND i.restaurant_id = $2 AND i.review_status = 'approved' AND (NULLIF(trim(i.name), '') IS NULL OR i.price IS NULL OR i.price < 0 OR c.id IS NULL)`, [id, staff.restaurantId]);
    if (invalid.rows.length) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Hay platillos aprobados incompletos', itemIds: invalid.rows.map((row) => row.id) }, { status: 422 }); }
    const items = await client.query<{ id: string; name: string; description: string | null; price: string; category_name: string; image_id: string | null; storage_path: string | null; mime_type: string | null }>(`SELECT i.id, i.name, i.description, i.price, c.name AS category_name, s.id AS image_id, s.storage_path, s.mime_type
      FROM menu_import_draft_items i JOIN menu_import_draft_categories c ON c.id = i.draft_category_id
      LEFT JOIN LATERAL (SELECT * FROM menu_import_image_suggestions s WHERE s.draft_item_id = i.id AND s.approved ORDER BY s.created_at DESC LIMIT 1) s ON true
      WHERE i.import_job_id = $1 AND i.restaurant_id = $2 AND i.review_status = 'approved'`, [id, staff.restaurantId]);
    const storage = menuImportStorage();
    for (const item of items.rows) {
      let imageUrl: string | null = null;
      if (item.storage_path && item.mime_type && storage) {
        const source = await storage.storage.from(menuImportBucket).download(item.storage_path);
        if (source.error) throw source.error;
        const extension = item.mime_type === 'image/png' ? 'png' : item.mime_type === 'image/webp' ? 'webp' : 'jpg';
        const destination = `menu/${staff.restaurantId}/${randomUUID()}.${extension}`;
        const upload = await storage.storage.from(publicBucket).upload(destination, new Uint8Array(await source.data.arrayBuffer()), { contentType: item.mime_type, cacheControl: '31536000' });
        if (upload.error) throw upload.error;
        imageUrl = storage.storage.from(publicBucket).getPublicUrl(destination).data.publicUrl;
        await client.query('UPDATE menu_import_image_suggestions SET published_url = $1 WHERE id = $2', [imageUrl, item.image_id]);
      }
      const category = await client.query<{ id: string }>(`INSERT INTO menu_categories (restaurant_id, name) VALUES ($1, $2)
        ON CONFLICT (restaurant_id, lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [staff.restaurantId, item.category_name]);
      const published = await client.query<{ id: string }>(`INSERT INTO menu_items (restaurant_id, category_id, name, description, price, image_url)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [staff.restaurantId, category.rows[0].id, item.name, item.description, item.price, imageUrl]);
      await client.query("UPDATE menu_import_draft_items SET review_status = 'published', published_menu_item_id = $1, updated_at = now() WHERE id = $2", [published.rows[0].id, item.id]);
    }
    await client.query("UPDATE menu_import_draft_categories SET review_status = 'published', updated_at = now() WHERE import_job_id = $1 AND restaurant_id = $2 AND review_status = 'approved'", [id, staff.restaurantId]);
    await client.query("UPDATE menu_import_jobs SET status = 'published', published_at = now(), published_by = $1, updated_at = now() WHERE id = $2 AND restaurant_id = $3", [staff.userId, id, staff.restaurantId]);
    await client.query('COMMIT');
    return NextResponse.json({ published: items.rows.length });
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); console.error('Menu import publication error:', error); return NextResponse.json({ error: 'No se pudo publicar el borrador' }, { status: 500 }); }
  finally { client.release(); }
}
