import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin', 'waiter');
  if (isAuthorizationFailure(staff)) return staff;
  try {
    const { table_id, waiter_id } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    }

    const newPin = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits

    const result = await query(`
      UPDATE tables 
      SET access_code = $1,
          assigned_waiter_id = CASE WHEN $4::text = 'waiter' THEN $5 ELSE COALESCE($2, assigned_waiter_id) END
      WHERE id = $3 AND ($4::text = 'admin' OR assigned_waiter_id = $5)
    `, [newPin, waiter_id || null, table_id, staff.role, staff.userId]);

    if (!result.rowCount) return NextResponse.json({ error: 'Mesa no asignada' }, { status: 403 });

    return NextResponse.json({ success: true, pin: newPin });

  } catch (error: any) {
    console.error("Generate PIN Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
