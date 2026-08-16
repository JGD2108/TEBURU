import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHORIZATION_FAILED'
  | 'INVALID_REQUEST'
  | 'IMPORT_STORAGE_UNAVAILABLE'
  | 'IMPORT_UPLOAD_INVALID'
  | 'IMPORT_UPLOAD_EXPIRED'
  | 'IMPORT_UPLOAD_NOT_FOUND'
  | 'IMPORT_UPLOAD_INCOMPLETE'
  | 'IMPORT_FINALIZATION_FAILED'
  | 'IMPORT_JOB_CREATION_FAILED'
  | 'INTERNAL_ERROR';

/** Creates a correlation id once per control request without reflecting secrets. */
export function requestId(request: Request) {
  return request.headers.get('x-request-id')?.slice(0, 128) || randomUUID();
}

export function jsonSuccess<T>(request: Request, data: T, init: ResponseInit = {}, extra: Record<string, unknown> = {}) {
  const id = requestId(request);
  const response = NextResponse.json({ data, ...extra, requestId: id }, init);
  response.headers.set('x-request-id', id);
  return response;
}

export function jsonError(request: Request, code: ApiErrorCode, message: string, status: number, init: ResponseInit = {}) {
  const id = requestId(request);
  const response = NextResponse.json({ error: { code, message, requestId: id } }, { ...init, status });
  response.headers.set('x-request-id', id);
  return response;
}

export function jsonAuthorizationError(request: Request, status: number) {
  return jsonError(request, status === 401 ? 'AUTHENTICATION_REQUIRED' : 'AUTHORIZATION_FAILED',
    status === 401 ? 'Autenticación requerida.' : 'No tienes permiso para esta operación.', status);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
