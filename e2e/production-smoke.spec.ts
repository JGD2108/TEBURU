import { expect, test } from '@playwright/test';

test('health, public catalog, and anonymous authorization boundary', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  await expect(health.json()).resolves.toMatchObject({ status: 'ok', database: 'ok' });

  const catalog = await request.get('/api/public/catalog');
  expect(catalog.ok()).toBeTruthy();
  await expect(catalog.json()).resolves.toEqual(expect.objectContaining({ categories: expect.any(Array), items: expect.any(Array) }));

  for (const path of ['/api/admin/menu', '/api/admin/tables', '/api/admin/settings', '/api/history', '/api/kds']) {
    expect((await request.get(path)).status(), `${path} must reject anonymous access`).toBe(401);
  }
});
