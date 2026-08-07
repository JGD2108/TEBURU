import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const { rows } = await query('SELECT name, logo_url, primary_color FROM restaurant_settings ORDER BY updated_at DESC LIMIT 1');
  return NextResponse.json({ data: rows[0] ?? null });
}
