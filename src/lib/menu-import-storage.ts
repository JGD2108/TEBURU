import { createClient } from '@supabase/supabase-js';

export const menuImportBucket = 'menu-imports';
export function menuImportStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function ensureMenuImportBucket() {
  const storage = menuImportStorage();
  if (!storage) return null;
  const existing = await storage.storage.getBucket(menuImportBucket);
  if (!existing.data) {
    const created = await storage.storage.createBucket(menuImportBucket, { public: false, fileSizeLimit: 20 * 1024 * 1024, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] });
    if (created.error && !created.error.message.toLowerCase().includes('already')) throw created.error;
  } else if (existing.data.public) {
    const updated = await storage.storage.updateBucket(menuImportBucket, { public: false });
    if (updated.error) throw updated.error;
  }
  return storage;
}
