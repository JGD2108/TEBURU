import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const tableId = new URL(request.url).searchParams.get('table_id');
  if (!tableId) return NextResponse.json({ error: 'Falta la mesa' }, { status: 400 });
  const { rows } = await query(
    `SELECT rs.name, rs.logo_url, rs.primary_color FROM restaurant_settings rs
     JOIN tables t ON t.restaurant_id = rs.restaurant_id WHERE t.id = $1`, [tableId]
  );
  return NextResponse.json({ data: rows[0] ?? null });
}
