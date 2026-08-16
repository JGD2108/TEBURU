import { useState, useEffect } from 'react';
import { staffFetch } from '@/lib/api-client';
import { Trash2, Plus } from 'lucide-react';
import MenuImportPanel from '@/components/admin/MenuImportPanel';

export default function MenuPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [savingItem, setSavingItem] = useState(false);

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
    const response = await staffFetch('/api/admin/menu');
    const payload = await response.json();
    if (response.ok) {
      setCategories(payload.categories);
      setItems(payload.items);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingItem(true);
    let imageUrl = formData.image_url.trim() || null;

    if (imageFile) {
      const uploadBody = new FormData();
      uploadBody.append('file', imageFile);
      const uploadResponse = await staffFetch('/api/admin/menu/images', { method: 'POST', body: uploadBody });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        alert(uploadResult.error || 'No se pudo subir la imagen');
        setSavingItem(false);
        return;
      }
      imageUrl = uploadResult.url;
    }

    const payload = {
      ...formData,
      image_url: imageUrl,
      price: parseFloat(formData.price),
      modifiable_ingredients: formData.modifiable_ingredients || null
    };

    const response = await staffFetch('/api/admin/menu', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      alert("Error guardando: " + (result.error || 'Error desconocido'));
      setSavingItem(false);
    } else {
      setShowForm(false);
      setFormData({ name: '', description: '', price: '', category_id: categories[0]?.id || '', image_url: '', modifiable_ingredients: '' });
      setImageFile(null);
      setImagePreview('');
      setSavingItem(false);
      loadData();
    }
  };

  const handleImageFile = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview('');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      alert('Selecciona una imagen JPG, PNG o WEBP de máximo 4 MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este platillo?")) {
      await staffFetch(`/api/admin/menu?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadData();
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    setSavingCategory(true);
    const response = await staffFetch('/api/admin/menu/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || 'No se pudo crear la categoría');
      setSavingCategory(false);
      return;
    }

    setNewCategoryName('');
    setFormData((current) => ({ ...current, category_id: current.category_id || result.data.id }));
    await loadData();
    setSavingCategory(false);
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

      <section style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '14px' }}>Categorías del menú</h3>
        <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '10px', marginBottom: categories.length ? '16px' : 0 }}>
          <input
            required
            maxLength={80}
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ej: Bebidas, Entradas o Postres"
            style={{ flex: 1, padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }}
          />
          <button type="submit" className="btn-secondary" disabled={savingCategory} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Plus size={17} /> {savingCategory ? 'Creando...' : 'Crear categoría'}
          </button>
        </form>
        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.map((category) => (
              <span key={category.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem' }}>
                {category.name}
              </span>
            ))}
          </div>
        )}
      </section>

      <div style={{ marginBottom: '24px' }}>
        <MenuImportPanel />
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
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>URL de la imagen (opcional)</label>
            <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="https://..." style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>O subir una foto (opcional)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageFile(e.target.files?.[0] || null)} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>JPG, PNG o WEBP. Máximo 4 MB. Si eliges una foto, tendrá prioridad sobre la URL.</p>
            {(imagePreview || formData.image_url) && <img src={imagePreview || formData.image_url} alt="Vista previa del platillo" style={{ marginTop: '10px', width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} />}
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
            <button type="submit" className="btn-primary" disabled={savingItem}>{savingItem ? 'Guardando...' : 'Guardar Platillo'}</button>
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
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--bg-base)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', textAlign: 'center' }}>Sin imagen</div>
                  )}
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
