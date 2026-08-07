import { useState, useEffect, useRef } from 'react';
import { staffFetch } from '@/lib/api-client';
import { Trash2, Plus, QrCode, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function TablesManagerPanel() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [showQrFor, setShowQrFor] = useState<string | null>(null);
  const [settings, setSettings] = useState<{logo_url: string, primary_color: string}>({ logo_url: '', primary_color: '#ff4757' });
  const printRef = useRef<HTMLDivElement>(null);

  const loadTablesAndSettings = async () => {
    setLoading(true);
    const response = await staffFetch('/api/admin/tables');
    const payload = await response.json();
    if (response.ok) {
      setTables(payload.tables);
      if (payload.settings) setSettings(payload.settings);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTablesAndSettings();
  }, []);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber) return;

    const exists = tables.find(t => t.table_number === parseInt(newTableNumber));
    if (exists) {
      alert('Esta mesa ya existe.');
      return;
    }

    const response = await staffFetch('/api/admin/tables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_number: parseInt(newTableNumber) }),
    });
    const result = await response.json();
    
    if (!response.ok) alert("Error agregando mesa: " + (result.error || 'Error desconocido'));
    else { setNewTableNumber(''); loadTablesAndSettings(); }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta mesa?")) {
      const response = await staffFetch(`/api/admin/tables?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json();
        alert(result.error || 'No se pudo eliminar la mesa');
      }
      loadTablesAndSettings();
    }
  };

  const downloadPDF = async (tableNumber: number, tableId: string) => {
    const el = document.getElementById(`qr-print-${tableId}`);
    if (!el) return;
    
    // Mostramos el elemento temporalmente
    el.style.display = 'flex';
    
    try {
      const canvas = await html2canvas(el, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        logging: false,
        onclone: (clonedDoc) => {
          const printEl = clonedDoc.getElementById(`qr-print-${tableId}`);
          if (printEl) {
            printEl.style.display = 'flex';
            printEl.style.position = 'relative';
            printEl.style.top = '0';
            printEl.style.left = '0';
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      
      // Tamaño A6 vertical (105 x 148 mm aprox)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a6' });
      pdf.addImage(imgData, 'PNG', 0, 0, 105, 148);
      pdf.save(`Mesa_${tableNumber}_QR.pdf`);
    } catch (e) {
      console.error(e);
      alert('Error generando PDF');
    } finally {
      el.style.display = 'none';
    }
  };

  if (loading) return <div>Cargando mesas...</div>;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Gestión de Mesas</h2>
      </div>

      <form onSubmit={handleAddTable} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, maxWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Número de Mesa</label>
          <input required type="number" min="1" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} placeholder="Ej: 5" />
        </div>
        <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Agregar Mesa
        </button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {tables.map(table => {
          const qrUrl = `${window.location.origin}/t/${table.id}`;
          
          return (
            <div key={table.id} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--primary)' }}>Mesa {table.table_number}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {table.id.split('-')[0]}...</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowQrFor(showQrFor === table.id ? null : table.id)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '8px' }}>
                    <QrCode size={20} />
                  </button>
                  <button onClick={() => handleDelete(table.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'padding', padding: '8px' }}>
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {showQrFor === table.id && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', padding: '24px', borderRadius: '8px' }}>
                  <QRCodeSVG value={qrUrl} size={150} />
                  <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'black', textAlign: 'center', wordBreak: 'break-all' }}>
                    {qrUrl}
                  </p>
                  <button onClick={() => downloadPDF(table.table_number, table.id)} className="btn-primary" style={{ marginTop: '16px', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <Download size={18} /> Descargar PDF (A6)
                  </button>
                </div>
              )}

              {/* Plantilla oculta para el PDF (formato A6) */}
              <div id={`qr-print-${table.id}`} style={{ 
                display: 'none', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                width: '105mm', 
                height: '148mm', 
                background: 'white', 
                color: 'black',
                padding: '10mm',
                boxSizing: 'border-box',
                position: 'fixed',
                top: '-9999px',
                left: '-9999px',
                fontFamily: 'sans-serif'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  {settings.logo_url && <img src={settings.logo_url} crossOrigin="anonymous" alt="Logo" style={{ height: '60px', objectFit: 'contain' }} />}
                  <h1 style={{ fontSize: '32px', margin: '20px 0 0 0', color: settings.primary_color }}>Mesa {table.table_number}</h1>
                  <p style={{ fontSize: '14px', color: '#666', textAlign: 'center' }}>Escanea el código para ordenar</p>
                </div>
                
                <div style={{ padding: '20px', border: `3px solid ${settings.primary_color}`, borderRadius: '16px' }}>
                  <QRCodeSVG value={qrUrl} size={200} />
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <p style={{ fontSize: '10px', color: '#999', margin: 0 }}>Powered by Teburu OS</p>
                  <p style={{ fontSize: '10px', color: '#999', margin: 0, fontWeight: 'bold' }}>Teburu es una marca de Reiwa</p>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
