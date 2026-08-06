'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ArrowDownUp, Check, Plus, Power, Save, Trash2, Workflow } from 'lucide-react';
import { staffFetch } from '@/lib/api-client';
import styles from './StationsPanel.module.css';

type Station = {
  id: string; name: string; color: string; sort_order: number; is_active: boolean; item_count: number;
  warning_minutes: number; critical_minutes: number;
};
type MenuItem = { id: string; name: string; is_available: boolean; station_ids: string[] };
type Draft = { name: string; color: string; sort_order: number; warning_minutes: number; critical_minutes: number };

export default function StationsPanel() {
  const [stations, setStations] = useState<Station[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [draft, setDraft] = useState<Draft>({ name: '', color: '#ff6b35', sort_order: 0, warning_minutes: 10, critical_minutes: 20 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await staffFetch('/api/kitchen/stations');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo cargar la configuración');
    setStations(payload.data.stations);
    setItems(payload.data.menu_items);
    setLoading(false);
  }, []);

  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, [load]);

  const createStation = async (event: FormEvent) => {
    event.preventDefault();
    setSaving('new');
    const response = await staffFetch('/api/kitchen/stations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    });
    const payload = await response.json();
    setSaving(null);
    if (!response.ok) return setMessage(payload.error);
    setDraft({ name: '', color: '#ff6b35', sort_order: stations.length, warning_minutes: 10, critical_minutes: 20 });
    setMessage('Estación creada');
    await load();
  };

  const saveStation = async (station: Station) => {
    setSaving(station.id);
    const response = await staffFetch('/api/kitchen/stations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(station),
    });
    const payload = await response.json();
    setSaving(null);
    if (!response.ok) return setMessage(payload.error);
    setMessage('Cambios guardados');
    await load();
  };

  const deleteStation = async (station: Station) => {
    if (!window.confirm(`¿Eliminar la estación “${station.name}”? Los platillos quedarán sin asignación.`)) return;
    setSaving(station.id);
    const response = await staffFetch('/api/kitchen/stations', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: station.id }),
    });
    const payload = await response.json();
    setSaving(null);
    if (!response.ok) return setMessage(payload.error);
    setMessage('Estación eliminada');
    await load();
  };

  const toggleAssignment = async (item: MenuItem, stationId: string) => {
    const stationIds = item.station_ids.includes(stationId)
      ? item.station_ids.filter((id) => id !== stationId)
      : [...item.station_ids, stationId];
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, station_ids: stationIds } : entry));
    const response = await staffFetch('/api/kitchen/stations/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_item_id: item.id, station_ids: stationIds }),
    });
    if (!response.ok) {
      setMessage('No se pudo guardar la asignación');
      await load();
    }
  };

  const visibleItems = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const updateStation = (id: string, patch: Partial<Station>) => setStations((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));

  if (loading) return <div className={styles.loading}>Cargando mapa de producción…</div>;

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div><span><Workflow size={15} /> Configuración operativa</span><h2>Estaciones de cocina</h2><p>Diseña el recorrido de cada platillo según la operación de tu restaurante.</p></div>
        <div className={styles.metric}><b>{stations.filter((station) => station.is_active).length}</b><small>estaciones activas</small></div>
      </header>

      {message && <button className={styles.message} onClick={() => setMessage(null)}><Check size={15} />{message}</button>}

      <form className={styles.create} onSubmit={createStation}>
        <div><label>Nueva estación</label><input required maxLength={60} placeholder="Ej. Parrilla, Barra, Café…" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
        <div><label>Color operativo</label><input className={styles.color} type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></div>
        <div><label>Orden</label><input type="number" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })} /></div>
        <div><label>Alerta (min)</label><input type="number" min={1} value={draft.warning_minutes} onChange={(event) => setDraft({ ...draft, warning_minutes: Number(event.target.value) })} /></div>
        <div><label>Crítico (min)</label><input type="number" min={2} value={draft.critical_minutes} onChange={(event) => setDraft({ ...draft, critical_minutes: Number(event.target.value) })} /></div>
        <button disabled={saving === 'new'}><Plus size={18} />Crear estación</button>
      </form>

      <div className={styles.stationGrid}>
        {stations.map((station) => (
          <article key={station.id} className={styles.stationCard} style={{ '--station-color': station.color } as React.CSSProperties}>
            <div className={styles.cardTop}><span className={styles.swatch} /><span>{station.item_count} platillos</span></div>
            <input className={styles.stationName} value={station.name} onChange={(event) => updateStation(station.id, { name: event.target.value })} />
            <div className={styles.cardControls}>
              <label><input type="color" value={station.color} onChange={(event) => updateStation(station.id, { color: event.target.value })} /><span>Color</span></label>
              <label><ArrowDownUp size={14} /><input type="number" value={station.sort_order} onChange={(event) => updateStation(station.id, { sort_order: Number(event.target.value) })} /></label>
              <button className={station.is_active ? styles.active : styles.inactive} onClick={() => updateStation(station.id, { is_active: !station.is_active })} type="button"><Power size={15} />{station.is_active ? 'Activa' : 'Pausada'}</button>
            </div>
            <div className={styles.slaControls}>
              <label>Alerta<input type="number" min={1} value={station.warning_minutes} onChange={(event) => updateStation(station.id, { warning_minutes: Number(event.target.value) })} /><span>min</span></label>
              <label>Crítico<input type="number" min={2} value={station.critical_minutes} onChange={(event) => updateStation(station.id, { critical_minutes: Number(event.target.value) })} /><span>min</span></label>
            </div>
            <div className={styles.cardActions}>
              <button onClick={() => void saveStation(station)} disabled={saving === station.id}><Save size={16} />Guardar</button>
              <button className={styles.delete} onClick={() => void deleteStation(station)} disabled={saving === station.id}><Trash2 size={16} /></button>
            </div>
          </article>
        ))}
        {!stations.length && <div className={styles.noStations}><Archive size={24} /><b>Aún no hay estaciones</b><span>Crea la primera según tu tipo de restaurante.</span></div>}
      </div>

      <section className={styles.routing}>
        <header><div><h3>Ruteo de platillos</h3><p>Un platillo puede enviarse a varias estaciones.</p></div><input type="search" placeholder="Buscar platillo…" value={search} onChange={(event) => setSearch(event.target.value)} /></header>
        <div className={styles.itemList}>
          {visibleItems.map((item) => (
            <div key={item.id} className={styles.itemRow}>
              <div><b>{item.name}</b><small>{item.is_available ? 'Disponible' : 'Agotado'}</small></div>
              <div className={styles.assignments}>
                {stations.map((station) => {
                  const selected = item.station_ids.includes(station.id);
                  return <button key={station.id} className={selected ? styles.assigned : styles.unassigned} style={selected ? { borderColor: station.color } : undefined} onClick={() => void toggleAssignment(item, station.id)}><i style={{ background: station.color }} />{station.name}{selected && <Check size={13} />}</button>;
                })}
                {!stations.length && <span>Primero crea una estación</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
