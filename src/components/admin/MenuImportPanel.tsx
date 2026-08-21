'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, FileText, ImageIcon, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { readApiResponse, requireApiSuccess, staffFetch } from '@/lib/api-client';
import { uploadRecoveryMessage } from '@/lib/menu-import-upload-recovery';
import { supabase } from '@/lib/supabase';
import { groupProjectedItems, isTextOnlyV5Analyzer, issueLabel, issueReasons, nativeTextProvenance, projectMenuImport, shouldShowSourceGeometry, type ExtractionIssue } from './menu-import-projection';

type SourceBox = { x: number; y: number; width: number; height: number };
type DraftCategory = {
  id: string;
  name: string;
  parent_id?: string | null;
  parent_section_id?: string | null;
  source_page?: number | null;
  source_bbox?: SourceBox | null;
  review_reasons?: string[] | null;
};
type DraftPrice = {
  raw?: string | null;
  amount?: number | string | null;
  normalized_amount?: number | string | null;
  currency?: string | null;
  label?: string | null;
  variant_label?: string | null;
  shared?: boolean | null;
  provenance?: string | null;
  source_page?: number | null;
  source_bbox?: SourceBox | null;
};
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
  decision_confidence?: number | null;
  decisionConfidence?: number | null;
  recommendation?: 'approve' | 'review' | 'reject' | null;
  bulk_eligible?: boolean;
  bulkEligible?: boolean;
  extraction_attributes?: {
    providerDecision?: { recommendation?: 'approve' | 'review' | 'reject'; decisionConfidence?: number; decisionReasons?: string[] };
    assistedApproval?: { eligible?: boolean; blockingReasons?: string[]; policyVersion?: string; confidenceThreshold?: number };
  } | null;
  confidence_flags?: string[] | null;
  image_url?: string | null;
  image_suggestion?: { url?: string | null; confidence?: number | null; approved?: boolean } | null;
  approved?: boolean;
  validation_errors?: string[] | null;
  review_reasons?: Array<string | { code?: string; message?: string }> | null;
  raw_price?: string | null;
  normalized_price?: number | string | null;
  price_currency?: string | null;
  price_variants?: DraftPrice[] | null;
  variants?: DraftPrice[] | null;
  shared_price?: DraftPrice | null;
  shared_price_provenance?: string | null;
  section_path?: string[] | null;
  hierarchy?: string[] | null;
  parent_section_name?: string | null;
  source_bbox?: SourceBox | null;
  source_bboxes?: SourceBox[] | null;
  review_status?: 'pending' | 'approved' | 'excluded' | 'published';
  extraction_status?: 'valid' | 'review' | 'invalid';
  extractionStatus?: 'valid' | 'review' | 'invalid';
  validation_status?: 'valid' | 'review' | 'invalid';
  validationStatus?: 'valid' | 'review' | 'invalid';
  retry_exhausted?: boolean;
  retryExhausted?: boolean;
  updated_at?: string;
  updatedAt?: string;
};
type DraftItemPatch = Partial<Pick<DraftItem, 'name' | 'description' | 'price' | 'raw_price' | 'normalized_price' | 'price_currency' | 'price_variants' | 'shared_price_provenance' | 'draft_category_id'>> & { category_id?: string | null; approved?: boolean };
type Evidence = {
  draft_item_id: string;
  page_number: number;
  excerpt?: string | null;
  source_bbox?: SourceBox | null;
  bounding_box?: SourceBox | null;
  review_reasons?: string[] | null;
};
type ImportJob = {
  id: string;
  file_name?: string | null;
  source_filename?: string | null;
  status: string;
  error_message?: string | null;
  failure_reason?: string | null;
  created_at?: string;
  draft?: { categories?: DraftCategory[]; items?: DraftItem[]; evidence?: Evidence[]; extraction_issues?: ExtractionIssue[]; extractionIssues?: ExtractionIssue[]; invalid_fragments?: ExtractionIssue[]; invalidFragments?: ExtractionIssue[]; metadata?: { attributes?: Record<string, unknown> | null } | null; native_text_provenance?: unknown; nativeTextProvenance?: unknown };
  categories?: DraftCategory[];
  items?: DraftItem[];
  validation_errors?: Array<{ item_id?: string; fields?: string[]; message?: string }>;
  source_sha256?: string | null;
  sourceSha256?: string | null;
  analysis_execution_id?: string | null;
  analysisExecutionId?: string | null;
  analysis_attempt?: number | null;
  analysisAttempt?: number | null;
  analyzer_version?: string | null;
  analyzerVersion?: string | null;
  analysis_status?: string | null;
  analysisStatus?: string | null;
  analysis_run?: AnalysisRun | null;
  analysisRun?: AnalysisRun | null;
  native_text_provenance?: unknown;
  nativeTextProvenance?: unknown;
};
type AnalysisRun = {
  analysis_execution_id?: string | null;
  analysisExecutionId?: string | null;
  attempt?: number | null;
  source_sha256?: string | null;
  sourceSha256?: string | null;
  analyzer_version?: string | null;
  analyzerVersion?: string | null;
  status?: string | null;
  structure_provider?: 'gemini' | 'local-fallback' | null;
  structure_model?: string | null;
  structure_fallback_reason?: string | null;
  structural_metrics?: unknown;
  native_text_provenance?: unknown;
  nativeTextProvenance?: unknown;
};
type UploadAuthorization = { id: string; objectPath: string; uploadToken: string; uploadUrl: string; token: string; expiresAt: string; maxBytes: number; contentType: string };
type ImportReadiness = { available?: boolean; message?: string; maxPdfBytes?: number };
type AnalyzerVersion = 'menu-import-v3-visual' | 'menu-import-v4-visual' | 'menu-import-v5-text';
type AnalyzerOption = { version?: unknown; enabled?: unknown; default?: unknown };

