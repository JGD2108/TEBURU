import Link from 'next/link';
import { ArrowUpRight, Fingerprint, UtensilsCrossed } from 'lucide-react';
import styles from './page.module.css';

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
          <h1>Una puerta.<br /><em>Tu espacio.</em></h1>
          <p className={styles.lede}>Ingresa con tus credenciales y Teburu abrirá automáticamente las herramientas que corresponden a tu cuenta.</p>
        </div>

        <Link href="/admin/login" className={`${styles.accessCard} ${styles.singleAccess}`}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}><Fingerprint size={29} /></span>
            <span className={styles.cardNumber}>ACCESO SEGURO</span>
          </div>
          <div>
            <p className={styles.cardEyebrow}>EQUIPO TEBURU</p>
            <h2>Ingresar</h2>
            <p className={styles.cardDescription}>El destino se asigna de forma privada según los permisos de tu cuenta.</p>
          </div>
          <span className={styles.cardAction}>Continuar al acceso<ArrowUpRight size={20} /></span>
        </Link>
      </section>

      <footer className={styles.footer}>
        <span>Los clientes acceden exclusivamente al escanear el QR de una mesa activa.</span>
        <span className={styles.footerDot} aria-hidden="true" />
        <span>Operación segura por restaurante</span>
      </footer>
    </main>
  );
}
