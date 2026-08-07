import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  try {
    await query('SELECT 1');
    return NextResponse.json({ status: 'ok', database: 'ok', latency_ms: Date.now() - startedAt });
  } catch (error) {
    logger.error('health.database.unavailable', error);
    return NextResponse.json({ status: 'degraded', database: 'unavailable' }, { status: 503 });
  }
}
