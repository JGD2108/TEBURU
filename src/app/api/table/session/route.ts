import { NextResponse } from 'next/server';
import { isGuestFailure, requireGuestSession } from '@/lib/guest-session';

export async function GET(request: Request) {
  const guest = await requireGuestSession(request);
  if (isGuestFailure(guest)) return guest;
  return NextResponse.json({ session_id: guest.sessionId, session_user_id: guest.guestId, table_id: guest.tableId, name: guest.guestName });
}
