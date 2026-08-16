'use client';

import { supabase } from '@/lib/supabase';

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
