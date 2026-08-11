import Link from 'next/link';
import { ArrowUpRight, Building2, ConciergeBell, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import styles from './page.module.css';

const accessOptions = [
  {
    eyebrow: 'TEBURU CENTRAL',
    title: 'Plataforma',
    description: 'Crea restaurantes, controla su estado y entra a cada local en modo soporte.',
    href: '/admin/login?next=/platform&role=platform',
    action: 'Entrar como plataforma',
    icon: ShieldCheck,
    accent: 'coral',
  },
  {
    eyebrow: 'GESTIÓN DEL LOCAL',
    title: 'Administrador',
    description: 'Configura el menú, las mesas, el equipo, la cocina y la identidad del restaurante.',
    href: '/admin/login?role=admin',
    action: 'Administrar restaurante',
    icon: Building2,
    accent: 'cream',
  },
  {
    eyebrow: 'OPERACIÓN EN SALÓN',
    title: 'Mesero',
    description: 'Activa mesas, sigue pedidos, atiende llamados y gestiona solicitudes de cobro.',
    href: '/admin/login?role=waiter',
    action: 'Entrar como mesero',
    icon: ConciergeBell,
    accent: 'green',
  },
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.texture} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Inicio de Teburu">
          <span className={styles.brandMark}><UtensilsCrossed size={21} /></span>
          <span>teburu</span>
        </Link>
        <span className={styles.privateLabel}>Acceso privado</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.intro}>
          <p className={styles.kicker}>RESTAURANT OPERATING SYSTEM</p>
          <h1>¿Cómo vas a<br /><em>trabajar hoy?</em></h1>
          <p className={styles.lede}>Selecciona tu espacio de trabajo. Cada perfil abre únicamente las herramientas que necesita para operar.</p>
        </div>

        <div className={styles.accessGrid}>
          {accessOptions.map(({ eyebrow, title, description, href, action, icon: Icon, accent }, index) => (
            <Link key={title} href={href} className={`${styles.accessCard} ${styles[accent]}`} style={{ animationDelay: `${160 + index * 90}ms` }}>
              <div className={styles.cardTop}>
                <span className={styles.cardIcon}><Icon size={24} /></span>
                <span className={styles.cardNumber}>0{index + 1}</span>
              </div>
              <div>
                <p className={styles.cardEyebrow}>{eyebrow}</p>
                <h2>{title}</h2>
                <p className={styles.cardDescription}>{description}</p>
              </div>
              <span className={styles.cardAction}>{action}<ArrowUpRight size={18} /></span>
            </Link>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Los clientes acceden exclusivamente al escanear el QR de una mesa activa.</span>
        <span className={styles.footerDot} aria-hidden="true" />
        <span>Operación segura por restaurante</span>
      </footer>
    </main>
  );
}
