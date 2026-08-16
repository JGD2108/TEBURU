'use client';

import { Bell, ChefHat, Clock3, LayoutDashboard, ReceiptText, Users } from 'lucide-react';
import DemoBar from './DemoBar';
import { type DemoRole } from '@/lib/demo';

const content: Record<Exclude<DemoRole, 'guest' | 'platform'>, { title: string; eyebrow: string; lead: string; stats: [string, string][]; tasks: string[]; icon: typeof Bell }> = {
  admin: { title: 'El pulso del servicio', eyebrow: 'Casa Teburu · hoy', lead: 'Las decisiones importantes están aquí; lo demás espera su turno.', stats: [['$1.284.000', 'venta del turno'], ['14', 'mesas activas'], ['6 min', 'tiempo medio']], tasks: ['Revisar dos mesas que esperan cuenta', 'Confirmar la apertura de caja', 'Actualizar el especial de hoy'], icon: LayoutDashboard },
  waiter: { title: 'Tu salón, en movimiento', eyebrow: 'Turno de mediodía', lead: 'Prioriza lo que necesita una respuesta ahora.', stats: [['14', 'mesas activas'], ['2', 'llamadas nuevas'], ['4', 'platos listos']], tasks: ['Mesa 12 solicita la cuenta', 'Mesa 08 necesita atención', 'Llevar trucha a mesa 03'], icon: Bell },
  kitchen: { title: 'Cocina en cadencia', eyebrow: 'Estación caliente', lead: 'La siguiente acción correcta, sin ruido alrededor.', stats: [['7', 'en preparación'], ['4', 'listos para salir'], ['6 min', 'tiempo objetivo']], tasks: ['Trucha del día · mesa 03', 'Arepa de maíz · mesa 12', 'Huerta tibia · mesa 08'], icon: ChefHat },
};

export default function DemoWorkspace({ role }: { role: Exclude<DemoRole, 'guest' | 'platform'> }) {
  const view = content[role]; const Icon = view.icon;
  return <div className="app-shell"><DemoBar active={role} /><main className="container" style={{ paddingBlock: '48px' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 38 }}><div><p className="eyebrow">{view.eyebrow}</p><h1 className="display" style={{ margin: 0 }}>{view.title}</h1><p style={{ maxWidth: 540, color: 'var(--text-muted)', fontSize: '1.05rem' }}>{view.lead}</p></div><button className="btn-primary"><Clock3 size={18} /> Ver actividad</button></header>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 30 }}>{view.stats.map(([value, label]) => <article className="surface-card" key={label} style={{ padding: 22 }}><strong style={{ display: 'block', fontSize: '1.8rem', letterSpacing: '-.06em' }}>{value}</strong><span style={{ color: 'var(--text-muted)' }}>{label}</span></article>)}</section>
    <section className="surface-card" style={{ padding: 'clamp(20px, 4vw, 36px)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20 }}><span style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--primary-transparent)', color: 'var(--primary)' }}><Icon /></span><div><p className="eyebrow">Ahora</p><h2 style={{ margin: 0 }}>Tres cosas que desbloquean el servicio</h2><div style={{ display: 'grid', gap: 10, marginTop: 20 }}>{view.tasks.map((task, index) => <button key={task} className="btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left' }}><span style={{ color: 'var(--brand)' }}>0{index + 1}</span>{task}</button>)}</div></div></section>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginTop: 20 }}><article className="surface-card" style={{ padding: 22 }}><Users size={20} color="var(--sage)" /><h3>Equipo alineado</h3><p>El salón y cocina ven los mismos estados en tiempo real.</p></article><article className="surface-card" style={{ padding: 22 }}><ReceiptText size={20} color="var(--brand)" /><h3>Cierres claros</h3><p>Las solicitudes de cuenta no se pierden entre tareas.</p></article></section>
  </main></div>;
}
