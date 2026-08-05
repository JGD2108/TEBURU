import { NextResponse } from 'next/server';
import { getPoolClient, query } from '@/lib/db';

export async function POST(request: Request) {
  let client;
  try {
    const { table_id, code, name } = await request.json();
    if (!table_id || !code || !name) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Validación básica de UUID para evitar crash de Postgres
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(table_id)) {
      return NextResponse.json({ error: 'ID de mesa inválido. Asegúrate de escanear el QR correcto.' }, { status: 400 });
    }

    // 1. Verificar el código de la mesa
    const tableRes = await query('SELECT id, access_code, current_session_id, assigned_waiter_id FROM tables WHERE id = $1', [table_id]);
    
    if (tableRes.rows.length === 0) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    const table = tableRes.rows[0];

    if (table.access_code !== code) {
      return NextResponse.json({ error: 'PIN incorrecto o la mesa no está habilitada' }, { status: 403 });
    }

    let sessionId = table.current_session_id;

    client = await getPoolClient();
    await client.query('BEGIN');

    // 2. Si no hay sesión activa, crearla
    if (!sessionId) {
      const sessionRes = await client.query(`
        INSERT INTO sessions (table_id, status, code, waiter_id) 
        VALUES ($1, 'active', $2, $3) 
        RETURNING id
      `, [table_id, code, table.assigned_waiter_id]);
      
      sessionId = sessionRes.rows[0].id;

      // Actualizar estado de la mesa
      await client.query(`
        UPDATE tables 
        SET status = 'occupied', current_session_id = $1 
        WHERE id = $2
      `, [sessionId, table_id]);
    }

    // 3. Crear el usuario en esta sesión
    const userRes = await client.query(`
      INSERT INTO session_users (session_id, name) 
      VALUES ($1, $2) 
      RETURNING id
    `, [sessionId, name]);
    
    const sessionUserId = userRes.rows[0].id;

    await client.query('COMMIT');

    return NextResponse.json({ 
      success: true, 
      session_id: sessionId, 
      session_user_id: sessionUserId 
    });

  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error("Join Table Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
