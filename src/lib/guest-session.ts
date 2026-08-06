import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const guestCookieName = 'teburu_guest_access';
const guestTokenLifetimeSeconds = 60 * 60 * 12;

export type GuestSession = { tokenId: string; sessionId: string; guestId: string; tableId: string; guestName: string };

export function newGuestToken() {
  return randomBytes(32).toString('base64url');
}

export function setGuestCookie(response: NextResponse, token: string) {
  response.cookies.set(guestCookieName, token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: guestTokenLifetimeSeconds,
  });
}

export async function requireGuestSession(request: Request, expectedTableId?: string): Promise<GuestSession | NextResponse> {
  const token = request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${guestCookieName}=([^;]+)`))?.[1];
  if (!token) return NextResponse.json({ error: 'Sesión de mesa requerida' }, { status: 401 });

  const { rows } = await query<GuestSession>(`
    UPDATE guest_access_tokens gat
    SET last_used_at = now()
    FROM sessions s
    JOIN session_users su ON su.id = gat.session_user_id
    WHERE gat.token_hash = encode(digest($1, 'sha256'), 'hex')
      AND gat.revoked_at IS NULL AND gat.expires_at > now()
      AND s.id = gat.session_id AND s.status = 'active'
      ${expectedTableId ? 'AND s.table_id = $2' : ''}
    RETURNING gat.id AS "tokenId", gat.session_id AS "sessionId", gat.session_user_id AS "guestId",
      s.table_id AS "tableId", su.name AS "guestName"`, expectedTableId ? [token, expectedTableId] : [token]);
  if (!rows[0]) return NextResponse.json({ error: 'La sesión de mesa expiró o fue cerrada' }, { status: 401 });
  return rows[0];
}

export function isGuestFailure(value: GuestSession | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
