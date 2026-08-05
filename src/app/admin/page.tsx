"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, LayoutDashboard, Settings, UtensilsCrossed, Users, Grid, ChefHat, BookOpen, Armchair } from 'lucide-react';

import MenuPanel from '@/components/admin/MenuPanel';
import StaffPanel from '@/components/admin/StaffPanel';
import SettingsPanel from '@/components/admin/SettingsPanel';
import TablesManagerPanel from '@/components/admin/TablesManagerPanel';
import OverviewPanel from '@/components/admin/OverviewPanel';
import WaiterPanel from '@/components/admin/WaiterPanel';
import HistoryPanel from '@/components/admin/HistoryPanel';
import KitchenPanel from '@/components/admin/KitchenPanel';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [staffData, setStaffData] = useState<{ name: string, role: string } | null>(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    async function verifyProtection() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/admin/login'); return; }

      const { data: { currentLevel } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (currentLevel !== 'aal2') { router.push('/admin/login'); return; }

      const { data: staff } = await supabase.from('staff').select('name, role').eq('user_id', session.user.id).single();

      if (staff) {
        setStaffData(staff as { name: string, role: string });
        // Set default tab based on role
        if (staff.role === 'waiter') setActiveTab('tables');
        if (staff.role === 'kitchen') setActiveTab('kds');
      } else {
        setStaffData({ name: 'Usuario Nuevo', role: 'admin' });
      }

      setUserEmail(session.user.email ?? null);
      setUserId(session.user.id);
      setLoading(false);
    }
    verifyProtection();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (loading) return <div className="screen-centered" style={{ background: 'var(--bg-base)' }}><p style={{ color: 'var(--text-muted)' }}>Verificando credenciales de seguridad...</p></div>;

  const roleName = staffData?.role === 'admin' ? 'Administrador' : staffData?.role === 'waiter' ? 'Mesero' : 'Cocina';

  const NavButton = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => {
    const isActive = activeTab === id;
    return (
      <button 
        className="btn-secondary" 
        onClick={() => setActiveTab(id)}
        style={{ 
          textAlign: 'left', display: 'flex', gap: '12px', alignItems: 'center', 
          background: isActive ? 'rgba(255,71,87,0.1)' : 'transparent', 
          color: isActive ? 'var(--primary)' : 'var(--text-main)', 
          borderColor: isActive ? 'var(--primary)' : 'transparent',
          border: isActive ? '1px solid' : 'none'
        }}
      >
        <Icon size={18} /> {label}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <UtensilsCrossed size={28} color="var(--primary)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Teburu OS</h2>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {staffData?.role === 'admin' && (
            <>
              <NavButton id="overview" icon={LayoutDashboard} label="Resumen General" />
              <NavButton id="menu" icon={BookOpen} label="Menú y Platillos" />
              <NavButton id="staff" icon={Users} label="Gestión de Staff" />
              <NavButton id="admin_tables" icon={Armchair} label="Estructura de Mesas" />
              <NavButton id="history" icon={BookOpen} label="Historial de Cajas" />
              <NavButton id="kds" icon={ChefHat} label="Monitor Cocina (KDS)" />
              <NavButton id="settings" icon={Settings} label="Ajustes Globales" />
            </>
          )}
          {staffData?.role === 'waiter' && <NavButton id="tables" icon={Grid} label="Salón y Mesas" />}
          {staffData?.role === 'kitchen' && <NavButton id="kds" icon={ChefHat} label="Comandas KDS" />}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{staffData?.name}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Rol: {roleName}</p>
          </div>
          <button className="btn-secondary" onClick={handleLogout} style={{ width: '100%', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        {/* Admin Views */}
        {staffData?.role === 'admin' && activeTab === 'overview' && <OverviewPanel />}
        {staffData?.role === 'admin' && activeTab === 'menu' && <MenuPanel />}
        {staffData?.role === 'admin' && activeTab === 'staff' && <StaffPanel />}
        {staffData?.role === 'admin' && activeTab === 'settings' && <SettingsPanel />}
        {staffData?.role === 'admin' && activeTab === 'admin_tables' && <TablesManagerPanel />}
        {staffData?.role === 'admin' && activeTab === 'history' && <HistoryPanel />}
        {staffData?.role === 'admin' && activeTab === 'kds' && <KitchenPanel />}

        {/* Waiter View */}
        {staffData?.role === 'waiter' && activeTab === 'tables' && <WaiterPanel waiterId={userId} />}

        {/* Kitchen View */}
        {staffData?.role === 'kitchen' && activeTab === 'kds' && <KitchenPanel />}

      </main>
    </div>
  );
}
