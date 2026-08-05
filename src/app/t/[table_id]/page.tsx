"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './table.module.css';

export default function TableLogin() {
  const params = useParams();
  const router = useRouter();
  const table_id = params.table_id as string;
  
  const [step, setStep] = useState<'landing' | 'code'>('landing');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [restaurantLogo, setRestaurantLogo] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('Cargando...');

  // Cargar configuración global (Logo del restaurante)
  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase.from('restaurant_settings').select('*').limit(1).single();
      if (data) {
        setRestaurantLogo(data.logo_url);
        setRestaurantName(data.name);
      } else {
        setRestaurantName('Teburu');
      }
    }
    loadSettings();
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!code || !name) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setIsLoading(true);
    
    try {
      const res = await fetch('/api/table/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id, code, name })
      });

      const data = await res.json();

      if (res.ok) {
        // Guardar la sesión real en el navegador
        sessionStorage.setItem('teburu_customer_name', name);
        sessionStorage.setItem('teburu_session_id', data.session_id);
        sessionStorage.setItem('teburu_session_user_id', data.session_user_id);
        
        router.push(`/t/${table_id}/menu`);
      } else {
        setError(data.error || 'Código incorrecto. Verifica con tu mesero.');
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="screen-centered">
      <div className={`glass-panel animate-fade-up ${styles.loginCard}`}>
        
        {step === 'landing' ? (
          <div className={styles.landingContent}>
            {restaurantLogo ? (
              <img src={restaurantLogo} alt="Restaurant Logo" className={styles.logoImage} />
            ) : (
              <div className={styles.iconWrapper}>
                <Building2 size={48} color="var(--primary)" />
              </div>
            )}
            
            <h1 className={styles.title}>{restaurantName}</h1>
            <p className={styles.subtitle}>Mesa asignada: {table_id.slice(0, 4).toUpperCase()}</p>
            
            <div className={styles.actions}>
              <button className="btn-primary" style={{ width: '100%', marginBottom: '12px' }} onClick={() => setStep('code')}>
                Activar Mesa
              </button>
            </div>
          </div>
        ) : (
          <div className={`${styles.formContent} animate-fade-up`}>
            <button className={styles.backBtn} onClick={() => setStep('landing')}>
              <ChevronLeft size={20} /> Volver
            </button>
            
            <div className={styles.headerForm}>
              <h2>Unirse a la Mesa</h2>
              <p className={styles.tableRef}>Mesa Ref: <strong>{table_id.slice(0, 4).toUpperCase()}</strong></p>
            </div>

            <form onSubmit={handleJoin} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="code">Código de acceso</label>
                <input 
                  type="text" 
                  id="code"
                  placeholder="Ej. 1234" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={4}
                  className={styles.input}
                  autoComplete="off"
                />
                <span className={styles.hint}>Dile a un mesero que te dé el código de la mesa</span>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="name">Tu nombre</label>
                <input 
                  type="text" 
                  id="name"
                  placeholder="¿Cómo te llamas?" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.input}
                  autoComplete="off"
                />
              </div>

              {error && <div className={styles.errorMessage}>{error}</div>}

              <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '16px' }}>
                {isLoading ? 'Conectando...' : (
                  <>
                    Entrar al menú <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
