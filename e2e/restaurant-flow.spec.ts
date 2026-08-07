import { expect, request as playwrightRequest, test } from '@playwright/test';

const required = [
  'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY', 'E2E_MENU_ITEM_ID',
] as const;
const missing = required.filter((name) => !process.env[name]);

test('staff, mobile recovery, order, KDS, delivery, and checkout', async ({ baseURL }) => {
  if (missing.length) {
    if (process.env.E2E_REQUIRE_FULL === 'true') throw new Error(`Missing full E2E configuration: ${missing.join(', ')}`);
    test.skip(true, 'Dedicated staging credentials and menu fixture are required');
  }

  const auth = await playwrightRequest.newContext({ baseURL: process.env.E2E_SUPABASE_URL });
  const signIn = await auth.post('/auth/v1/token?grant_type=password', {
    headers: { apikey: process.env.E2E_SUPABASE_ANON_KEY!, Authorization: `Bearer ${process.env.E2E_SUPABASE_ANON_KEY}` },
    data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  });
  expect(signIn.ok()).toBeTruthy();
  const accessToken = (await signIn.json()).access_token as string;
  await auth.dispose();

  const admin = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });
  let tableId: string | undefined;
  let staffUserId: string | undefined;
  let orderId: string | undefined;

  try {
    const suffix = Date.now();
    const staffResponse = await admin.post('/api/staff', {
      data: { name: 'E2E Cocina', email: `teburu-e2e-${suffix}@example.invalid`, password: `E2e-Strong-${suffix}!`, role: 'kitchen' },
    });
    expect(staffResponse.status()).toBe(201);
    staffUserId = (await staffResponse.json()).data.user_id;

    const tableResponse = await admin.post('/api/admin/tables', { data: { table_number: 800000 + (suffix % 100000) } });
    expect(tableResponse.status()).toBe(201);
    tableId = (await tableResponse.json()).data.id;

    const pinResponse = await admin.post('/api/table/generate-pin', { data: { table_id: tableId } });
    expect(pinResponse.ok()).toBeTruthy();
    const pin = (await pinResponse.json()).pin;

    const guest = await playwrightRequest.newContext({ baseURL });
    const join = await guest.post('/api/table/join', { data: { table_id: tableId, code: pin, name: 'Invitado E2E' } });
    expect(join.ok()).toBeTruthy();
    const state = await guest.storageState();
    await guest.dispose();

    const restoredGuest = await playwrightRequest.newContext({ baseURL, storageState: state });
    const restored = await restoredGuest.get(`/api/table/session?table_id=${tableId}`);
    expect(restored.ok()).toBeTruthy();
    await expect(restored.json()).resolves.toMatchObject({ table_id: tableId, name: 'Invitado E2E' });

    const order = await restoredGuest.post('/api/order/create', {
      data: { items: [{ menu_item_id: process.env.E2E_MENU_ITEM_ID, qty: 1, notes: 'E2E' }] },
    });
    expect(order.ok()).toBeTruthy();
    orderId = (await order.json()).order_id;

    const kds = await admin.get('/api/kds');
    const kitchenItems = (await kds.json()).data.filter((item: { order_id: string }) => item.order_id === orderId);
    expect(kitchenItems.length).toBeGreaterThan(0);
    for (const item of kitchenItems) {
      const preparing = await admin.post('/api/kds/update', {
        data: { item_id: item.item_id, status: 'preparing', version: item.version },
      });
      expect(preparing.ok()).toBeTruthy();
      const ready = await admin.post('/api/kds/update', {
        data: { item_id: item.item_id, status: 'ready', version: (await preparing.json()).version },
      });
      expect(ready.ok()).toBeTruthy();
    }

    expect((await admin.post('/api/orders/deliver', { data: { order_id: orderId } })).ok()).toBeTruthy();
    expect((await admin.post('/api/table/checkout', { data: { table_id: tableId } })).ok()).toBeTruthy();
    expect((await restoredGuest.get(`/api/table/session?table_id=${tableId}`)).status()).toBe(401);
    await restoredGuest.dispose();
  } finally {
    if (tableId) {
      await admin.post('/api/table/checkout', { data: { table_id: tableId } }).catch(() => undefined);
      await admin.delete(`/api/admin/tables?id=${encodeURIComponent(tableId)}`).catch(() => undefined);
    }
    if (staffUserId) await admin.delete(`/api/staff?user_id=${encodeURIComponent(staffUserId)}`).catch(() => undefined);
    await admin.dispose();
  }
});
