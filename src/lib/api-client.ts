'use client';

import { supabase } from '@/lib/supabase';

type ApiErrorBody = {
  error?: string | { code?: string; message?: string; requestId?: string };
  message?: string;
  requestId?: string;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(message: string, options: { status: number; code?: string; requestId?: string; retryable?: boolean }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? (options.status >= 500 || options.status === 0);
  }
}

function isJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') || contentType.includes('+json');
}

/**
 * Parses application JSON defensively. Hosting/CDN errors frequently return HTML
 * before a route handler runs, so callers must never use Response.json() directly
 * for admin control requests.
 */
export async function readApiResponse<T>(response: Response, fallback = 'El servicio devolvió una respuesta no válida. Inténtalo de nuevo.'): Promise<T> {
  const requestId = response.headers.get('x-request-id') ?? response.headers.get('x-vercel-id') ?? undefined;
  if (!isJsonResponse(response)) {
    throw new ApiClientError(fallback, { status: response.status, requestId, retryable: true });
  }

  try {
    return await response.json() as T;
  } catch {
    throw new ApiClientError(fallback, { status: response.status, requestId, retryable: true });
  }
}

export function requireApiSuccess<T extends ApiErrorBody>(response: Response, payload: T, fallback: string): T {
  if (response.ok) return payload;
  const nested = typeof payload.error === 'object' && payload.error ? payload.error : undefined;
  throw new ApiClientError(
    nested?.message ?? (typeof payload.error === 'string' ? payload.error : payload.message) ?? fallback,
    {
      status: response.status,
      code: nested?.code,
      requestId: nested?.requestId ?? payload.requestId ?? response.headers.get('x-request-id') ?? undefined,
    },
  );
}

export async function staffFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    try {
      await supabase.auth.signOut();
    } catch {
      // noop: session is already invalid or absent
    }
    window.localStorage.removeItem('teburu_restaurant_id');
    return fetch(input, { ...init, headers: new Headers(init.headers) });
  }

  const activeRestaurantId = window.localStorage.getItem('teburu_restaurant_id');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (activeRestaurantId) headers.set('X-Restaurant-ID', activeRestaurantId);
  return fetch(input, { ...init, headers });
}
