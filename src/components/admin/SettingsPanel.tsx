import { useState, useEffect } from 'react';
import { staffFetch } from '@/lib/api-client';
import { Save } from 'lucide-react';

export default function SettingsPanel() {
  const [settings, setSettings] = useState({ id: '', name: '', logo_url: '', primary_color: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    const response = await staffFetch('/api/admin/settings');
    const payload = await response.json();
    if (response.ok && payload.data) setSettings(payload.data);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const response = await staffFetch('/api/admin/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error || 'No se pudieron guardar los ajustes.');
      setSaving(false);
      return;
    }
    
    // Inyectar el color en vivo en el admin también para que vea el cambio inmediato
    if (settings.primary_color) {
      document.documentElement.style.setProperty('--primary', settings.primary_color);
    }
    
    alert('Ajustes guardados correctamente.');
    setSaving(false);
  };

  if (loading) return <div>Cargando ajustes...</div>;

  return (
    <div className="animate-fade-up">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Ajustes Globales y Personalización</h2>

      <form onSubmit={handleSave} style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', maxWidth: '600px' }}>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Nombre del Restaurante</label>
          <input 
            type="text" 
            value={settings.name || ''} 
            onChange={e => setSettings({...settings, name: e.target.value})} 
            style={{ width: '100%', padding: '12px', borderRadius: '6px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white', fontSize: '1rem' }} 
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>URL del Logotipo</label>
          <input 
            type="url" 
            value={settings.logo_url || ''} 
            onChange={e => setSettings({...settings, logo_url: e.target.value})} 
            style={{ width: '100%', padding: '12px', borderRadius: '6px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white', fontSize: '1rem' }} 
          />
          {settings.logo_url && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Vista Previa:</p>
              <img src={settings.logo_url} alt="Logo Preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
            </div>
          )}
        </div>

        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Color de la Marca (Color Primario)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input 
              type="color" 
              value={settings.primary_color || '#ff4757'} 
              onChange={e => setSettings({...settings, primary_color: e.target.value})} 
              style={{ width: '60px', height: '60px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }} 
            />
            <input 
              type="text" 
              value={settings.primary_color || ''} 
              onChange={e => setSettings({...settings, primary_color: e.target.value})} 
              style={{ flex: 1, padding: '12px', borderRadius: '6px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white', fontSize: '1rem' }} 
            />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Este color reemplazará el tono principal (botones, iconos, luces) en toda la aplicación de los clientes.
          </p>
        </div>

        <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center', padding: '14px' }}>
          <Save size={20} /> {saving ? 'Guardando...' : 'Guardar Ajustes Globales'}
        </button>

      </form>

      {/* Danger Zone */}
      <div style={{ marginTop: '40px', padding: '32px', border: '1px solid #ff4757', borderRadius: '8px', background: 'rgba(255, 71, 87, 0.05)', maxWidth: '600px' }}>
        <h3 style={{ color: '#ff4757', fontSize: '1.2rem', marginBottom: '8px' }}>Zona de Peligro: Pruebas en Caliente</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
          Utiliza este botón para purgar todos los datos de prueba (Pedidos, Clientes y Sesiones). 
          Tus Platillos, Mesas y Staff (empleados) se mantendrán intactos para que puedas seguir probando fluidamente.
        </p>
        <button 
          type="button"
          onClick={async () => {
            if (confirm("¿Estás seguro de que quieres eliminar todos los pedidos y liberar todas las mesas?")) {
              const res = await staffFetch('/api/reset-test-data', { method: 'POST' });
              if (res.ok) alert("¡Limpieza completada! El restaurante está como nuevo.");
              else alert("Error al limpiar la base de datos.");
            }
          }}
          style={{ background: '#ff4757', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Limpiar Sesiones y Pedidos (Reset)
        </button>
      </div>

    </div>
  );
}
