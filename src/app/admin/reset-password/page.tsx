"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, Key } from 'lucide-react';
import styles from '../login/login.module.css';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Si hay un hash en la URL (como access_token) Supabase lo procesa automáticamente.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('El enlace de recuperación es inválido o ha expirado.');
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      
      // Aviso: La columna password_hash de la tabla public.staff se desincronizará a menos 
      // que construyamos un endpoint que la actualice usando el RLS correcto.
      // Por simplicidad para el MVP, confiamos en auth.users como fuente de verdad.
      
      setTimeout(() => {
        router.push('/admin/login');
      }, 3000);
    }
    setLoading(false);
  };

  return (
    <main className="screen-centered" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className={`glass-panel animate-fade-up ${styles.card}`}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Lock size={32} color="var(--primary)" />
          </div>
          <h1 className={styles.title}>Restablecer Contraseña</h1>
          <p className={styles.subtitle}>Teburu Restaurant OS</p>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}
        
        {success ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <h2 style={{ color: 'var(--primary)', marginBottom: '16px' }}>¡Contraseña actualizada!</h2>
            <p style={{ color: 'var(--text-muted)' }}>Redirigiendo al inicio de sesión...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Nueva Contraseña</label>
              <div className={styles.inputWrapper}>
                <Key size={18} className={styles.inputIcon} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '16px' }}>
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