const analyzerLabels: Record<AnalyzerVersion, string> = {
  'menu-import-v3-visual': 'Visual clásico',
  'menu-import-v4-visual': 'Visual (recomendado)',
  'menu-import-v5-text': 'Solo texto nativo (V5)',
};
const knownAnalyzerVersions = new Set<AnalyzerVersion>(Object.keys(analyzerLabels) as AnalyzerVersion[]);

export function safeAnalyzerOptions(options: unknown): AnalyzerVersion[] {
  if (!Array.isArray(options)) return [];
  const safe: AnalyzerVersion[] = [];
  for (const option of options) {
    if (!option || typeof option !== 'object') continue;
    const { version, enabled } = option as AnalyzerOption;
    if (typeof version !== 'string' || !knownAnalyzerVersions.has(version as AnalyzerVersion)) continue;
    // The admin API is the server-side allow-list. V5 only appears there when
    // the server rollout is enabled; accept an explicit disabled marker too.
    if (enabled === false) continue;
    if (!safe.includes(version as AnalyzerVersion)) safe.push(version as AnalyzerVersion);
  }
  return safe;
}

export function v5EnabledForOperators(options: unknown) {
  return safeAnalyzerOptions(options).includes('menu-import-v5-text');
}

export function finalizeImportBody(authorization: Pick<UploadAuthorization, 'id' | 'token'>) {
  return { authorizationId: authorization.id, token: authorization.token, analyzerVersion: 'menu-import-v5-text' as const };
}

export function draftVersionSnapshot(items: DraftItem[]) {
  const entries = items.map((item) => [item.id, item.updated_at ?? item.updatedAt] as const);
  return entries.every(([, updatedAt]) => typeof updatedAt === 'string' && updatedAt.length > 0)
    ? Object.fromEntries(entries as ReadonlyArray<readonly [string, string]>)
    : undefined;
}

export function providerDecisionPresentation(item: DraftItem) {
  const decision = item.extraction_attributes?.providerDecision;
  const recommendation = item.recommendation ?? decision?.recommendation;
  const confidence = item.decision_confidence ?? item.decisionConfidence ?? decision?.decisionConfidence ?? item.confidence;
  return {
    recommendation,
    recommendationLabel: recommendation === 'approve' ? 'aprobar' : recommendation === 'review' ? 'revisar' : recommendation === 'reject' ? 'rechazar' : undefined,
    confidencePercent: typeof confidence === 'number' ? Math.round(confidence * 100) : undefined,
  };
}

export function bulkApprovalSummaryText(summary: { approved: number; skipped: number; reasons: string[] }) {
  return `Aprobados: ${summary.approved}. Omitidos: ${summary.skipped}.${summary.reasons.length ? ` Motivos: ${summary.reasons.join(' · ')}` : ''}`;
}

export async function refreshPublishedViews(importId: string, reloadImport: (id: string) => Promise<unknown>, reloadMenu?: () => void | Promise<void>) {
  await reloadImport(importId);
  await reloadMenu?.();
}

export const categoryFilterLayout = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } as const;

const menuImportBucket = 'menu-imports';
const panelStyle = { background: 'var(--bg-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' } as const;
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '7px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7)' } as const;

function jobDraft(job: ImportJob | null) {
  return {
    categories: job?.draft?.categories ?? job?.categories ?? [],
    items: job?.draft?.items ?? job?.items ?? [],
    evidence: job?.draft?.evidence ?? [],
    extraction_issues: job?.draft?.extraction_issues,
    extractionIssues: job?.draft?.extractionIssues,
    invalid_fragments: job?.draft?.invalid_fragments,
    invalidFragments: job?.draft?.invalidFragments,
    metadata: job?.draft?.metadata,
    native_text_provenance: job?.draft?.native_text_provenance,
    nativeTextProvenance: job?.draft?.nativeTextProvenance,
  };
}

function reasonText(reason: string | { code?: string; message?: string }) {
  return typeof reason === 'string' ? reason : reason.code ?? reason.message ?? '';
}

