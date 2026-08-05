import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, Plus } from 'lucide-react';

export default function MenuPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: '',
    modifiable_ingredients: ''
  });

  const loadData = async () => {
    setLoading(true);
    const [catsRes, itemsRes] = await Promise.all([
      supabase.from('menu_categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*, category:menu_categories(name)').order('name', { ascending: true })
    ]);
    if (catsRes.data) setCategories(catsRes.data);
    if (itemsRes.data) setItems(itemsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      price: parseFloat(formData.price),
      modifiable_ingredients: formData.modifiable_ingredients || null
    };

    const { error } = await supabase.from('menu_items').insert([payload]);
    if (error) {
      alert("Error guardando: " + error.message);
    } else {
      setShowForm(false);
      setFormData({ name: '', description: '', price: '', category_id: categories[0]?.id || '', image_url: '', modifiable_ingredients: '' });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este platillo?")) {
      await supabase.from('menu_items').delete().eq('id', id);
      loadData();
    }
  };

  if (loading) return <div>Cargando menú...</div>;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Gestión del Menú</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> {showForm ? 'Cancelar' : 'Añadir Platillo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--border-color)', display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Nombre</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Precio ($)</label>
            <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Categoría</label>
            <select required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }}>
              <option value="">Selecciona...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>URL de la Imagen</label>
            <input required type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Descripción</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white', minHeight: '80px' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Ingredientes Modificables (separados por coma)</label>
            <input type="text" placeholder="ej: sin huevo,sin cebolla" value={formData.modifiable_ingredients} onChange={e => setFormData({...formData, modifiable_ingredients: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary">Guardar Platillo</button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--bg-surface)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '16px' }}>Platillo</th>
              <th style={{ padding: '16px' }}>Categoría</th>
              <th style={{ padding: '16px' }}>Precio</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                  <div>
                    <p style={{ fontWeight: 600 }}>{item.name}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.description?.slice(0,40)}...</p>
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ background: 'var(--bg-base)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                    {item.category?.name}
                  </span>
                </td>
                <td style={{ padding: '16px', fontWeight: 600 }}>${item.price.toFixed(2)}</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
