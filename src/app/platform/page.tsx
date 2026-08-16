"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ExternalLink, LogOut, Plus, Power, Search, Store, Users, UtensilsCrossed } from 'lucide-react';
import { staffFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import DemoBar from '@/components/DemoBar';
import { isLocalDemo } from '@/lib/demo';

type Restaurant = {
  id: string; name: string; slug: string; status: 'active' | 'suspended'; staff_count: number;
  table_count: number; menu_item_count: number; address?: string; contact_email?: string;
};

const emptyForm = {
  name: '', slug: '', contact_email: '', phone: '', address: '', primary_color: '#ff4757',
  currency: 'USD', timezone: 'America/Bogota', admin_name: '', admin_email: '', admin_password: '',
};

export default function PlatformPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const response = await staffFetch('/api/restaurants');
    if (response.status === 401) return router.replace('/admin/login?next=/platform');
    if (response.status === 403) return router.replace('/admin?error=platform-access');
    if (response.ok) setRestaurants((await response.json()).data);
  }, [router]);
  useEffect(() => { if (!isLocalDemo()) { window.localStorage.removeItem('teburu_restaurant_id'); void load(); } }, [load]);
  const visibleRestaurants = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return restaurants;
    return restaurants.filter((restaurant) => [restaurant.name, restaurant.slug, restaurant.address, restaurant.contact_email]
      .filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(term)));
  }, [restaurants, search]);

  if (isLocalDemo()) return <div className="app-shell"><DemoBar active="platform" /><main className="container" style={{ paddingBlock: '48px' }}><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap', marginBottom: 34 }}><div><p className="eyebrow">Teburu platform · demo</p><h1 className="display" style={{ margin: 0 }}>Una vista clara de cada casa.</h1><p style={{ maxWidth: 580, color: 'var(--text-muted)' }}>Administra locales sin perder de vista lo importante.</p></div><button className="btn-primary"><Plus size={18}/> Nuevo restaurante</button></header><section style={{ display: 'grid', gap: 14 }}>{[{ name: 'Casa Teburu', slug: 'casa-teburu', tables: 14, staff: 9, menu: 32, status: 'Servicio activo' }, { name: 'Mesa del Jardín', slug: 'mesa-jardin', tables: 8, staff: 6, menu: 24, status: 'Preparando apertura' }].map((restaurant) => <article className="surface-card" key={restaurant.slug} style={{ padding: 24, display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) auto', gap: 20, alignItems: 'center' }}><div><p className="eyebrow">{restaurant.status}</p><h2 style={{ margin: 0 }}>{restaurant.name}</h2><p>/{restaurant.slug}</p><div style={{ display: 'flex', gap: 16, color: 'var(--text-muted)', fontSize: '.9rem' }}><span>{restaurant.staff} equipo</span><span>{restaurant.tables} mesas</span><span>{restaurant.menu} platos</span></div></div><button className="btn-secondary" onClick={() => router.push('/admin?demo=admin')}>Abrir operación</button></article>)}</section></main></div>;

  const createRestaurant = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    const response = await staffFetch('/api/restaurants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(payload.error ?? 'No se pudo crear el restaurante.');
    setForm(emptyForm); setShowForm(false); setMessage(`${payload.data.name} quedó listo para operar.`); await load();
  };
  const setStatus = async (restaurant: Restaurant) => {
    const status = restaurant.status === 'active' ? 'suspended' : 'active';
    const response = await staffFetch(`/api/restaurants/${restaurant.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setMessage(response.ok ? `${restaurant.name}: ${status === 'active' ? 'activado' : 'suspendido'}.` : 'No se pudo actualizar el restaurante.');
    if (response.ok) await load();
  };
  const openRestaurant = (restaurant: Restaurant) => {
    window.localStorage.setItem('teburu_restaurant_id', restaurant.id);
    router.push('/admin');
  };
  const handleLogout = async () => {
    window.localStorage.removeItem('teburu_restaurant_id');
    await supabase.auth.signOut();
    router.replace('/admin/login?next=/platform');
  };

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'var(--text-main)' };
  return <main style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: 'clamp(24px, 5vw, 72px)' }}>
    <div style={{ maxWidth: '1180px', margin: 'auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><p style={{ color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.14em' }}>TEBURU PLATFORM</p><h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 4.4rem)', margin: '6px 0' }}>Control de restaurantes</h1><p style={{ color: 'var(--text-muted)', maxWidth: '650px' }}>Crea un local completo y entra en modo soporte para configurar personal, menú, mesas y operación.</p></div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}><button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Plus size={18}/>{showForm ? 'Cerrar formulario' : 'Nuevo restaurante'}</button><button className="btn-secondary" onClick={() => void handleLogout()} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><LogOut size={17}/> Cerrar sesión</button></div>
      </header>
      {message && <p style={{ marginTop: '20px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,71,87,.1)', color: 'var(--primary)' }}>{message}</p>}

      {showForm && <form onSubmit={createRestaurant} className="glass-panel" style={{ marginTop: '28px', padding: 'clamp(20px, 4vw, 36px)' }}>
        <h2 style={{ marginTop: 0 }}>Alta de restaurante</h2><p style={{ color: 'var(--text-muted)' }}>Se creará el restaurante y su administrador. Podrás configurar las mesas después desde el panel del restaurante.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {[
            ['name','Nombre del restaurante','text'],['slug','Identificador web (opcional)','text'],['contact_email','Correo del restaurante','email'],['phone','Teléfono','tel'],['address','Dirección','text'],
            ['admin_name','Nombre del administrador','text'],['admin_email','Correo de acceso del administrador','email'],['admin_password','Contraseña inicial (12+ caracteres)','password'],
          ].map(([key,label,type]) => <label key={key} style={{ display: 'grid', gap: '7px', fontSize: '.9rem' }}>{label}<input required={!['slug','contact_email','phone','address'].includes(key)} type={type} style={inputStyle} value={String(form[key as keyof typeof form])} onChange={(e) => setForm({ ...form, [key]: e.target.value })}/></label>)}
          <label style={{ display: 'grid', gap: '7px', fontSize: '.9rem' }}>Moneda<select style={inputStyle} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option>USD</option><option>COP</option><option>EUR</option><option>MXN</option></select></label>
          <label style={{ display: 'grid', gap: '7px', fontSize: '.9rem' }}>Color de marca<input type="color" style={{ ...inputStyle, height: '45px' }} value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}/></label>
        </div>
        <button disabled={saving} className="btn-primary" style={{ marginTop: '22px' }}>{saving ? 'Creando estructura…' : 'Crear restaurante y administrador'}</button>
      </form>}

      <section style={{ marginTop: '32px' }}>
        <label className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', maxWidth: '540px', color: 'var(--text-muted)' }}><Search size={18}/><input aria-label="Buscar restaurante" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, identificador, correo o dirección" style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--text-main)', font: 'inherit' }}/></label>
        <p style={{ color: 'var(--text-muted)', fontSize: '.88rem', margin: '14px 0' }}>{visibleRestaurants.length} de {restaurants.length} restaurantes</p>
        <div style={{ display: 'grid', gap: '16px' }}>
        {visibleRestaurants.map((restaurant) => <article key={restaurant.id} className="glass-panel" style={{ padding: '22px', display: 'grid', gridTemplateColumns: 'minmax(220px,1.4fr) minmax(280px,1fr) auto', gap: '22px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}><span style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,71,87,.12)', color: 'var(--primary)' }}><Store/></span><div><h2 style={{ margin: 0 }}>{restaurant.name}</h2><p style={{ color: 'var(--text-muted)', margin: '5px 0 0' }}>/{restaurant.slug}{restaurant.address ? ` · ${restaurant.address}` : ''}</p></div></div>
          <div style={{ display: 'flex', gap: '18px', color: 'var(--text-muted)', fontSize: '.88rem' }}><span><Users size={16}/> {restaurant.staff_count} personal</span><span><Building2 size={16}/> {restaurant.table_count} mesas</span><span><UtensilsCrossed size={16}/> {restaurant.menu_item_count} platos</span></div>
          <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}><button disabled={restaurant.status !== 'active'} className="btn-primary" onClick={() => openRestaurant(restaurant)}><ExternalLink size={16}/> Abrir</button><button className="btn-secondary" onClick={() => void setStatus(restaurant)}><Power size={16}/> {restaurant.status === 'active' ? 'Suspender' : 'Activar'}</button></div>
        </article>)}
        {!visibleRestaurants.length && <div className="glass-panel" style={{ padding: '28px', color: 'var(--text-muted)' }}>{restaurants.length ? 'No encontramos restaurantes con esa búsqueda.' : 'Todavía no hay restaurantes creados.'}</div>}
        </div>
      </section>
    </div>
  </main>;
}
