export type BillSplitMode = 'own_items' | 'equal' | 'custom';

export type BillParticipantInput = { guestId: string; amount?: number };

export function splitTotal(
  mode: BillSplitMode,
  guests: { id: string; ownTotal: number }[],
  total: number,
  requestedBy: string,
  custom: BillParticipantInput[] = [],
) {
  if (!Number.isFinite(total) || total < 0 || guests.length === 0) throw new Error('INVALID_SPLIT');
  const cents = Math.round(total * 100);
  if (mode === 'own_items') return guests.map((guest) => ({ guestId: guest.id, amount: Math.round(guest.ownTotal * 100) / 100 }));
  if (mode === 'equal') {
    const base = Math.floor(cents / guests.length);
    return guests.map((guest, index) => ({ guestId: guest.id, amount: (base + (index < cents % guests.length ? 1 : 0)) / 100 }));
  }
  const expected = new Set(guests.map((guest) => guest.id));
  if (custom.length !== guests.length || custom.some((entry) => !expected.has(entry.guestId) || !Number.isFinite(entry.amount) || (entry.amount ?? 0) < 0)) throw new Error('INVALID_SPLIT');
  const requested = custom.find((entry) => entry.guestId === requestedBy);
  if (!requested || Math.round(custom.reduce((sum, entry) => sum + (entry.amount ?? 0), 0) * 100) !== cents) throw new Error('INVALID_SPLIT');
  return custom.map((entry) => ({ guestId: entry.guestId, amount: Math.round((entry.amount ?? 0) * 100) / 100 }));
}
