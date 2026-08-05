import { useState, useEffect } from 'react';
import { RefreshCw, QrCode, Key, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function WaiterPanel({ waiterId }: { waiterId?: string | null }) {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTables = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/salon');
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

  const generatePin = async (tableId: string) => {
    try {
      const res = await fetch('/api/table/generate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, waiter_id: waiterId })
      });
      if (res.ok) loadTables();
    } catch (err) {
      console.error(err);
    }
  };

  const clearNeedsAttention = async (tableId: string) => {
    try {
      const res = await fetch('/api/table/attention', {
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
      const res = await fetch('/api/table/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId })
      });
      if (res.ok) loadTables();
    } catch (err) {
      console.error(err);
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
                        <span style={{ fontSize: '0.75rem', color: order.status === 'pending' ? '#ffa502' : order.status === 'cooking' ? '#2ed573' : 'var(--text-muted)' }}>
                          Estado: {order.status}
                        </span>
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
                table.access_code ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Key size={18} color="var(--primary)" />
                      <span style={{ color: 'var(--text-muted)' }}>PIN:</span>
                    </div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px' }}>{table.access_code}</span>
                  </div>
                ) : (
                  <button className="btn-primary" onClick={() => generatePin(table.id)} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <QrCode size={18} /> Habilitar Mesa
                  </button>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
