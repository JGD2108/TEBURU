import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserPlus, UserCircle2 } from 'lucide-react';

export default function StaffPanel() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'waiter' });
  const [apiMessage, setApiMessage] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    const { data } = await supabase.from('staff').select('*').order('created_at', { ascending: true });
    if (data) setStaff(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiMessage('Creando empleado... esto no cerrará tu sesión.');
    
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok) {
        setApiMessage(`¡Éxito! El empleado fue creado. Contraseña temporal: Teburu2026_`);
        setFormData({ name: '', email: '', role: 'waiter' });
        loadStaff();
      } else {
        setApiMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setApiMessage(`Error: ${err.message}`);
    }
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, { label: string, bg: string }> = {
      'admin': { label: 'Admin', bg: 'rgba(255, 71, 87, 0.2)' },
      'waiter': { label: 'Mesero', bg: 'rgba(46, 213, 115, 0.2)' },
      'kitchen': { label: 'Cocina', bg: 'rgba(255, 165, 2, 0.2)' }
    };
    const mapped = map[role] || { label: role, bg: 'var(--bg-base)' };
    return (
      <span style={{ background: mapped.bg, padding: '4px 12px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600 }}>
        {mapped.label}
      </span>
    );
  };

  if (loading) return <div>Cargando equipo...</div>;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Gestión de Equipo (Staff)</h2>
        <button className="btn-primary" onClick={() => setIsCreating(!isCreating)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} /> {isCreating ? 'Cancelar' : 'Nuevo Empleado'}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Nombre Completo</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Correo Electrónico (Acceso)</label>
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} />
            </div>
            <div style={{ width: '200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Rol Asignado</label>
              <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }}>
                <option value="waiter">Mesero (Salón)</option>
                <option value="kitchen">Cocinero (KDS)</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{apiMessage}</span>
            <button type="submit" className="btn-primary">Registrar Empleado</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {staff.map(user => (
          <div key={user.id} style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCircle2 size={24} color="var(--text-muted)" />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user.name}</p>
              <div style={{ marginTop: '8px' }}>
                {getRoleBadge(user.role)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
