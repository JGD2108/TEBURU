import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession,
      signOut,
    },
  },
}));

import { staffFetch } from './api-client';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key) ?? null : null),
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('staffFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const memoryStorage = createMemoryStorage();
    globalThis.window = {
      localStorage: memoryStorage,
    } as any;
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  it('clears stale auth state and omits Authorization when the session is missing', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    window.localStorage.setItem('teburu_restaurant_id', 'rest-123');

    await staffFetch('/api/staff/me');

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('teburu_restaurant_id')).toBeNull();
    const requestInit = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const headers = requestInit.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Restaurant-ID')).toBeNull();
  });

  it('adds the bearer token when the session is valid', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'abc123' } }, error: null });
    window.localStorage.setItem('teburu_restaurant_id', 'rest-456');

    await staffFetch('/api/staff/me');

    const requestInit = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const headers = requestInit.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer abc123');
    expect(headers.get('X-Restaurant-ID')).toBe('rest-456');
  });
});
