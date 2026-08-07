import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isGuestFailure, requireGuestSession } from '@/lib/guest-session';

export async function POST(request: Request) {
  try {
    const { table_id, needs_attention } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    }
    const guest = await requireGuestSession(request, table_id);
    if (isGuestFailure(guest)) return guest;

    const result = await query(`
      UPDATE tables 
      SET needs_attention = $1 
      WHERE id = $2 AND current_session_id = $3
    `, [Boolean(needs_attention), table_id, guest.sessionId]);

    if (!result.rowCount) return NextResponse.json({ error: 'Mesa cerrada' }, { status: 409 });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Update Attention Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
