"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, Key, ShieldCheck } from 'lucide-react';
import styles from './login.module.css';
import DemoBar from '@/components/DemoBar';
import { isLocalDemo } from '@/lib/demo';

type AuthStep = 'login' | 'setup_2fa' | 'verify_2fa' | 'forgot_password';

async function accessDestination(accessToken: string) {
  window.localStorage.removeItem('teburu_restaurant_id');
  const response = await fetch('/api/auth/destination', { headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'No se pudo determinar el acceso de esta cuenta.');
  return payload.data.destination as '/platform' | '/admin';
}

export default function AdminLogin() {
  const router = useRouter();
  
  const [step, setStep] = useState<AuthStep>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // 2FA Setup State
  const [factorId, setFactorId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Redirigir si ya tiene sesión activa (2FA desactivado para desarrollo)
    async function checkAuth() {
      if (isLocalDemo()) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          router.replace(await accessDestination(session.access_token));
        } catch (accessError) {
          await supabase.auth.signOut();
          setError(accessError instanceof Error ? accessError.message : 'Cuenta no autorizada.');
        }
      }
    }
    checkAuth();
  }, [router]);

  if (isLocalDemo()) return <div className="app-shell"><DemoBar /><main className="screen-centered"><section className="surface-card" style={{ width: 'min(580px, 100%)', padding: 'clamp(26px, 6vw, 52px)' }}><p className="eyebrow">Demo local</p><h1 className="display" style={{ margin: 0 }}>Elige un punto de vista.</h1><p style={{ margin: '18px 0 28px' }}>Este acceso no usa Vercel, Supabase ni credenciales. Solo existe mientras el modo demo local esté activo.</p><div style={{ display: 'grid', gap: 10 }}><button className="btn-primary" onClick={() => router.push('/platform?demo=platform')}>Ver plataforma</button><button className="btn-secondary" onClick={() => router.push('/admin?demo=admin')}>Entrar como administrador</button><button className="btn-secondary" onClick={() => router.push('/admin?demo=waiter')}>Entrar como mesero</button><button className="btn-secondary" onClick={() => router.push('/admin?demo=kitchen')}>Entrar a cocina</button><button className="btn-secondary" onClick={() => router.push('/t/demo-table?demo=guest')}>Vivir experiencia de mesa</button></div></section></main></div>;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    try {
      router.replace(await accessDestination(data.session.access_token));
    } catch (accessError) {
      await supabase.auth.signOut();
      setError(accessError instanceof Error ? accessError.message : 'Cuenta no autorizada.');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`
    });
    
    if (error) {
      setError(error.message);
    } else {
      setError('Se ha enviado un correo con las instrucciones de recuperación. (Revisa tu bandeja de Spam)');
      setStep('login');
    }
    setLoading(false);
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setError(challenge.error.message);
      setLoading(false);
      return;
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: otpCode
    });

    if (verify.error) {
      setError("Código incorrecto.");
    } else {
      router.push('/admin');
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
          <h1 className={styles.title}>Acceso Teburu</h1>
          <p className={styles.subtitle}>Tu cuenta define el espacio de trabajo</p>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}

        {step === 'login' && (
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Correo Electrónico</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} className={styles.inputIcon} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@teburu.com" 
                  required
                />
              </div>
            </div>
            
            <div className={styles.inputGroup}>
              <label>Contraseña</label>
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
              {step === 'login' && (
                <button type="button" onClick={() => { setStep('forgot_password'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'right', marginTop: '8px', cursor: 'pointer' }}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '16px' }}>
              {loading ? 'Procesando...' : 'Iniciar Sesión'}
            </button>
          </form>
        )}

        {step === 'forgot_password' && (
          <form onSubmit={handleResetPassword} className={`${styles.form} animate-fade-up`}>
            <div className={styles.infoBox}>
              <Key size={24} color="var(--primary)" />
              <p>Recuperar Contraseña</p>
            </div>
            
            <p className={styles.instructions} style={{textAlign: 'center'}}>
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            
            <div className={styles.inputGroup}>
              <div className={styles.inputWrapper}>
                <Mail size={18} className={styles.inputIcon} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@teburu.com" 
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '16px' }}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <button type="button" className={styles.textBtn} onClick={() => setStep('login')}>
              Volver al Login
            </button>
          </form>
        )}

        {step === 'setup_2fa' && (
          <form onSubmit={verifyOTP} className={`${styles.form} animate-fade-up`}>
            <div className={styles.infoBox}>
              <ShieldCheck size={24} color="var(--primary)" />
              <p>Configuración de Seguridad 2FA</p>
            </div>
            
            <p className={styles.instructions}>
              1. Descarga <strong>Google Authenticator</strong> o <strong>Authy</strong>.<br/>
              2. Escanea el código QR a continuación.
            </p>
            
            <div className={styles.qrContainer}>
              {qrCodeUrl ? (
                <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
                  <QRCodeSVG value={qrCodeUrl} size={150} />
                </div>
              ) : (
                <p>Generando QR...</p>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label>3. Ingresa el código de 6 dígitos</label>
              <input 
                type="text" 
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Ej. 123456" 
                maxLength={6}
                required
                style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px' }}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Verificando...' : 'Completar Configuración'}
            </button>
          </form>
        )}

        {step === 'verify_2fa' && (
          <form onSubmit={verifyOTP} className={`${styles.form} animate-fade-up`}>
            <div className={styles.infoBox}>
              <ShieldCheck size={24} color="var(--primary)" />
              <p>Autenticación Requerida (2FA)</p>
            </div>
            
            <p className={styles.instructions} style={{textAlign: 'center'}}>
              Abre tu aplicación de autenticación e ingresa el código de 6 dígitos.
            </p>
            
            <div className={styles.inputGroup}>
              <input 
                type="text" 
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="------" 
                maxLength={6}
                required
                autoFocus
                className={styles.otpInput}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '16px' }}>
              {loading ? 'Verificando...' : 'Acceder al Panel'}
            </button>
            <button type="button" className={styles.textBtn} onClick={() => setStep('login')}>
              Volver
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
