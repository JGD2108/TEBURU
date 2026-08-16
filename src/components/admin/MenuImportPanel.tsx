'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, FileText, ImageIcon, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { readApiResponse, requireApiSuccess, staffFetch } from '@/lib/api-client';

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
type UploadAuthorization = { id: string; uploadUrl: string; token: string; expiresAt: string; maxBytes: number; contentType: string };
type ImportReadiness = { available?: boolean; message?: string; maxPdfBytes?: number };

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

async function staffJson<T extends Record<string, unknown>>(input: RequestInfo | URL, init: RequestInit | undefined, fallback: string) {
  const response = await staffFetch(input, init);
  const payload = await readApiResponse<T>(response, fallback);
  return requireApiSuccess(response, payload, fallback);
}

function uploadPdfDirectly(authorization: UploadAuthorization, file: File, onProgress: (progress: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    request.open('PUT', authorization.uploadUrl);
    request.setRequestHeader('Content-Type', authorization.contentType || 'application/pdf');
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error('No se pudo subir el PDF. Comprueba tu conexión e inténtalo de nuevo.'));
    request.onabort = () => reject(new DOMException('Carga cancelada', 'AbortError'));
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error('El almacenamiento rechazó el PDF. Inténtalo de nuevo.'));
    request.onloadend = () => signal.removeEventListener('abort', abort);
    request.send(file);
  });
}

