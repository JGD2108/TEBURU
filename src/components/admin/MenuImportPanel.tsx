'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FileText, ImageIcon, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { staffFetch } from '@/lib/api-client';

type DraftCategory = { id: string; name: string };
type DraftItem = {
  id: string;
  name: string | null;
  description?: string | null;
  price: number | string | null;
  category_id?: string | null;
  draft_category_id?: string | null;
  category_name?: string | null;
  source_page?: number | null;
  confidence?: number | null;
  confidence_flags?: string[] | null;
  image_url?: string | null;
  image_suggestion?: { url?: string | null; confidence?: number | null; approved?: boolean } | null;
  approved?: boolean;
  validation_errors?: string[] | null;
  review_status?: 'pending' | 'approved' | 'excluded' | 'published';
};
type Evidence = { draft_item_id: string; page_number: number };
type ImportJob = {
  id: string;
  file_name?: string | null;
  source_filename?: string | null;
  status: string;
  error_message?: string | null;
  failure_reason?: string | null;
  created_at?: string;
  draft?: { categories?: DraftCategory[]; items?: DraftItem[]; evidence?: Evidence[] };
  categories?: DraftCategory[];
  items?: DraftItem[];
  validation_errors?: Array<{ item_id?: string; fields?: string[]; message?: string }>;
};

