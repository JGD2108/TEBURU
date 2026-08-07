import { NextResponse } from 'next/server';
import { clearGuestCookie, isGuestFailure, requireGuestSession, setGuestCookie } from '@/lib/guest-session';

export async function GET(request: Request) {
  const tableId = new URL(request.url).searchParams.get('table_id');
  if (!tableId) return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
  const guest = await requireGuestSession(request, tableId);
  if (isGuestFailure(guest)) {
    clearGuestCookie(guest);
    return guest;
  }
  const response = NextResponse.json({ table_id: guest.tableId, name: guest.guestName });
  setGuestCookie(response, guest.rawToken);
  return response;
}
