import Link from 'next/link';
import { ArrowUpRight, QrCode, Sparkles, UtensilsCrossed } from 'lucide-react';
import DemoBar from '@/components/DemoBar';

export default function Home() {
  return <div className="app-shell"><DemoBar /><main className="container" style={{ paddingBlock: '26px 54px' }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 22, borderBottom: '1px solid var(--line)' }}><Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', textDecoration: 'none', fontWeight: 800 }}><span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '50%', background: 'var(--brand)', color: '#fff' }}><UtensilsCrossed size={20}/></span> teburu</Link><span className="eyebrow" style={{ margin: 0 }}>restaurant operating system</span></header>
    <section style={{ minHeight: 'calc(100vh - 150px)', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(300px, .9fr)', gap: 'clamp(32px, 8vw, 120px)', alignItems: 'center' }}>
      <div className="animate-fade-up"><p className="eyebrow">Hospitalidad que fluye</p><h1 className="display" style={{ margin: 0, maxWidth: 720 }}>Menos pantallas.<br/><em style={{ color: 'var(--brand)' }}>Más servicio.</em></h1><p style={{ maxWidth: 520, fontSize: '1.15rem', color: 'var(--text-muted)', marginTop: 24 }}>Teburu conecta al salón, la cocina y a cada comensal con una experiencia pensada para la velocidad de un buen servicio.</p><Link href="/admin/login" className="btn-primary" style={{ marginTop: 26, textDecoration: 'none' }}>Entrar al equipo <ArrowUpRight size={18}/></Link></div>
      <aside className="surface-card animate-fade-up" style={{ padding: 'clamp(24px, 4vw, 42px)', animationDelay: '.1s' }}><span style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: '50%', background: 'var(--paper-deep)', color: 'var(--brand)' }}><QrCode /></span><p className="eyebrow" style={{ marginTop: 32 }}>Para la mesa</p><h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-.05em', margin: '8px 0' }}>Tu menú, cuando lo necesitas.</h2><p>Los comensales escanean el QR de su mesa activa y comienzan sin descargar nada.</p><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 26, color: 'var(--sage)', fontWeight: 700 }}><Sparkles size={17}/> Pedido, estado y cuenta en un mismo lugar.</div></aside>
    </section>
  </main></div>;
}