export default function MenuImportPanel() {
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [selected, setSelected] = useState<ImportJob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [readiness, setReadiness] = useState<ImportReadiness | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const uploadAbort = useRef<AbortController | null>(null);

  const loadImports = useCallback(async (keepSelected = true) => {
    const payload = await staffJson<{ imports?: ImportJob[]; data?: ImportJob[] }>('/api/admin/menu-import', undefined, 'No se pudieron cargar las importaciones. Inténtalo de nuevo.');
    const jobs = (payload.imports ?? payload.data ?? []) as ImportJob[];
    setImports(jobs);
    setSelected((current) => keepSelected && current ? jobs.find((job) => job.id === current.id) ?? current : jobs[0] ?? null);
    return jobs;
  }, []);

  const loadSelected = useCallback(async (id: string) => {
    const payload = await staffJson<{ import?: ImportJob; data?: ImportJob; draft?: ImportJob['draft'] }>(`/api/admin/menu-import/${encodeURIComponent(id)}`, undefined, 'No se pudo cargar el borrador. Inténtalo de nuevo.');
    const job = { ...(payload.import ?? payload.data ?? payload), draft: payload.draft } as ImportJob;
    setSelected(job);
    setImports((current) => current.map((entry) => entry.id === job.id ? { ...entry, ...job } : entry));
    return job;
  }, []);

  useEffect(() => {
    loadImports().catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false));
  }, [loadImports]);

  useEffect(() => {
    let active = true;
    fetch('/api/public/settings')
      .then(async (response) => readApiResponse<{ importReadiness?: ImportReadiness; data?: { importReadiness?: ImportReadiness } }>(response, 'La disponibilidad de importación no se pudo comprobar.'))
      .then((payload) => { if (active) setReadiness(payload.importReadiness ?? payload.data?.importReadiness ?? { available: false, message: 'La importación no está disponible temporalmente.' }); })
      .catch((error: Error) => { if (active) setReadiness({ available: false, message: error.message }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected || !['pending', 'processing'].includes(selected.status)) return;
    const interval = window.setInterval(() => loadSelected(selected.id).catch(() => undefined), 3000);
    return () => window.clearInterval(interval);
  }, [loadSelected, selected]);

  const validationCount = useMemo(() => jobDraft(selected).items.filter((item) => item.review_status !== 'excluded' && fieldProblems(item).length > 0).length, [selected]);
  const importUnavailable = readiness?.available === false;

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (!readiness || importUnavailable) { setMessage(readiness?.message || 'Comprobando la disponibilidad de importación. Inténtalo de nuevo en un momento.'); return; }
    if (readiness?.maxPdfBytes && file.size > readiness.maxPdfBytes) { setMessage('El PDF supera el tamaño permitido para importación.'); return; }
    if (file.type !== 'application/pdf' || file.size === 0) { setMessage('Selecciona un PDF válido que no esté vacío.'); return; }
    setSubmitting(true); setMessage(null); setUploadProgress(0);
    try {
      const authorizationPayload = await staffJson<{ data?: { authorization?: UploadAuthorization } }>('/api/admin/menu-import/upload-authorizations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      }, 'No se pudo preparar la carga del PDF. Inténtalo de nuevo.');
      const authorization = authorizationPayload.data?.authorization;
      if (!authorization) throw new Error('No se recibió autorización para subir el PDF. Inténtalo de nuevo.');
      if (file.size > authorization.maxBytes) throw new Error('El PDF supera el tamaño permitido para importación.');
      const controller = new AbortController();
      uploadAbort.current = controller;
      await uploadPdfDirectly(authorization, file, setUploadProgress, controller.signal);
      const finalized = await staffJson<{ data?: { import?: ImportJob } }>('/api/admin/menu-import/finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ authorizationId: authorization.id, token: authorization.token }),
      }, 'El PDF se subió, pero no se pudo iniciar el análisis. Inténtalo de nuevo.');
      const created = finalized.data?.import;
      if (!created) throw new Error('No se pudo iniciar el análisis del PDF. Inténtalo de nuevo.');
      setFile(null); setSelected(created); setImports((current) => [created, ...current.filter((job) => job.id !== created.id)]);
      setMessage('PDF recibido. El análisis se está ejecutando en segundo plano.');
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? 'La carga fue cancelada. Puedes reintentarlo con el mismo PDF.' : error instanceof Error ? error.message : 'No se pudo subir el PDF');
    } finally { uploadAbort.current = null; setSubmitting(false); setUploadProgress(null); }
  }

  async function openSource() {
    if (!selected) return;
    let payload: { data?: { url?: string; signedUrl?: string }; url?: string; signedUrl?: string };
    try { payload = await staffJson(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/source`, undefined, 'No se pudo abrir el documento fuente. Inténtalo de nuevo.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo abrir el documento fuente.'); return; }
    window.open(payload.data?.url ?? payload.data?.signedUrl ?? payload.url ?? payload.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function saveItem(item: DraftItem, patch: Partial<DraftItem>) {
    if (!selected) return;
    setSavingId(item.id); setMessage(null);
    try {
      await staffJson(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/draft-items/${encodeURIComponent(item.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      }, 'No se pudo guardar el borrador. Inténtalo de nuevo.');
      await loadSelected(selected.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el borrador'); }
    finally { setSavingId(null); }
  }

  async function removeItem(item: DraftItem) {
    if (!selected || !window.confirm(`¿Quitar “${item.name || 'este platillo'}” del borrador?`)) return;
    setSavingId(item.id);
    try {
      await staffJson(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/draft-items/${encodeURIComponent(item.id)}`, { method: 'DELETE' }, 'No se pudo quitar el platillo. Inténtalo de nuevo.');
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
      const payload = await readApiResponse<{ validation_errors?: unknown[]; errors?: unknown[]; error?: string | { message?: string } }>(response, 'No se pudo publicar este borrador. Inténtalo de nuevo.');
      if (!response.ok) {
        const errorMessage = typeof payload.error === 'object' ? payload.error?.message : payload.error;
        setPublishErrors((payload.validation_errors ?? payload.errors ?? [errorMessage || 'No se puede publicar este borrador']).map((entry: unknown) => typeof entry === 'string' ? entry : (entry as { message?: string }).message || 'Campo incompleto'));
        return;
      }
      await loadSelected(selected.id); setMessage('El borrador se agregó al menú actual.');
    } catch (error) {
      setPublishErrors([error instanceof Error ? error.message : 'No se pudo publicar este borrador.']);
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
        <button className="btn-primary" disabled={!file || submitting || !readiness || importUnavailable} type="submit"><Upload size={16} /> {submitting ? 'Subiendo...' : 'Analizar PDF'}</button>
        {submitting && uploadProgress !== null && <><span role="status">Subiendo: {uploadProgress}%</span><button className="btn-secondary" type="button" onClick={() => uploadAbort.current?.abort()}>Cancelar carga</button></>}
      </form>
      {readiness && importUnavailable && <p role="alert" style={{ marginBottom: 0, color: 'var(--primary)' }}>{readiness.message || 'La importación no está disponible temporalmente.'}</p>}
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
