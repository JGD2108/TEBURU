"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffFetch } from '@/lib/api-client';

type Restaurant = { id: string; name: string; slug: string; status: 'active' | 'suspended'; staff_count: number; created_at: string };

export default function PlatformPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]); const [message, setMessage] = useState('');
  const load = async () => { const response = await staffFetch('/api/restaurants'); if (response.status === 401 || response.status === 403) { router.replace('/admin'); return; } if (response.ok) setRestaurants((await response.json()).data); };
  useEffect(() => { void load(); }, []);
  const setStatus = async (restaurant: Restaurant) => { const status = restaurant.status === 'active' ? 'suspended' : 'active'; const response = await staffFetch(`/api/restaurants/${restaurant.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); setMessage(response.ok ? `${restaurant.name}: ${status === 'active' ? 'activado' : 'suspendido'}.` : 'No se pudo actualizar el restaurante.'); if (response.ok) await load(); };
  return <main style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: 'clamp(24px, 6vw, 80px)' }}><div style={{ maxWidth: '1050px', margin: 'auto' }}>
    <p style={{ color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.12em' }}>CONTROL DE PLATAFORMA</p><h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 4.8rem)', margin: '8px 0' }}>Restaurantes Teburu</h1><p style={{ color: 'var(--text-muted)' }}>Revisa altas, operación y soporte de los locales registrados.</p>
    {message && <p style={{ color: 'var(--primary)' }}>{message}</p>}<div style={{ display: 'grid', gap: '14px', marginTop: '32px' }}>{restaurants.map((restaurant) => <article key={restaurant.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}><div><h2 style={{ margin: 0 }}>{restaurant.name}</h2><p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>/{restaurant.slug} · {restaurant.staff_count} personas</p></div><button className={restaurant.status === 'active' ? 'btn-secondary' : 'btn-primary'} onClick={() => void setStatus(restaurant)}>{restaurant.status === 'active' ? 'Suspender' : 'Activar'}</button></article>)}</div>
  </div></main>;
}
