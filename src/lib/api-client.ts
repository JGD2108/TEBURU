'use client';

import { supabase } from '@/lib/supabase';

export async function staffFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const activeRestaurantId = window.localStorage.getItem('teburu_restaurant_id');
  if (activeRestaurantId) headers.set('X-Restaurant-ID', activeRestaurantId);
  return fetch(input, { ...init, headers });
}