function asFinitePrice(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function priceVariants(item: DraftItem) {
  return item.price_variants ?? item.variants ?? [];
}

export function formatPrice(price: DraftPrice | Pick<DraftItem, 'price' | 'normalized_price' | 'raw_price' | 'price_currency'>) {
  const legacy = 'price' in price;
  const raw = legacy ? price.raw_price : price.raw;
  const amount = asFinitePrice(legacy ? price.normalized_price ?? price.price : price.normalized_amount ?? price.amount);
  const currency = legacy ? price.price_currency : price.currency;
  if (amount === null) return raw?.trim() ? `Sin normalizar: ${raw}` : 'Precio ausente';
  if (!currency) return raw?.trim() ? `${amount.toFixed(2)} · observado: ${raw}` : amount.toFixed(2);
  try {
    const normalized = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    return raw?.trim() && raw !== normalized ? `${normalized} · observado: ${raw}` : normalized;
  } catch {
    return raw?.trim() ? `${currency} ${amount.toFixed(2)} · observado: ${raw}` : `${currency} ${amount.toFixed(2)}`;
  }
}

function formatBox(box?: SourceBox | null) {
  return box ? `x ${Math.round(box.x * 100)}%, y ${Math.round(box.y * 100)}%, ${Math.round(box.width * 100)} × ${Math.round(box.height * 100)}%` : null;
}

function categoryPath(item: DraftItem, categories: DraftCategory[]) {
  if (item.section_path?.length) return item.section_path.join(' / ');
  if (item.hierarchy?.length) return item.hierarchy.join(' / ');
  const category = categories.find((entry) => entry.id === (item.draft_category_id ?? item.category_id));
  if (!category) return item.category_name || 'Sin categoría';
  const names = [category.name];
  let parentId = category.parent_id ?? category.parent_section_id;
  while (parentId) {
    const parent = categories.find((entry) => entry.id === parentId);
    if (!parent || names.includes(parent.name)) break;
    names.unshift(parent.name);
    parentId = parent.parent_id ?? parent.parent_section_id;
  }
  return names.join(' / ');
}

function fieldProblems(item: DraftItem) {
  const problems = [...(item.confidence_flags ?? []), ...(item.validation_errors ?? []), ...(item.review_reasons ?? []).map(reasonText).filter(Boolean)];
  if (!item.name?.trim()) problems.push('Falta el nombre');
  if (asFinitePrice(item.normalized_price ?? item.price) === null) problems.push(priceVariants(item).length ? 'Elige un precio base para publicar' : item.raw_price?.trim() ? 'El precio requiere normalización' : 'Falta el precio');
  if (!item.draft_category_id && !item.category_id && !item.category_name) problems.push('Falta la categoría');
  return [...new Set(problems)];
}

function lineageFor(job: ImportJob) {
  const run = job.analysis_run ?? job.analysisRun;
  return {
    executionId: run?.analysis_execution_id ?? run?.analysisExecutionId ?? job.analysis_execution_id ?? job.analysisExecutionId,
    attempt: run?.attempt ?? job.analysis_attempt ?? job.analysisAttempt,
    sourceHash: run?.source_sha256 ?? run?.sourceSha256 ?? job.source_sha256 ?? job.sourceSha256,
    analyzerVersion: run?.analyzer_version ?? run?.analyzerVersion ?? job.analyzer_version ?? job.analyzerVersion,
    status: run?.status ?? job.analysis_status ?? job.analysisStatus,
    structureProvider: run?.structure_provider,
    structureModel: run?.structure_model,
    structureFallbackReason: run?.structure_fallback_reason,
  };
}

function provenanceFor(job: ImportJob) {
  const run = job.analysis_run ?? job.analysisRun;
  const draft = jobDraft(job);
  return nativeTextProvenance(
    job.native_text_provenance
      ?? job.nativeTextProvenance
      ?? run?.native_text_provenance
      ?? run?.nativeTextProvenance
      ?? run?.structural_metrics
      ?? draft.native_text_provenance
      ?? draft.nativeTextProvenance
      ?? draft.metadata?.attributes,
  );
}

async function staffJson<T extends Record<string, unknown>>(input: RequestInfo | URL, init: RequestInit | undefined, fallback: string) {
  const response = await staffFetch(input, init);
  const payload = await readApiResponse<T>(response, fallback);
  return requireApiSuccess(response, payload, fallback);
}

// Kept only for temporary compatibility with older authorization responses during rollout.
type CompletedUpload = { status: number };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function uploadPdfDirectly(authorization: UploadAuthorization, file: File, onProgress: (progress: number) => void, signal: AbortSignal) {
  return new Promise<CompletedUpload>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    request.open('PUT', authorization.uploadUrl);
    request.setRequestHeader('Content-Type', authorization.contentType || 'application/pdf');
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error('No se pudo subir el PDF. Comprueba tu conexión e inténtalo de nuevo.'));
    request.onabort = () => reject(new DOMException('Carga cancelada', 'AbortError'));
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve({ status: request.status })
      : reject(new Error('El almacenamiento rechazó el PDF. Inténtalo de nuevo.'));
    request.onloadend = () => signal.removeEventListener('abort', abort);
    request.send(file);
  });
}

async function uploadPdfWithSupabase(authorization: UploadAuthorization, file: File, onProgress: (progress: number) => void, signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Carga cancelada', 'AbortError');
  if (!authorization.objectPath || !authorization.uploadToken) throw new Error('No se recibio autorizacion de almacenamiento para subir el PDF.');
  const result = await supabase.storage
    .from(menuImportBucket)
    .uploadToSignedUrl(authorization.objectPath, authorization.uploadToken, file, { contentType: authorization.contentType || 'application/pdf' });
  if (signal.aborted) throw new DOMException('Carga cancelada', 'AbortError');
  if (result.error) throw new Error('El almacenamiento rechazo el PDF. Intentalo de nuevo.');
  onProgress(100);
}

