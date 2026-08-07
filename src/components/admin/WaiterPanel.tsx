import { useState, useEffect } from 'react';
import { staffFetch } from '@/lib/api-client';
import { RefreshCw, QrCode, Key, AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';

export default function WaiterPanel() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [lastActivation, setLastActivation] = useState<{ pin: string; tables: number[] } | null>(null);

  const loadTables = async () => {
    setLoading(true);
    try {
      const res = await staffFetch('/api/salon');
      const { data } = await res.json();
      if (data) setTables(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTables();
    const interval = setInterval(loadTables, 10000); // Refrescar cada 10 segs
    return () => clearInterval(interval);
  }, []);

  const activateTables = async (tableIds: string[]) => {
    try {
      const res = await staffFetch('/api/table/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_ids: tableIds })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'No se pudo activar la mesa');
      setLastActivation({ pin: payload.pin, tables: payload.tables.map((table: { table_number: number }) => table.table_number) });
      setSelectedTableIds([]);
      await loadTables();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo activar la mesa');
    }
  };

  const toggleTable = (tableId: string) => {
    setSelectedTableIds((current) => current.includes(tableId) ? current.filter((id) => id !== tableId) : [...current, tableId]);
  };

  const clearNeedsAttention = async (tableId: string) => {
    try {
      const res = await staffFetch('/api/table/attention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, needs_attention: false })
      });
      if (res.ok) loadTables();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckout = async (tableId: string) => {
    if (!window.confirm("¿Estás seguro de cerrar la mesa? Esto borrará el PIN y la dejará disponible para nuevos clientes.")) return;
    try {
      const res = await staffFetch('/api/table/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId })
      });
      if (res.ok) loadTables();
    } catch (err) {
      console.error(err);
    }
  };

  const deliverOrder = async (orderId: string) => {
    try {
      const res = await staffFetch('/api/orders/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'No se pudo confirmar la entrega');
      await loadTables();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo confirmar la entrega');
    }
  };

  if (loading && tables.length === 0) return <div>Cargando salón...</div>;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Salón y Mesas</h2>
          <p style={{ color: 'var(--text-muted)' }}>Activa mesas y monitorea los pedidos de tus clientes.</p>
        </div>
        <button className="btn-secondary" onClick={loadTables} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} /> Actualizar
        </button>
      </div>

      {lastActivation && (
        <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '10px', background: 'rgba(46, 213, 115, 0.12)', border: '1px solid #2ed573' }}>
          <strong>Mesas {lastActivation.tables.join(', ')} activadas.</strong> PIN temporal: <span style={{ fontSize: '1.35rem', letterSpacing: '3px' }}>{lastActivation.pin}</span>
          <div style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--text-muted)' }}>El QR impreso de cualquiera de estas mesas abre la misma cuenta.</div>
        </div>
      )}

      {selectedTableIds.length > 0 && (
        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center', padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)' }}>
          <span>{selectedTableIds.length} mesa(s) seleccionada(s)</span>
          <button className="btn-primary" onClick={() => void activateTables(selectedTableIds)}>
            Activar {selectedTableIds.length > 1 ? 'como grupo' : 'mesa'}
          </button>
          <button className="btn-secondary" onClick={() => setSelectedTableIds([])}>Cancelar</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {tables.map(table => (
          <div key={table.id} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: table.needs_attention ? '2px solid #ffa502' : '1px solid var(--border-color)', position: 'relative' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: table.status === 'occupied' ? 'rgba(255,71,87,0.1)' : 'rgba(255,255,255,0.05)', color: table.status === 'occupied' ? 'var(--primary)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {table.table_number}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Mesa {table.table_number}</h3>
                  <span style={{ fontSize: '0.8rem', color: table.status === 'occupied' ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {table.status === 'occupied' ? 'Ocupada' : 'Libre'}
                  </span>
                  {table.status === 'occupied' && table.group_table_numbers?.length > 1 && (
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>Grupo: mesas {table.group_table_numbers.join(', ')}</span>
                  )}
                </div>
              </div>

              {table.needs_attention && (
                <div style={{ background: '#ffa502', color: 'black', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={14} /> ¡Llamado!
                </div>
              )}
            </div>

            {/* Pedidos Activos si está ocupada */}
            {table.status === 'occupied' && (
              <div style={{ marginBottom: '24px', maxHeight: '150px', overflowY: 'auto' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Pedidos Activos</h4>
                {table.active_orders && table.active_orders.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {table.active_orders.map((order: any) => (
                      <li key={order.order_id} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{order.customer_name}: </span>
                        {order.items?.map((item: any) => `${item.quantity}x ${item.menu_item}`).join(', ')}
                        <br/>
                        <span style={{ fontSize: '0.75rem', color: order.status === 'pending' ? '#ffa502' : order.status === 'preparing' ? '#2ed573' : 'var(--text-muted)' }}>
                          Estado: {order.status}
                        </span>
                        {order.status === 'ready' && (
                          <button className="btn-primary" onClick={() => void deliverOrder(order.order_id)} style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <PackageCheck size={16} /> Confirmar entrega
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin pedidos aún.</p>
                )}
              </div>
            )}

            {/* Acciones del Mesero */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              {table.status === 'available' ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', gap: '7px', alignItems: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={selectedTableIds.includes(table.id)} onChange={() => toggleTable(table.id)} /> Combinar
                  </label>
                  <button className="btn-primary" onClick={() => void activateTables([table.id])} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <QrCode size={18} /> Activar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Key size={18} color="var(--primary)" /><span style={{ color: 'var(--text-muted)' }}>PIN:</span></div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px' }}>{table.access_code}</span>
                  </div>
                  {table.needs_attention && (
                    <button className="btn-secondary" onClick={() => clearNeedsAttention(table.id)} style={{ width: '100%', borderColor: '#ffa502', color: '#ffa502' }}>
                      Apagar Alerta de Llamado
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => handleCheckout(table.id)} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                    <CheckCircle2 size={18} /> Liberar Mesa (Cobrar)
                  </button>
                </div>
              )}
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
}
