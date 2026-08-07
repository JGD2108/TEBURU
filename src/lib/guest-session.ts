import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const guestCookieName = 'teburu_guest_access';
const defaultGuestTokenLifetimeSeconds = 60 * 60 * 12;

export type GuestSession = {
  tokenId: string; sessionId: string; guestId: string; tableId: string; guestName: string; rawToken: string;
};

export function guestTokenLifetimeSeconds() {
  const configured = Number(process.env.GUEST_SESSION_TTL_SECONDS);
  return Number.isInteger(configured) && configured >= 300 && configured <= 60 * 60 * 24 * 7
    ? configured
    : defaultGuestTokenLifetimeSeconds;
}

export function newGuestToken() {
  return randomBytes(32).toString('base64url');
}

export function setGuestCookie(response: NextResponse, token: string) {
  response.cookies.set(guestCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: guestTokenLifetimeSeconds(),
  });
}

export function clearGuestCookie(response: NextResponse) {
  response.cookies.set(guestCookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function requireGuestSession(request: Request, expectedTableId?: string): Promise<GuestSession | NextResponse> {
  const token = request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${guestCookieName}=([^;]+)`))?.[1];
  if (!token) return NextResponse.json({ error: 'Sesión de mesa requerida' }, { status: 401 });

  const lifetimeParameter = expectedTableId ? 3 : 2;
  const parameters = expectedTableId
    ? [token, expectedTableId, guestTokenLifetimeSeconds()]
    : [token, guestTokenLifetimeSeconds()];
  const expectedTableCheck = expectedTableId
    ? 'AND EXISTS (SELECT 1 FROM tables requested_table WHERE requested_table.id = $2 AND requested_table.current_session_id = gat.session_id)'
    : '';
  const tableIdField = expectedTableId ? '$2::uuid' : 's.table_id';
  const { rows } = await query<Omit<GuestSession, 'rawToken'>>(`
    UPDATE guest_access_tokens gat
    SET last_used_at = now(), expires_at = now() + ($${lifetimeParameter}::integer * interval '1 second')
    FROM sessions s, session_users su
    WHERE gat.token_hash = encode(digest($1, 'sha256'), 'hex')
      AND gat.revoked_at IS NULL AND gat.expires_at > now()
      AND s.id = gat.session_id AND su.id = gat.session_user_id AND s.status = 'active'
      ${expectedTableCheck}
    RETURNING gat.id AS "tokenId", gat.session_id AS "sessionId", gat.session_user_id AS "guestId",
      ${tableIdField} AS "tableId", su.name AS "guestName"`, parameters);
  if (!rows[0]) return NextResponse.json({ error: 'La sesión de mesa expiró o fue cerrada' }, { status: 401 });
  return { ...rows[0], rawToken: token };
}

export function isGuestFailure(value: GuestSession | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