export default function MenuImportPanel({ onPublished }: { onPublished?: () => void | Promise<void> }) {
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [selected, setSelected] = useState<ImportJob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [readiness, setReadiness] = useState<ImportReadiness | null>(null);
  const [v5Available, setV5Available] = useState<boolean | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [bulkState, setBulkState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [bulkSummary, setBulkSummary] = useState<{ approved: number; skipped: number; reasons: string[] } | null>(null);
  const [bulkEnabled, setBulkEnabled] = useState(false);
  const uploadAbort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const clearSelectedFile = useCallback(() => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  }, []);

  const loadImports = useCallback(async (keepSelected = true) => {
    const payload = await staffJson<{ imports?: ImportJob[]; analyzerOptions?: unknown; data?: ImportJob[] | { imports?: ImportJob[]; analyzerOptions?: unknown } }>('/api/admin/menu-import', undefined, 'No se pudieron cargar las importaciones. Inténtalo de nuevo.');
    const nested = payload.data && !Array.isArray(payload.data) ? payload.data : undefined;
    const jobs = (payload.imports ?? (Array.isArray(payload.data) ? payload.data : nested?.imports) ?? []) as ImportJob[];
    const safeOptions = safeAnalyzerOptions(payload.analyzerOptions ?? nested?.analyzerOptions);
    setV5Available(safeOptions.includes('menu-import-v5-text'));
    setImports(jobs);
    setSelected((current) => keepSelected && current ? jobs.find((job) => job.id === current.id) ?? current : jobs[0] ?? null);
    return jobs;
  }, []);

  const loadSelected = useCallback(async (id: string, preserveSelection = false) => {
    const payload = await staffJson<{ import?: ImportJob; data?: ImportJob; draft?: ImportJob['draft'] }>(`/api/admin/menu-import/${encodeURIComponent(id)}`, undefined, 'No se pudo cargar el borrador. Inténtalo de nuevo.');
    const job = { ...(payload.import ?? payload.data ?? payload), draft: payload.draft } as ImportJob;
    setSelected((current) => preserveSelection && current?.id !== id ? current : job);
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
    const interval = window.setInterval(() => loadSelected(selected.id, true).catch(() => undefined), 3000);
    return () => window.clearInterval(interval);
  }, [loadSelected, selected]);

  useEffect(() => { setCategoryFilter('All'); setBulkState('idle'); setBulkSummary(null); }, [selected?.id]);

  useEffect(() => {
    let active = true;
    setBulkEnabled(false);
    if (!selected || selected.status !== 'needs_review' || !isTextOnlyV5Analyzer(lineageFor(selected)?.analyzerVersion)) return () => { active = false; };
    staffJson<{ data?: { enabled?: boolean; eligibleImport?: boolean }; enabled?: boolean; eligibleImport?: boolean }>(
      `/api/admin/menu-import/${encodeURIComponent(selected.id)}/approve-all`,
      undefined,
      'No se pudo comprobar la aprobación asistida.',
    ).then((payload) => {
      const result = payload.data ?? payload;
      if (active) setBulkEnabled(result.enabled === true && result.eligibleImport === true);
    }).catch(() => { if (active) setBulkEnabled(false); });
    return () => { active = false; };
  }, [selected]);

  const draftProjection = useMemo(() => projectMenuImport(jobDraft(selected), (item) => fieldProblems(item as DraftItem).length > 0), [selected]);
  const validationCount = useMemo(() => draftProjection.reviewItems.filter((item) => fieldProblems(item).length > 0).length, [draftProjection]);
  const importUnavailable = readiness?.available === false || v5Available === false;
  const importUnavailableMessage = readiness?.available === false
    ? readiness.message || 'La importación no está disponible temporalmente.'
    : v5Available === false
      ? 'La importación asistida V5 no está habilitada. Pide a un administrador de plataforma que la active o aplique el rollback autorizado.'
      : null;

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
      await uploadPdfWithSupabase(authorization, file, setUploadProgress, controller.signal);
      const completedUpload = { status: 200 };
      if (completedUpload.status < 200 || completedUpload.status >= 300) {
        throw new Error('El almacenamiento rechazó el PDF. Inténtalo de nuevo.');
      }
      const finalized = await staffJson<{ data?: { import?: ImportJob } }>('/api/admin/menu-import/finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalizeImportBody(authorization)),
      }, 'El PDF se subió, pero no se pudo iniciar el análisis. Inténtalo de nuevo.');
      const created = finalized.data?.import;
      if (!created) throw new Error('No se pudo iniciar el análisis del PDF. Inténtalo de nuevo.');
      clearSelectedFile(); setSelected(created); setImports((current) => [created, ...current.filter((job) => job.id !== created.id)]);
      setMessage('PDF recibido. El análisis se está ejecutando en segundo plano.');
    } catch (error) {
      const recoveryMessage = uploadRecoveryMessage(error);
      if (recoveryMessage) clearSelectedFile();
      setMessage(recoveryMessage ?? (error instanceof DOMException && error.name === 'AbortError' ? 'La carga fue cancelada. Puedes reintentarlo con el mismo PDF.' : error instanceof Error ? error.message : 'No se pudo subir el PDF'));
    } finally { uploadAbort.current = null; setSubmitting(false); setUploadProgress(null); }
  }

  async function openSource() {
    if (!selected) return;
    let payload: { data?: { url?: string; signedUrl?: string }; url?: string; signedUrl?: string };
    try { payload = await staffJson(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/source`, undefined, 'No se pudo abrir el documento fuente. Inténtalo de nuevo.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo abrir el documento fuente.'); return; }
    window.open(payload.data?.url ?? payload.data?.signedUrl ?? payload.url ?? payload.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function retryImport() {
    if (!selected) return;
    setSubmitting(true); setMessage(null);
    try {
      await staffJson(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/retry`, { method: 'POST' }, 'No se pudo reintentar el análisis.');
      await loadSelected(selected.id);
      setMessage('El análisis fue reprogramado.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo reintentar el análisis.'); }
    finally { setSubmitting(false); }
  }

  async function deleteImport() {
    if (!selected || ['processing', 'published'].includes(selected.status)) return;
    const name = selected.file_name || selected.source_filename || 'este borrador';
    if (!window.confirm(`¿Eliminar “${name}”? Esta acción no se puede deshacer.`)) return;
    const deletedId = selected.id;
    setDeleting(true); setMessage(null);
    try {
      await staffJson(`/api/admin/menu-import/${encodeURIComponent(deletedId)}`, { method: 'DELETE' }, 'No se pudo eliminar la importación.');
      setSelected(null);
      setImports((current) => current.filter((job) => job.id !== deletedId));
      await loadImports(false);
      setMessage('La importación fue eliminada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar la importación.');
    } finally { setDeleting(false); }
  }

  async function saveItem(item: DraftItem, patch: DraftItemPatch) {
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
      await refreshPublishedViews(selected.id, loadSelected, onPublished);
      setMessage('El borrador se agregó al menú actual y el menú publicado se actualizó.');
    } catch (error) {
      setPublishErrors([error instanceof Error ? error.message : 'No se pudo publicar este borrador.']);
    } finally { setSubmitting(false); }
  }

  async function approveAllEligible() {
    if (!selected) return;
    const versions = draftVersionSnapshot(jobDraft(selected).items);
    if (!versions) { setBulkState('error'); setMessage('Actualiza el borrador antes de aprobar todos los elegibles.'); return; }
    if (!window.confirm('Se aprobarán únicamente los platillos que el servidor todavía considere elegibles. Esta acción no publica el menú. ¿Continuar?')) return;
    setBulkState('loading'); setBulkSummary(null); setMessage(null);
    try {
      const payload = await staffJson<{ data?: { approved?: number; skipped?: number; skippedReasons?: string[]; skipReasons?: string[] }; approved?: number; skipped?: number; skippedReasons?: string[]; skipReasons?: string[] }>(`/api/admin/menu-import/${encodeURIComponent(selected.id)}/approve-all`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftVersions: versions }),
      }, 'No se pudieron aprobar los platillos elegibles. Actualiza el borrador e inténtalo de nuevo.');
      const result = payload.data ?? payload;
      setBulkSummary({ approved: Number(result.approved ?? 0), skipped: Number(result.skipped ?? 0), reasons: result.skippedReasons ?? result.skipReasons ?? [] });
      setBulkState('success');
      await loadSelected(selected.id);
    } catch (error) {
      setBulkState('error');
      setMessage(error instanceof Error ? error.message : 'No se pudieron aprobar los platillos elegibles.');
    }
  }

  if (loading) return <section style={panelStyle}>Cargando importaciones...</section>;
  const { categories, evidence } = jobDraft(selected);
  const { validItems, reviewItems, issues } = draftProjection;
  const lineage = selected ? lineageFor(selected) : null;
  const textOnlyV5 = isTextOnlyV5Analyzer(lineage?.analyzerVersion);
  const showSourceGeometry = shouldShowSourceGeometry(lineage?.analyzerVersion);
  const nativeProvenance = selected && textOnlyV5 ? provenanceFor(selected) : undefined;
  const canReplay = selected ? ['pending', 'failed'].includes(selected.status) : false;
  const canDelete = selected ? !['processing', 'published'].includes(selected.status) : false;
  const reviewableItems = [...validItems, ...reviewItems];
  const categoryOrder = categories.map((category) => categoryPath({ category_id: category.id } as DraftItem, categories));
  const categoryGroups = groupProjectedItems(reviewableItems, (item) => categoryPath(item, categories), categoryOrder);
  const visibleGroups = categoryFilter === 'All' ? categoryGroups : categoryGroups.filter((group) => group.name === categoryFilter);
  const categoryFilters = categoryGroups.map((group) => group.name);
  return <section aria-label="Importar menú PDF" style={{ display: 'grid', gap: '20px' }}>
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>Importar menú desde PDF</h3>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>El menú actual no cambia hasta que revises y publiques este borrador.</p>
      <form onSubmit={upload} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={fileInput} aria-label="Archivo PDF del menú" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)} />
        <button className="btn-primary" disabled={!file || submitting || !readiness || importUnavailable} type="submit"><Upload size={16} /> {submitting ? 'Subiendo...' : 'Analizar PDF'}</button>
        {submitting && uploadProgress !== null && <><span role="status">Subiendo: {uploadProgress}%</span><button className="btn-secondary" type="button" onClick={() => uploadAbort.current?.abort()}>Cancelar carga</button></>}
      </form>
      <small style={{ color: 'var(--text-muted)' }}>Análisis con texto nativo asistido (V5).</small>
      {importUnavailableMessage && <p role="alert" style={{ marginBottom: 0, color: 'var(--primary)' }}>{importUnavailableMessage}</p>}
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-secondary" type="button" onClick={openSource}><FileText size={16} /> Ver PDF original</button>
          {canReplay && <button className="btn-secondary" type="button" disabled={submitting || deleting} onClick={retryImport}>Iniciar o reintentar análisis</button>}
          {canDelete && <button className="btn-secondary" type="button" disabled={submitting || deleting} onClick={deleteImport} aria-label="Eliminar importación"><Trash2 size={16} /> {deleting ? 'Eliminando...' : 'Eliminar importación'}</button>}
        </div>
      </div>
      {lineage && (lineage.executionId || lineage.sourceHash || lineage.analyzerVersion) && <div aria-label="Linaje del análisis" style={{ padding: 12, borderRadius: 6, background: 'var(--bg-base)', display: 'grid', gap: 4 }}>
        <strong>Linaje del análisis</strong>
        <small>Importación: {selected.id}</small>
        {lineage.executionId && <small>Ejecución: {lineage.executionId}</small>}
        {lineage.attempt !== null && lineage.attempt !== undefined && <small>Intento: {lineage.attempt}</small>}
        {lineage.status && <small>Resultado: {lineage.status}</small>}
        {lineage.analyzerVersion && <small>Analizador: {lineage.analyzerVersion}</small>}
        {lineage.structureProvider && <small>Estructurador: {lineage.structureProvider}{!textOnlyV5 && lineage.structureModel ? ` (${lineage.structureModel})` : ''}</small>}
        {lineage.structureFallbackReason && <small>Motivo del fallback: {lineage.structureFallbackReason}</small>}
        {lineage.sourceHash && <small style={{ overflowWrap: 'anywhere' }}>Huella SHA-256: {lineage.sourceHash}</small>}
      </div>}
      {nativeProvenance && <div aria-label="Procedencia de texto nativo" style={{ padding: 12, borderRadius: 6, background: 'var(--bg-base)', display: 'grid', gap: 4 }}>
        <strong>Procedencia de texto nativo</strong>
        {nativeProvenance.inputKind && <small>Entrada: {nativeProvenance.inputKind}</small>}
        {nativeProvenance.fallbackUsage && <small>Fallback: {nativeProvenance.fallbackUsage}</small>}
        {nativeProvenance.serializerVersion && <small>Serializador: {nativeProvenance.serializerVersion}</small>}
        {(nativeProvenance.pdfPages !== undefined || nativeProvenance.textDocumentPages !== undefined || nativeProvenance.textCharacters !== undefined) && <small>Páginas PDF/texto: {nativeProvenance.pdfPages ?? '—'} / {nativeProvenance.textDocumentPages ?? '—'}{nativeProvenance.textCharacters !== undefined ? ` · ${nativeProvenance.textCharacters} caracteres` : ''}</small>}
        {nativeProvenance.pdfSha256 && <small style={{ overflowWrap: 'anywhere' }}>Huella PDF: {nativeProvenance.pdfSha256}</small>}
        {nativeProvenance.textDocumentHash && <small style={{ overflowWrap: 'anywhere' }}>Huella del documento de texto: {nativeProvenance.textDocumentHash}</small>}
      </div>}
      {['pending', 'processing'].includes(selected.status) && <p role="status"><Loader2 size={16} className="spin" /> Analizando el documento; esta vista se actualiza automáticamente.</p>}
      {selected.status === 'failed' && <div role="alert" style={{ color: 'var(--primary)' }}>No fue posible analizar este archivo. {selected.error_message || selected.failure_reason}</div>}
      {selected.status === 'needs_review' && <>
        {(validationCount > 0 || publishErrors.length > 0) && <div role="alert" style={{ padding: 12, borderRadius: 6, background: 'rgba(255,71,87,.12)', color: 'var(--primary)' }}><AlertTriangle size={16} /> {validationCount ? `${validationCount} platillo(s) requieren corrección.` : null}{publishErrors.map((error) => <div key={error}>{error}</div>)}</div>}
        {reviewableItems.length === 0 && issues.length === 0 ? <p>No se detectaron platillos. Consulta el PDF y vuelve a intentar el análisis.</p> : <>
          {reviewableItems.length > 0 && <section aria-label="Borrador agrupado por categoría" style={{ display: 'grid', gap: 12 }}>
            <div style={categoryFilterLayout}><strong>Filtrar categoría:</strong>{['All', ...categoryFilters].map((category) => <button key={category} type="button" className="btn-secondary" aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)}>{category === 'All' ? 'Todos' : category}</button>)}</div>
            {visibleGroups.length === 0 ? <p>No hay platillos en esta categoría.</p> : visibleGroups.map((group) => <section key={group.name} aria-label={`Categoría ${group.name}`} style={{ display: 'grid', gap: 10 }}><h4 style={{ margin: 0 }}>{group.name} ({group.items.length})</h4>{group.items.map((item) => <DraftItemCard key={item.id} item={item} categories={categories} evidence={evidence.filter((entry) => entry.draft_item_id === item.id)} showSourceGeometry={showSourceGeometry} saving={savingId === item.id} onSave={saveItem} onRemove={removeItem} />)}</section>)}
          </section>}
          {issues.length > 0 && <section aria-label="Incidencias de extracción" style={{ display: 'grid', gap: 10 }}><h4 style={{ margin: 0 }}>Incidencias de extracción ({issues.length})</h4>{issues.map((issue, index) => <ExtractionIssueCard key={issue.id ?? issue.candidate_id ?? issue.candidateId ?? index} issue={issue} showSourceGeometry={showSourceGeometry} />)}</section>}
        </>}
        {textOnlyV5 && bulkEnabled && <div style={{ padding: 12, borderRadius: 6, background: 'var(--bg-base)', display: 'grid', gap: 8 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><div><strong>Aprobación asistida</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>El servidor revisa la elegibilidad actual; no publica el menú.</small></div><button className="btn-secondary" disabled={submitting || bulkState === 'loading'} onClick={approveAllEligible}>{bulkState === 'loading' ? 'Aprobando elegibles...' : 'Aprobar todos los elegibles'}</button></div>{bulkState === 'success' && bulkSummary && <p role="status" style={{ margin: 0 }}>{bulkApprovalSummaryText(bulkSummary)}</p>}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn-primary" disabled={submitting || validationCount > 0} onClick={publish}><Check size={16} /> Publicar aprobados</button></div>
      </>}
    </div>}
  </section>;
}

