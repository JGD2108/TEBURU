import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireStaff } from '@/lib/auth';

export async function GET(request: Request) {
  const staff = await requireStaff(request);
  if (isAuthorizationFailure(staff)) return staff;
  return NextResponse.json({ data: staff });
}
