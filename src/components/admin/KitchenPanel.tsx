import { useState, useEffect } from 'react';
import { Clock, ChefHat, CheckCircle2, AlertCircle } from 'lucide-react';

export default function KitchenPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/kds');
      const { data } = await res.json();
      if (data) setOrders(data);
    } catch (err) {
      console.error("Error al cargar KDS", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000); // Polling cada 10 segs
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/kds/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: newStatus })
      });
      if (res.ok) {
        // Actualizar UI optimísticamente o recargar
        loadOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getElapsedTime = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Justo ahora';
    return `Hace ${minutes} min`;
  };

  if (loading && orders.length === 0) return <div>Cargando comandas...</div>;

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');

  const Ticket = ({ order }: { order: any }) => (
    <div style={{ 
      background: order.status === 'pending' ? 'rgba(255, 165, 2, 0.1)' : 'rgba(46, 213, 115, 0.1)', 
      border: `2px solid ${order.status === 'pending' ? '#ffa502' : '#2ed573'}`,
      borderRadius: '12px', 
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Mesa {order.table_number}</h3>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>👤 {order.customer_name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', color: order.status === 'pending' ? '#ffa502' : '#2ed573' }}>
          <Clock size={16} /> {getElapsedTime(order.created_at)}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {order.items?.map((item: any, idx: number) => (
            <li key={idx} style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--primary)', marginRight: '8px' }}>{item.quantity}x</span>
              {item.menu_item}
              {item.notes && (
                <div style={{ fontSize: '0.9rem', color: '#ffa502', background: 'rgba(255, 165, 2, 0.15)', padding: '4px 8px', borderRadius: '4px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 400 }}>
                  <AlertCircle size={14} /> {item.notes}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {order.status === 'pending' ? (
          <button 
            className="btn-primary" 
            style={{ width: '100%', height: '56px', fontSize: '1.1rem', background: '#ffa502', color: 'black' }}
            onClick={() => updateStatus(order.order_id, 'preparing')}
          >
            <ChefHat size={20} style={{ marginRight: '8px' }}/>
            Empezar a Cocinar
          </button>
        ) : (
          <button 
            className="btn-primary" 
            style={{ width: '100%', height: '56px', fontSize: '1.1rem', background: '#2ed573', color: 'black' }}
            onClick={() => updateStatus(order.order_id, 'ready')}
          >
            <CheckCircle2 size={20} style={{ marginRight: '8px' }}/>
            ¡Listo para Entregar!
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-up" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>Monitor de Cocina (KDS)</h2>
          <p style={{ color: 'var(--text-muted)' }}>Órdenes en tiempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: '24px', fontSize: '1.2rem', fontWeight: 600 }}>
          <span style={{ color: '#ffa502' }}>{pendingOrders.length} Nuevas</span>
          <span style={{ color: '#2ed573' }}>{preparingOrders.length} En Preparación</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', flex: 1, overflow: 'hidden' }}>
        
        {/* Columna Pendientes */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: '#ffa502', borderBottom: '2px solid #ffa502', paddingBottom: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={24} /> Nuevas Órdenes
          </h3>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px' }}>
            {pendingOrders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No hay órdenes nuevas.</p>
            ) : (
              pendingOrders.map(order => <Ticket key={order.order_id} order={order} />)
            )}
          </div>
        </div>

        {/* Columna Cocinando */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: '#2ed573', borderBottom: '2px solid #2ed573', paddingBottom: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ChefHat size={24} /> En Preparación
          </h3>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px' }}>
            {preparingOrders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No hay platillos en preparación.</p>
            ) : (
              preparingOrders.map(order => <Ticket key={order.order_id} order={order} />)
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
