import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

const bucketName = 'menu-images';
const maxImageSize = 4 * 1024 * 1024;
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || !extensions[file.type] || file.size < 1 || file.size > maxImageSize) {
    return NextResponse.json(
      { error: 'Selecciona una imagen JPG, PNG o WEBP de máximo 4 MB' },
      { status: 400 }
    );
  }

  const supabase = storageAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'El almacenamiento de imágenes no está configurado' }, { status: 503 });
  }

  const bucket = await supabase.storage.getBucket(bucketName);
  if (!bucket.data) {
    const created = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: maxImageSize,
      allowedMimeTypes: Object.keys(extensions),
    });
    if (created.error && !created.error.message.toLowerCase().includes('already')) {
      console.error('Menu image bucket error:', created.error);
      return NextResponse.json({ error: 'No se pudo preparar el almacenamiento de imágenes' }, { status: 502 });
    }
  } else if (!bucket.data.public) {
    const updated = await supabase.storage.updateBucket(bucketName, {
      public: true,
      fileSizeLimit: maxImageSize,
      allowedMimeTypes: Object.keys(extensions),
    });
    if (updated.error) {
      console.error('Menu image bucket update error:', updated.error);
      return NextResponse.json({ error: 'No se pudo habilitar la imagen pública' }, { status: 502 });
    }
  }

  const path = `menu/${staff.restaurantId}/${randomUUID()}.${extensions[file.type]}`;
  const uploaded = await supabase.storage.from(bucketName).upload(path, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (uploaded.error) {
    console.error('Menu image upload error:', uploaded.error);
    return NextResponse.json({ error: 'No se pudo subir la imagen' }, { status: 502 });
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
