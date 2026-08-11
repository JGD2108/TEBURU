import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const { requireRole, createClient, getBucket, createBucket, updateBucket, upload, getPublicUrl } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
  getBucket: vi.fn(),
  createBucket: vi.fn(),
  updateBucket: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireRole,
  isAuthorizationFailure: (value: unknown) => value instanceof Response,
}));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

import { POST } from './route';

function imageRequest(file: File) {
  const body = new FormData();
  body.append('file', file);
  return new Request('http://localhost/api/admin/menu/images', { method: 'POST', body });
}

describe('POST /api/admin/menu/images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    requireRole.mockResolvedValue({ userId: 'admin-1', name: 'Admin', role: 'admin' });
    getBucket.mockResolvedValue({ data: { public: true }, error: null });
    createBucket.mockResolvedValue({ error: null });
    updateBucket.mockResolvedValue({ error: null });
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/menu/image.webp' } });
    createClient.mockReturnValue({
      storage: {
        getBucket,
        createBucket,
        updateBucket,
        from: () => ({ upload, getPublicUrl }),
      },
    });
  });

  it('uploads a valid menu image and returns its public URL', async () => {
    const response = await POST(imageRequest(new File(['image'], 'dish.webp', { type: 'image/webp' })));

    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^menu\/.+\.webp$/), expect.any(Uint8Array), expect.objectContaining({ contentType: 'image/webp' }));
    expect(await response.json()).toEqual({ url: 'https://cdn.example/menu/image.webp' });
  });

  it('rejects unsupported files', async () => {
    const response = await POST(imageRequest(new File(['text'], 'notes.txt', { type: 'text/plain' })));

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('requires an administrator session', async () => {
    requireRole.mockResolvedValue(NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 }));

    const response = await POST(imageRequest(new File(['image'], 'dish.png', { type: 'image/png' })));

    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });
});
