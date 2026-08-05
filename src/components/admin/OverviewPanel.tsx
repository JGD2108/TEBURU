import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, AlertCircle, BellRing, UserCheck } from 'lucide-react';

export default function OverviewPanel() {
  const [tables, setTables] = useState<any[]>([]);
  const [waiters, setWaiters] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [tRes, sRes, oRes] = await Promise.all([
      supabase.from('tables').select('*, assigned_waiter:staff(name)').order('table_number', { ascending: true }),
      supabase.from('staff').select('user_id, name').eq('role', 'waiter'),
      supabase.from('orders').select('id, status, created_at, session:sessions(tables(table_number)), items:order_items(quantity, menu_items(name))').in('status', ['pending', 'cooking']).order('created_at', { ascending: false })
    ]);
    if (tRes.data) setTables(tRes.data);
    if (sRes.data) setWaiters(sRes.data);
    if (oRes.data) setOrders(oRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // Suscripción básica en tiempo real opcional, por ahora polling manual o reload
    const interval = setInterval(loadData, 15000); // Polling cada 15 seg
    return () => clearInterval(interval);
  }, []);

  const handleAssignWaiter = async (tableId: string, waiterId: string) => {
    await supabase.from('tables').update({ assigned_waiter_id: waiterId || null }).eq('id', tableId);
    loadData();
  };

  const handleCallWaiter = async (tableId: string, currentState: boolean) => {
    await supabase.from('tables').update({ needs_attention: !currentState }).eq('id', tableId);
    loadData();
  };

  if (loading && tables.length === 0) return <div>Cargando centro de control...</div>;

  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  const occupancyRate = tables.length > 0 ? Math.round((occupiedTables / tables.length) * 100) : 0;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Centro de Control en Vivo</h2>
          <p style={{ color: 'var(--text-muted)' }}>Monitorea el estado del piso y los pedidos en tiempo real.</p>
        </div>
        <button className="btn-secondary" onClick={loadData}>Actualizar Datos</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: 'var(--bg-surface-elevated)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--primary)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Ocupación Actual</p>
          <h3 style={{ fontSize: '2rem', margin: 0 }}>{occupancyRate}%</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{occupiedTables} de {tables.length} mesas</p>
        </div>
        <div style={{ background: 'var(--bg-surface-elevated)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #2ed573' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Pedidos en Proceso</p>
          <h3 style={{ fontSize: '2rem', margin: 0 }}>{orders.length}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>En cocina o pendientes</p>
        </div>
        <div style={{ background: 'var(--bg-surface-elevated)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #ffa502' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Mesas Necesitan Atención</p>
          <h3 style={{ fontSize: '2rem', margin: 0 }}>{tables.filter(t => t.needs_attention).length}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Llamados activos</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Monitoreo de Mesas */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--primary)" /> Staff en Piso
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tables.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No hay mesas creadas.</p> : null}
            {tables.map(table => (
              <div key={table.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-base)', borderRadius: '8px', border: table.needs_attention ? '1px solid #ffa502' : '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: table.status === 'occupied' ? 'rgba(255,71,87,0.1)' : 'rgba(255,255,255,0.05)', color: table.status === 'occupied' ? 'var(--primary)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {table.table_number}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>Mesa {table.table_number}</p>
                    <p style={{ fontSize: '0.8rem', color: table.status === 'occupied' ? 'var(--primary)' : 'var(--text-muted)', margin: 0 }}>
                      {table.status === 'occupied' ? 'Ocupada' : 'Disponible'}
                    </p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <select 
                    value={table.assigned_waiter_id || ''} 
                    onChange={e => handleAssignWaiter(table.id, e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'white', minWidth: '150px' }}
                  >
                    <option value="">Sin asignar</option>
                    {waiters.map(w => <option key={w.user_id} value={w.user_id}>{w.name}</option>)}
                  </select>

                  <button 
                    onClick={() => handleCallWaiter(table.id, table.needs_attention)}
                    title="Mandar Mesero"
                    style={{ background: table.needs_attention ? '#ffa502' : 'var(--bg-surface)', color: table.needs_attention ? '#000' : 'var(--text-main)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                  >
                    {table.needs_attention ? <AlertCircle size={16} /> : <BellRing size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Orders Feed */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Pedidos en Proceso</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay pedidos activos ahora mismo.</p> : null}
            {orders.map(order => {
              const tableNum = order.session?.tables?.table_number || '?';
              return (
                <div key={order.id} style={{ padding: '16px', background: 'var(--bg-base)', borderRadius: '8px', borderLeft: order.status === 'cooking' ? '3px solid #ffa502' : '3px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>Mesa {tableNum}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{order.status === 'cooking' ? 'En Cocina' : 'Pendiente'}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {order.items?.map((item: any, idx: number) => (
                      <li key={idx}>{item.quantity}x {item.menu_items?.name}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
