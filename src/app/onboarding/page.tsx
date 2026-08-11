"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type MenuRow = { name: string; category: string; price: number; description?: string };
function parseMenu(text: string): MenuRow[] {
  const [header, ...lines] = text.trim().split(/\r?\n/).map((line) => line.split(',').map((cell) => cell.trim()));
  const index = (name: string) => header.findIndex((cell) => cell.toLowerCase() === name);
  const name = index('name'), category = index('category'), price = index('price'), description = index('description');
  if ([name, category, price].some((value) => value < 0)) throw new Error('El archivo debe tener columnas name, category y price.');
  return lines.filter((line) => line[name]).map((line) => ({ name: line[name], category: line[category], price: Number(line[price]), description: description >= 0 ? line[description] : undefined }));
}

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [menu, setMenu] = useState<MenuRow[]>([]); const [message, setMessage] = useState('');
  const token = async () => (await supabase.auth.getSession()).data.session?.access_token;
  const createRestaurant = async (event: FormEvent) => {
    event.preventDefault(); const accessToken = await token();
    if (!accessToken) { router.push('/admin/login'); return; }
    const response = await fetch('/api/restaurants', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ name, slug }) });
    const payload = await response.json(); setMessage(response.ok ? 'Restaurante creado. Ahora carga tu menú o entra al panel.' : payload.error);
  };
  const importMenu = async () => {
    const accessToken = await token(); if (!accessToken || !menu.length) return;
    const response = await fetch('/api/restaurants/current/menu-import', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ items: menu }) });
    const payload = await response.json(); setMessage(response.ok ? `${payload.imported} platos importados.` : payload.error);
  };
  return <main className="screen-centered" style={{ padding: '24px' }}><section className="glass-panel" style={{ width: 'min(680px, 100%)', padding: '32px' }}>
    <p style={{ color: 'var(--primary)', fontWeight: 700 }}>TEBURU PARA RESTAURANTES</p><h1>Abre tu operación digital</h1><p>Configura tu local y carga un menú que tus clientes podrán pedir por QR.</p>
    <form onSubmit={createRestaurant} style={{ display: 'grid', gap: '12px', marginTop: '24px' }}><label>Nombre<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Identificador público<input required value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="mi-restaurante" /></label><button className="btn-primary">Crear restaurante</button></form>
    <div style={{ marginTop: '28px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}><h2 style={{ fontSize: '1.15rem' }}>Importar menú</h2><p>Sube un CSV exportado desde Excel con: name, category, price, description.</p><input type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setMenu(parseMenu(await file.text())); setMessage('Vista previa lista.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Archivo inválido.'); } }} />
      {menu.length > 0 && <><p>{menu.length} platos listos para importar.</p><button className="btn-secondary" onClick={() => void importMenu()}>Confirmar importación</button></>}</div>{message && <p style={{ marginTop: '18px', color: 'var(--primary)' }}>{message}</p>}
  </section></main>;
}