function ExtractionIssueCard({ issue, showSourceGeometry }: { issue: ExtractionIssue; showSourceGeometry: boolean }) {
  const page = issue.source_page ?? issue.sourcePage;
  const box = issue.source_bbox ?? issue.sourceBbox;
  const reasons = issueReasons(issue);
  const retryExhausted = issue.retry_exhausted ?? issue.retryExhausted;
  return <article style={{ padding: 16, background: 'var(--bg-surface-elevated)', border: '1px solid rgba(255,71,87,.4)', borderRadius: 10 }}>
    <strong>{issueLabel(issue)}</strong>
    <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>No se añadió como platillo.{page ? ` Página ${page}.` : ''}{showSourceGeometry && formatBox(box) ? ` Región: ${formatBox(box)}.` : ''}</p>
    <div role="alert" style={{ marginTop: 10, color: 'var(--primary)' }}><AlertTriangle size={14} /> {reasons.length ? reasons.join(' · ') : 'Fragmento rechazado durante la extracción'}{retryExhausted ? ' · Se agotaron los reintentos' : ''}</div>
  </article>;
}

function DraftItemCard({ item, categories, evidence, showSourceGeometry, saving, onSave, onRemove }: { item: DraftItem; categories: DraftCategory[]; evidence: Evidence[]; showSourceGeometry: boolean; saving: boolean; onSave: (item: DraftItem, patch: DraftItemPatch) => Promise<void>; onRemove: (item: DraftItem) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ name: item.name ?? '', description: item.description ?? '', rawPrice: item.raw_price ?? '', price: (item.normalized_price ?? item.price)?.toString() ?? '', currency: item.price_currency ?? '', categoryId: item.draft_category_id ?? item.category_id ?? '', sharedProvenance: item.shared_price_provenance ?? item.shared_price?.provenance ?? '', variants: priceVariants(item).map((variant) => ({ label: variant.label ?? variant.variant_label ?? '', raw: variant.raw ?? '', amount: (variant.normalized_amount ?? variant.amount)?.toString() ?? '', currency: variant.currency ?? '' })) });
  useEffect(() => setValues({ name: item.name ?? '', description: item.description ?? '', rawPrice: item.raw_price ?? '', price: (item.normalized_price ?? item.price)?.toString() ?? '', currency: item.price_currency ?? '', categoryId: item.draft_category_id ?? item.category_id ?? '', sharedProvenance: item.shared_price_provenance ?? item.shared_price?.provenance ?? '', variants: priceVariants(item).map((variant) => ({ label: variant.label ?? variant.variant_label ?? '', raw: variant.raw ?? '', amount: (variant.normalized_amount ?? variant.amount)?.toString() ?? '', currency: variant.currency ?? '' })) }), [item]);
  const problems = fieldProblems(item);
  const variants = priceVariants(item);
  const suggestedImage = item.image_suggestion?.url ?? item.image_url;
  const reviewReasons = [...new Set([...problems, ...evidence.flatMap((entry) => entry.review_reasons ?? [])])];
  const sourceBoxes = showSourceGeometry ? [...(item.source_bboxes ?? []), ...(item.source_bbox ? [item.source_bbox] : []), ...evidence.map((entry) => entry.source_bbox ?? entry.bounding_box).filter((box): box is SourceBox => Boolean(box))] : [];
  const ambiguousPrice = reviewReasons.includes('AMBIGUOUS_PRICE');
  const status = item.validation_status ?? item.validationStatus ?? item.extraction_status ?? item.extractionStatus ?? (problems.length ? 'review' : 'valid');
  const decision = providerDecisionPresentation(item);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedVariants = values.variants.map((variant) => ({ label: variant.label.trim() || null, raw: variant.raw.trim() || null, amount: variant.amount === '' ? null : Number(variant.amount), normalized_amount: variant.amount === '' ? null : Number(variant.amount), currency: variant.currency.trim().toUpperCase() || null })).filter((variant) => variant.label || variant.raw || variant.amount !== null);
    await onSave(item, { name: values.name, description: values.description, raw_price: values.rawPrice || null, price: values.price === '' ? null : Number(values.price), normalized_price: values.price === '' ? null : Number(values.price), price_currency: values.currency.trim().toUpperCase() || null, price_variants: normalizedVariants, shared_price_provenance: values.sharedProvenance.trim() || null, category_id: values.categoryId || null });
    setEditing(false);
  }

  return <article style={{ padding: 16, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
      <div><strong style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>{item.name || 'Platillo sin nombre'}</strong><p style={{ margin: '5px 0', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.45 }}>{categoryPath(item, categories)} · {formatPrice(item)} · Página {evidence[0]?.page_number ?? item.source_page ?? 'sin referencia'}</p><small style={{ color: status === 'valid' ? 'var(--text-muted)' : 'var(--primary)' }}>Estado: {status === 'valid' ? 'válido' : status === 'review' ? 'requiere revisión' : 'inválido'}</small>{decision.recommendation && <small style={{ display: 'block', color: 'var(--text-muted)' }}>Recomendación del modelo: {decision.recommendationLabel}{decision.confidencePercent !== undefined ? ` · confianza reportada: ${decision.confidencePercent}%` : ''}</small>}{item.parent_section_name && <small style={{ display: 'block', color: 'var(--text-muted)' }}>Sección padre: {item.parent_section_name}</small>}</div>
      <div style={{ display: 'flex', gap: 8 }}><button aria-label={`${ambiguousPrice ? 'Confirmar precio de' : 'Aprobar'} ${item.name || 'platillo'}`} title={ambiguousPrice ? 'Confirma el candidato después de asignar un precio' : 'Aprobar'} className="btn-secondary" disabled={saving || item.review_status === 'approved'} onClick={() => onSave(item, { approved: true })}><Check size={15} /></button><button aria-label={`Editar ${item.name || 'platillo'}`} className="btn-secondary" disabled={saving} onClick={() => setEditing((value) => !value)}><Pencil size={15} /></button><button aria-label={`Eliminar ${item.name || 'platillo'}`} className="btn-secondary" disabled={saving} onClick={() => onRemove(item)}><Trash2 size={15} /></button></div>
    </div>
    {variants.length > 0 && <div aria-label="Variantes de precio" style={{ display: 'grid', gap: 6, marginTop: 12, padding: 10, borderRadius: 6, background: 'var(--bg-base)' }}><strong>Variantes observadas</strong>{variants.map((variant, index) => <small key={`${variant.label ?? 'variante'}-${index}`} style={{ color: 'var(--text-muted)' }}>{variant.label ?? variant.variant_label ?? 'Sin etiqueta'}: {formatPrice(variant)}{variant.shared ? ' · precio compartido' : ''}</small>)}</div>}
    {(item.shared_price || item.shared_price_provenance) && <small style={{ display: 'block', marginTop: 10, color: 'var(--text-muted)' }}>Precio compartido{item.shared_price ? `: ${formatPrice(item.shared_price)}` : ''}{item.shared_price_provenance ? ` · Evidencia: ${item.shared_price_provenance}` : ''}</small>}
    {suggestedImage && <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}><img src={suggestedImage} alt={`Imagen sugerida para ${item.name || 'platillo'}`} style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 5 }} /><small style={{ color: 'var(--text-muted)' }}><ImageIcon size={13} /> Imagen sugerida{item.image_suggestion?.confidence ? ` (${Math.round(item.image_suggestion.confidence * 100)}% confianza)` : ''}</small></div>}
    {(evidence.length > 0 || sourceBoxes.length > 0) && <div aria-label="Evidencia de origen" style={{ marginTop: 10, display: 'grid', gap: 4 }}><strong style={{ fontSize: '.85rem' }}>Evidencia de origen</strong>{evidence.map((entry, index) => <small key={`${entry.page_number}-${index}`} style={{ color: 'var(--text-muted)' }}>Página {entry.page_number}{entry.excerpt ? ` · “${entry.excerpt}”` : ''}{showSourceGeometry && formatBox(entry.source_bbox ?? entry.bounding_box) ? ` · ${formatBox(entry.source_bbox ?? entry.bounding_box)}` : ''}</small>)}{sourceBoxes.map((box, index) => <small key={`box-${index}`} style={{ color: 'var(--text-muted)' }}>Región {index + 1}: {formatBox(box)}</small>)}</div>}
    {reviewReasons.length > 0 && <div role="alert" style={{ marginTop: 10, color: 'var(--primary)' }}><AlertTriangle size={14} /> {reviewReasons.join(' · ')}</div>}
    {editing && <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      <input aria-label="Nombre" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} style={inputStyle} />
      <textarea aria-label="Descripción" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} style={inputStyle} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><input aria-label="Precio observado" value={values.rawPrice} onChange={(event) => setValues({ ...values, rawPrice: event.target.value })} placeholder="Precio observado" style={inputStyle} /><input aria-label="Precio normalizado" type="number" min="0" step="0.01" value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} placeholder="Precio normalizado" style={inputStyle} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}><input aria-label="Moneda normalizada" value={values.currency} onChange={(event) => setValues({ ...values, currency: event.target.value })} placeholder="COP, USD…" style={inputStyle} /><select aria-label="Categoría" value={values.categoryId} onChange={(event) => setValues({ ...values, categoryId: event.target.value })} style={inputStyle}><option value="">Selecciona categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{categoryPath({ category_id: category.id } as DraftItem, categories)}</option>)}</select></div>
      <input aria-label="Procedencia de precio compartido" value={values.sharedProvenance} onChange={(event) => setValues({ ...values, sharedProvenance: event.target.value })} placeholder="Procedencia de precio compartido" style={inputStyle} />
      <fieldset style={{ margin: 0, padding: 10, border: '1px solid var(--border-color)', borderRadius: 6 }}><legend>Variantes de precio</legend>{values.variants.map((variant, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}><input aria-label={`Etiqueta de variante ${index + 1}`} value={variant.label} onChange={(event) => setValues({ ...values, variants: values.variants.map((entry, itemIndex) => itemIndex === index ? { ...entry, label: event.target.value } : entry) })} placeholder="Etiqueta" style={inputStyle} /><input aria-label={`Precio observado de variante ${index + 1}`} value={variant.raw} onChange={(event) => setValues({ ...values, variants: values.variants.map((entry, itemIndex) => itemIndex === index ? { ...entry, raw: event.target.value } : entry) })} placeholder="Observado" style={inputStyle} /><input aria-label={`Precio normalizado de variante ${index + 1}`} type="number" min="0" step="0.01" value={variant.amount} onChange={(event) => setValues({ ...values, variants: values.variants.map((entry, itemIndex) => itemIndex === index ? { ...entry, amount: event.target.value } : entry) })} placeholder="Normalizado" style={inputStyle} /><button className="btn-secondary" type="button" aria-label={`Quitar variante ${index + 1}`} onClick={() => setValues({ ...values, variants: values.variants.filter((_, itemIndex) => itemIndex !== index) })}>Quitar</button></div>)}<button className="btn-secondary" type="button" onClick={() => setValues({ ...values, variants: [...values.variants, { label: '', raw: '', amount: '', currency: values.currency }] })}>Añadir variante</button></fieldset>
      <button className="btn-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Guardar corrección'}</button>
    </form>}
  </article>;
}
