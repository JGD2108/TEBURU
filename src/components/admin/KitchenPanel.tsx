'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChefHat, Clock3, RefreshCw, UtensilsCrossed,
  Volume2, VolumeX, Wifi, WifiOff, X, Zap,
} from 'lucide-react';
import { staffFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import styles from './KitchenPanel.module.css';

type Station = {
  id: string; name: string; color: string;
  warning_minutes: number; critical_minutes: number;
};
type KitchenStatus = 'pending' | 'preparing' | 'ready';
type Priority = 'normal' | 'high' | 'urgent';
type KitchenItem = {
  item_id: string; order_id: string; quantity: number; notes: string | null;
  status: KitchenStatus; priority: Priority; version: number; created_at: string;
  table_number: number; customer_name: string; menu_item: string; stations: Station[];
};
type ConnectionState = 'connecting' | 'live' | 'offline';

const lanes: { status: KitchenStatus; label: string; hint: string; next?: 'preparing' | 'ready'; bulk: string }[] = [
  { status: 'pending', label: 'Nuevos', hint: 'Esperando inicio', next: 'preparing', bulk: 'Iniciar todos' },
  { status: 'preparing', label: 'En preparación', hint: 'Trabajo activo', next: 'ready', bulk: 'Terminar todos' },
  { status: 'ready', label: 'Listos', hint: 'Esperando retiro', bulk: '' },
];
const priorityLabels: Record<Priority, string> = { normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
const nextPriority: Record<Priority, Priority> = { normal: 'high', high: 'urgent', urgent: 'normal' };

export default function KitchenPanel() {
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [station, setStation] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundRef = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('teburu:kds:sound:v1') === 'on';
    soundRef.current = saved;
    setSoundEnabled(saved);
  }, []);

  const beep = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.28);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.3);
    oscillator.addEventListener('ended', () => void audio.close(), { once: true });
  }, []);

  const loadStations = useCallback(async () => {
    const response = await staffFetch('/api/kitchen/stations');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las estaciones');
    setStations(payload.data.stations);
  }, []);

  const loadItems = useCallback(async () => {
    const suffix = station === 'all' ? '' : `?station=${encodeURIComponent(station)}`;
    const response = await staffFetch(`/api/kds${suffix}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las comandas');
    setItems((current) => {
      const known = new Set(current.filter((item) => item.status === 'pending').map((item) => item.item_id));
      const hasNewTicket = current.length > 0 && payload.data.some((item: KitchenItem) => item.status === 'pending' && !known.has(item.item_id));
      if (hasNewTicket && soundRef.current) beep();
      return payload.data;
    });
  }, [beep, station]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await Promise.all([loadStations(), loadItems()]);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'No se pudo actualizar el KDS');
    } finally {
      setLoading(false);
    }
  }, [loadItems, loadStations]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void loadItems().catch(() => undefined), 60000);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { window.clearInterval(poll); window.clearInterval(timer); };
  }, [loadItems, refresh]);

  useEffect(() => {
    let refreshTimer: number | undefined;
    const refreshFromRealtime = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void Promise.all([loadItems(), loadStations()]), 250);
    };
    const channel = supabase
      .channel('teburu-kds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refreshFromRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_stations' }, refreshFromRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_stations' }, refreshFromRealtime)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnection('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setConnection('offline');
        else setConnection('connecting');
      });

    const onOffline = () => setConnection('offline');
    const onOnline = () => setConnection('connecting');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [loadItems, loadStations]);

  const transition = async (item: KitchenItem, status: 'preparing' | 'ready' | 'cancelled') => {
    const reason = status === 'cancelled' ? window.prompt('Motivo de cancelación')?.trim() : undefined;
    if (status === 'cancelled' && (!reason || reason.length < 3)) return;
    setUpdating(item.item_id);
    setError(null);
    const previous = items;
    setItems((current) => status === 'cancelled'
      ? current.filter((entry) => entry.item_id !== item.item_id)
      : current.map((entry) => entry.item_id === item.item_id ? { ...entry, status, version: entry.version + 1 } : entry));
    try {
      const response = await staffFetch('/api/kds/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.item_id, status, version: item.version, reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar');
    } catch (transitionError) {
      setItems(previous);
      setError(transitionError instanceof Error ? transitionError.message : 'Acción fallida');
      await loadItems().catch(() => undefined);
    } finally {
      setUpdating(null);
    }
  };

  const changePriority = async (item: KitchenItem) => {
    const priority = nextPriority[item.priority];
    setUpdating(item.item_id);
    setItems((current) => current.map((entry) => entry.item_id === item.item_id ? { ...entry, priority, version: entry.version + 1 } : entry));
    try {
      const response = await staffFetch('/api/kds/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.item_id, priority, version: item.version }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo cambiar la prioridad');
    } catch (priorityError) {
      setError(priorityError instanceof Error ? priorityError.message : 'Acción fallida');
      await loadItems().catch(() => undefined);
    } finally { setUpdating(null); }
  };

  const bulkTransition = async (status: KitchenStatus, next: 'preparing' | 'ready') => {
    const laneItems = items.filter((item) => item.status === status);
    if (!laneItems.length || !window.confirm(`¿Aplicar la acción a ${laneItems.length} platillos?`)) return;
    setUpdating(`bulk-${status}`);
    try {
      const response = await staffFetch('/api/kds/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, items: laneItems.map(({ item_id, version }) => ({ item_id, version })) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar el lote');
      await loadItems();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Acción masiva fallida');
    } finally { setUpdating(null); }
  };

  const toggleSound = () => {
    const enabled = !soundEnabled;
    soundRef.current = enabled;
    setSoundEnabled(enabled);
    window.localStorage.setItem('teburu:kds:sound:v1', enabled ? 'on' : 'off');
    if (enabled) beep();
  };

  const counts = useMemo(() => Object.fromEntries(lanes.map((lane) => [lane.status, items.filter((item) => item.status === lane.status).length])), [items]);
  const elapsed = (createdAt: string) => Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  const thresholds = (item: KitchenItem) => ({
    warning: item.stations.length ? Math.min(...item.stations.map((entry) => entry.warning_minutes)) : 10,
    critical: item.stations.length ? Math.min(...item.stations.map((entry) => entry.critical_minutes)) : 20,
  });

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}><UtensilsCrossed size={14} /> Línea de producción</span><h2>Monitor de cocina</h2><p>Platillos organizados por estación y momento de preparación.</p></div>
        <div className={styles.headerActions}>
          <span className={`${styles.connection} ${styles[connection]}`}>{connection === 'live' ? <Wifi size={15} /> : <WifiOff size={15} />}{connection === 'live' ? 'En vivo' : connection === 'connecting' ? 'Conectando' : 'Sin conexión'}</span>
          <button className={styles.iconButton} onClick={toggleSound} aria-label={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className={styles.refresh} onClick={() => void refresh()}><RefreshCw size={18} /> Actualizar</button>
        </div>
      </header>

      <div className={styles.filters} role="tablist" aria-label="Filtrar por estación">
        <button className={station === 'all' ? styles.filterActive : styles.filter} onClick={() => setStation('all')}>Toda la cocina</button>
        {stations.map((entry) => <button key={entry.id} className={station === entry.id ? styles.filterActive : styles.filter} onClick={() => setStation(entry.id)}><span className={styles.dot} style={{ background: entry.color }} />{entry.name}</button>)}
        <button className={station === 'unassigned' ? styles.filterActive : styles.filter} onClick={() => setStation('unassigned')}>Sin estación</button>
      </div>

      {error && <div className={styles.error}><AlertTriangle size={17} />{error}</div>}
      {loading ? <div className={styles.loading}>Preparando la línea de cocina…</div> : (
        <div className={styles.board}>
          {lanes.map((lane) => (
            <section key={lane.status} className={styles.lane} data-status={lane.status}>
              <header className={styles.laneHeader}>
                <div><h3>{lane.label}</h3><p>{lane.hint}</p></div>
                <div className={styles.laneTools}>{lane.next && Boolean(counts[lane.status]) && <button disabled={updating !== null} onClick={() => void bulkTransition(lane.status, lane.next!)}>{lane.bulk}</button>}<strong>{counts[lane.status] ?? 0}</strong></div>
              </header>
              <div className={styles.stack}>
                {items.filter((item) => item.status === lane.status).map((item) => {
                  const minutes = elapsed(item.created_at);
                  const sla = thresholds(item);
                  const slaClass = minutes >= sla.critical ? styles.ticketLate : minutes >= sla.warning ? styles.ticketWarning : '';
                  return (
                    <article key={item.item_id} className={`${styles.ticket} ${slaClass}`}>
                      <div className={styles.ticketTop}><div><span>Mesa {item.table_number}</span><small>{item.customer_name}</small></div><span className={styles.timer}><Clock3 size={14} />{minutes} min</span></div>
                      <div className={styles.dish}><b>{item.quantity}×</b><h4>{item.menu_item}</h4></div>
                      <button className={styles.priority} data-priority={item.priority} disabled={updating === item.item_id} onClick={() => void changePriority(item)}><Zap size={13} />{priorityLabels[item.priority]}</button>
                      <div className={styles.stationTags}>{item.stations.length ? item.stations.map((entry) => <span key={entry.id} style={{ borderColor: entry.color }}><i style={{ background: entry.color }} />{entry.name}</span>) : <span className={styles.unassigned}>Sin estación asignada</span>}</div>
                      {item.notes && <p className={styles.notes}><AlertTriangle size={15} />{item.notes}</p>}
                      <div className={styles.actions}>
                        {item.status === 'pending' && <button disabled={updating === item.item_id} onClick={() => void transition(item, 'preparing')}><ChefHat size={18} />Iniciar</button>}
                        {item.status === 'preparing' && <button disabled={updating === item.item_id} onClick={() => void transition(item, 'ready')}><Check size={18} />Marcar listo</button>}
                        {item.status !== 'ready' && <button className={styles.cancel} disabled={updating === item.item_id} onClick={() => void transition(item, 'cancelled')} aria-label="Cancelar platillo"><X size={17} /></button>}
                        {item.status === 'ready' && <span className={styles.readyLabel}><Check size={17} />Listo para retirar</span>}
                      </div>
                    </article>
                  );
                })}
                {!items.some((item) => item.status === lane.status) && <div className={styles.empty}>Sin platillos en este carril</div>}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

declare global {
  interface Window { webkitAudioContext?: typeof AudioContext }
}