const panelStyle = { background: 'var(--bg-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' } as const;
const inputStyle = { width: '100%', padding: '9px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'white' } as const;

function jobDraft(job: ImportJob | null) {
  return { categories: job?.draft?.categories ?? job?.categories ?? [], items: job?.draft?.items ?? job?.items ?? [], evidence: job?.draft?.evidence ?? [] };
}

function fieldProblems(item: DraftItem) {
  const problems = [...(item.confidence_flags ?? []), ...(item.validation_errors ?? [])];
  if (!item.name?.trim()) problems.push('Falta el nombre');
  if (item.price === null || item.price === '' || !Number.isFinite(Number(item.price)) || Number(item.price) < 0) problems.push('El precio no es válido');
  if (!item.category_id && !item.category_name) problems.push('Falta la categoría');
  return [...new Set(problems)];
}

export default function MenuImportPanel() {
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [selected, setSelected] = useState<ImportJob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);

  const loadImports = useCallback(async (keepSelected = true) => {
    const response = await staffFetch('/api/admin/menu-import');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las importaciones');
    const jobs = (payload.imports ?? payload.data ?? []) as ImportJob[];
    setImports(jobs);
    setSelected((current) => keepSelected && current ? jobs.find((job) => job.id === current.id) ?? current : jobs[0] ?? null);
    return jobs;
  }, []);

  const loadSelected = useCallback(async (id: string) => {
    const response = await staffFetch(`/api/admin/menu-import/${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el borrador');
    const job = { ...(payload.import ?? payload.data ?? payload), draft: payload.draft } as ImportJob;
    setSelected(job);
    setImports((current) => current.map((entry) => entry.id === job.id ? { ...entry, ...job } : entry));
    return job;
  }, []);

  useEffect(() => {
    loadImports().catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false));
  }, [loadImports]);

  useEffect(() => {
    if (!selected || !['pending', 'processing'].includes(selected.status)) return;
    const interval = window.setInterval(() => loadSelected(selected.id).catch(() => undefined), 3000);
    return () => window.clearInterval(interval);
  }, [loadSelected, selected]);

  const validationCount = useMemo(() => jobDraft(selected).items.filter((item) => item.review_status !== 'excluded' && fieldProblems(item).length > 0).length, [selected]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size === 0) { setMessage('Selecciona un PDF válido que no esté vacío.'); return; }
    setSubmitting(true); setMessage(null);
    try {
      const body = new FormData(); body.append('file', file);
      const response = await staffFetch('/api/admin/menu-import', { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo iniciar el análisis');
      const created = (payload.import ?? payload.data ?? payload) as ImportJob;
      setFile(null); setSelected(created); setImports((current) => [created, ...current.filter((job) => job.id !== created.id)]);
      setMessage('PDF recibido. El análisis se está ejecutando en segundo plano.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo subir el PDF'); }
    finally { setSubmitting(false); }
  }

  async function openSource() {
    if (!selected) return;
    const response = await staffFetch(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/source`);
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error || 'No se pudo abrir el documento fuente'); return; }
    window.open(payload.url ?? payload.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function saveItem(item: DraftItem, patch: Partial<DraftItem>) {
    if (!selected) return;
    setSavingId(item.id); setMessage(null);
    try {
      const response = await staffFetch(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/draft-items/${encodeURIComponent(item.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar el borrador');
      await loadSelected(selected.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el borrador'); }
    finally { setSavingId(null); }
  }

  async function removeItem(item: DraftItem) {
    if (!selected || !window.confirm(`¿Quitar “${item.name || 'este platillo'}” del borrador?`)) return;
    setSavingId(item.id);
    try {
      const response = await staffFetch(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/draft-items/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo quitar el platillo');
      await loadSelected(selected.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo quitar el platillo'); }
    finally { setSavingId(null); }
  }

  async function publish() {
    if (!selected) return;
    setPublishErrors([]);
    if (validationCount) { setPublishErrors(['Corrige o elimina los platillos señalados antes de publicar.']); return; }
    if (!window.confirm('Esto agregará los platillos aprobados al menú actual. ¿Continuar?')) return;
    setSubmitting(true);
    try {
      const response = await staffFetch(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'append' }) });
      const payload = await response.json();
      if (!response.ok) {
        setPublishErrors((payload.validation_errors ?? payload.errors ?? [payload.error || 'No se puede publicar este borrador']).map((entry: unknown) => typeof entry === 'string' ? entry : (entry as { message?: string }).message || 'Campo incompleto'));
        return;
      }
      await loadSelected(selected.id); setMessage('El borrador se agregó al menú actual.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <section style={panelStyle}>Cargando importaciones...</section>;
  const { categories, items, evidence } = jobDraft(selected);
  const visibleItems = items.filter((item) => item.review_status !== 'excluded');
  return <section aria-label="Importar menú PDF" style={{ display: 'grid', gap: '20px' }}>
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>Importar menú desde PDF</h3>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>El menú actual no cambia hasta que revises y publiques este borrador.</p>
      <form onSubmit={upload} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input aria-label="Archivo PDF del menú" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)} />
        <button className="btn-primary" disabled={!file || submitting} type="submit"><Upload size={16} /> {submitting ? 'Subiendo...' : 'Analizar PDF'}</button>
      </form>
      {message && <p role="status" style={{ marginBottom: 0, color: 'var(--primary)' }}>{message}</p>}
    </div>

    {imports.length > 0 && <div style={panelStyle}>
      <label htmlFor="menu-import-select" style={{ display: 'block', marginBottom: 8 }}>Borradores recientes</label>
      <select id="menu-import-select" value={selected?.id ?? ''} onChange={(event) => loadSelected(event.target.value).catch((error: Error) => setMessage(error.message))} style={inputStyle}>
        {imports.map((job) => <option key={job.id} value={job.id}>{job.file_name || job.source_filename || 'Menú sin nombre'} — {job.status}</option>)}
      </select>
    </div>}

    {selected && <div style={{ ...panelStyle, display: 'grid', gap: '16px' }}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div><h3 style={{ margin: 0 }}>{selected.file_name || selected.source_filename || 'Borrador de menú'}</h3><p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>Estado: <strong>{selected.status}</strong>{selected.error_message || selected.failure_reason ? ` — ${selected.error_message || selected.failure_reason}` : ''}</p></div>
        <button className="btn-secondary" onClick={openSource}><FileText size={16} /> Ver PDF original</button>
      </div>
      {['pending', 'processing'].includes(selected.status) && <p role="status"><Loader2 size={16} className="spin" /> Analizando el documento; esta vista se actualiza automáticamente.</p>}
      {selected.status === 'failed' && <p role="alert" style={{ color: 'var(--primary)' }}>No fue posible analizar este archivo. {selected.error_message || selected.failure_reason}</p>}
      {selected.status === 'needs_review' && <>
        {(validationCount > 0 || publishErrors.length > 0) && <div role="alert" style={{ padding: 12, borderRadius: 6, background: 'rgba(255,71,87,.12)', color: 'var(--primary)' }}><AlertTriangle size={16} /> {validationCount ? `${validationCount} platillo(s) requieren corrección.` : null}{publishErrors.map((error) => <div key={error}>{error}</div>)}</div>}
        {visibleItems.length === 0 ? <p>No se detectaron platillos. Consulta el PDF y vuelve a intentar el análisis.</p> : visibleItems.map((item) => <DraftItemCard key={item.id} item={item} categories={categories} evidence={evidence.find((entry) => entry.draft_item_id === item.id)} saving={savingId === item.id} onSave={saveItem} onRemove={removeItem} />)}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn-primary" disabled={submitting || validationCount > 0} onClick={publish}><Check size={16} /> Publicar aprobados</button></div>
      </>}
    </div>}
  </section>;
}

function DraftItemCard({ item, categories, evidence, saving, onSave, onRemove }: { item: DraftItem; categories: DraftCategory[]; evidence?: Evidence; saving: boolean; onSave: (item: DraftItem, patch: Partial<DraftItem>) => Promise<void>; onRemove: (item: DraftItem) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ name: item.name ?? '', description: item.description ?? '', price: item.price?.toString() ?? '', category_id: item.draft_category_id ?? item.category_id ?? '' });
  useEffect(() => setValues({ name: item.name ?? '', description: item.description ?? '', price: item.price?.toString() ?? '', category_id: item.draft_category_id ?? item.category_id ?? '' }), [item]);
  const problems = fieldProblems(item);
  const suggestedImage = item.image_suggestion?.url ?? item.image_url;
  return <article style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
      <div><strong>{item.name || 'Platillo sin nombre'}</strong><p style={{ margin: '4px 0', color: 'var(--text-muted)' }}>{item.category_name || categories.find((category) => category.id === (item.draft_category_id ?? item.category_id))?.name || 'Sin categoría'} · ${Number(item.price || 0).toFixed(2)} · Página {evidence?.page_number ?? item.source_page ?? 'sin referencia'}</p></div>
      <div style={{ display: 'flex', gap: 8 }}><button aria-label={`Aprobar ${item.name || 'platillo'}`} className="btn-secondary" disabled={saving || item.review_status === 'approved'} onClick={() => onSave(item, { approved: true })}><Check size={15} /></button><button aria-label={`Editar ${item.name || 'platillo'}`} className="btn-secondary" onClick={() => setEditing((value) => !value)}><Pencil size={15} /></button><button aria-label={`Eliminar ${item.name || 'platillo'}`} className="btn-secondary" disabled={saving} onClick={() => onRemove(item)}><Trash2 size={15} /></button></div>
    </div>
    {suggestedImage && <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}><img src={suggestedImage} alt={`Imagen sugerida para ${item.name || 'platillo'}`} style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 5 }} /><small style={{ color: 'var(--text-muted)' }}><ImageIcon size={13} /> Imagen sugerida{item.image_suggestion?.confidence ? ` (${Math.round(item.image_suggestion.confidence * 100)}% confianza)` : ''}</small></div>}
    {problems.length > 0 && <p role="alert" style={{ color: 'var(--primary)', marginBottom: 0 }}><AlertTriangle size={14} /> {problems.join(' · ')}</p>}
    {editing && <form onSubmit={(event) => { event.preventDefault(); onSave(item, { name: values.name, description: values.description, price: values.price === '' ? null : Number(values.price), category_id: values.category_id || null }); setEditing(false); }} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      <input aria-label="Nombre" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} style={inputStyle} />
      <textarea aria-label="Descripción" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} style={inputStyle} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><input aria-label="Precio" type="number" min="0" step="0.01" value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} style={inputStyle} /><select aria-label="Categoría" value={values.category_id} onChange={(event) => setValues({ ...values, category_id: event.target.value })} style={inputStyle}><option value="">Selecciona categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <button className="btn-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Guardar corrección'}</button>
    </form>}
  </article>;
}
