import Link from 'next/link';
import { UtensilsCrossed } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className="screen-centered">
      <div className={`glass-panel animate-fade-up ${styles.card}`}>
        <div className={styles.iconWrapper}>
          <UtensilsCrossed size={48} color="var(--primary)" />
        </div>
        
        <h1 className={styles.title}>teburu</h1>
        <p className={styles.subtitle}>Selecciona cómo deseas ingresar</p>
        
        <div className={styles.actions}>
          <Link href="/admin/login" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ width: '100%' }}>
              Acceso Staff (Administración)
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
