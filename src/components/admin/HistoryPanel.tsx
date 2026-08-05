import { useState, useEffect } from 'react';
import { RefreshCw, Clock, DollarSign, User, ReceiptText } from 'lucide-react';

export default function HistoryPanel() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const { data } = await res.json();
      if (data) setSessions(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  if (loading) return <div>Cargando historial...</div>;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Historial de Cajas</h2>
          <p style={{ color: 'var(--text-muted)' }}>Registro inmutable de todas las mesas cerradas y quién las atendió.</p>
        </div>
        <button className="btn-secondary" onClick={loadHistory} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} /> Actualizar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sessions.length === 0 ? (
          <div className="screen-centered">
            <p style={{ color: 'var(--text-muted)' }}>No hay sesiones cerradas en el historial.</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.session_id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              
              {/* Header de la Sesión */}
              <div 
                style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'center', cursor: 'pointer', background: expandedSession === session.session_id ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                onClick={() => setExpandedSession(expandedSession === session.session_id ? null : session.session_id)}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)' }}>Mesa {session.table_number}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <Clock size={14} /> 
                    {new Date(session.started_at).toLocaleTimeString()} - {new Date(session.ended_at).toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={18} color="var(--text-muted)" />
                  <span style={{ fontWeight: 500 }}>{session.waiter_name || 'Desconocido'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ReceiptText size={18} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{session.orders_detail?.length || 0} pedidos</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', fontSize: '1.5rem', fontWeight: 700 }}>
                  <DollarSign size={24} color="var(--primary)" />
                  {Number(session.total_spent).toFixed(2)}
                </div>
              </div>

              {/* Detalle Desplegable */}
              {expandedSession === session.session_id && (
                <div style={{ padding: '24px', borderTop: '1px dashed var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--text-main)' }}>Desglose de Pedidos</h4>
                  
                  {(!session.orders_detail || session.orders_detail.length === 0) ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No se registraron pedidos en esta sesión.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {session.orders_detail.map((order: any, idx: number) => (
                        <div key={idx} style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>👤 {order.customer_name}</span>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {order.items?.map((item: any, i: number) => (
                              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span>{item.quantity}x {item.menu_item}</span>
                                <span style={{ color: 'var(--text-muted)' }}>${(item.quantity * item.price).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
            </div>
          ))
        )}
      </div>
    </div>
  );
}
