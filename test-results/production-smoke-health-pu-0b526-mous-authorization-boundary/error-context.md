# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: production-smoke.spec.ts >> health, public catalog, and anonymous authorization boundary
- Location: e2e\production-smoke.spec.ts:3:5

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:3000
Call log:
  - → GET http://127.0.0.1:3000/api/health
    - user-agent: Playwright/1.62.1 (x64; windows 10.0) node/24.11
    - accept: */*
    - accept-encoding: gzip,deflate,br

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('health, public catalog, and anonymous authorization boundary', async ({ request }) => {
> 4  |   const health = await request.get('/api/health');
     |                                ^ Error: apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:3000
  5  |   expect(health.ok()).toBeTruthy();
  6  |   await expect(health.json()).resolves.toMatchObject({ status: 'ok', database: 'ok' });
  7  | 
  8  |   const catalog = await request.get('/api/public/catalog');
  9  |   expect(catalog.ok()).toBeTruthy();
  10 |   await expect(catalog.json()).resolves.toEqual(expect.objectContaining({ categories: expect.any(Array), items: expect.any(Array) }));
  11 | 
  12 |   for (const path of ['/api/admin/menu', '/api/admin/tables', '/api/admin/settings', '/api/history', '/api/kds']) {
  13 |     expect((await request.get(path)).status(), `${path} must reject anonymous access`).toBe(401);
  14 |   }
  15 | });
  16 | 
```