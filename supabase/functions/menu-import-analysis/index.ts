const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WebhookEvent = { type?: unknown; schema?: unknown; table?: unknown; record?: { id?: unknown } };

function validEvent(value: WebhookEvent | null): value is Required<Pick<WebhookEvent, 'type' | 'schema' | 'table'>> & { record: { id: string } } {
  return value?.type === 'INSERT' && value.schema === 'public' && value.table === 'menu_import_jobs'
    && typeof value.record?.id === 'string' && UUID.test(value.record.id);
}

function sameSecret(supplied: string | null, expected: string | undefined) {
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < expected.length; index += 1) result |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  return result === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (!sameSecret(request.headers.get('apikey'), Deno.env.get('MENU_IMPORT_WEBHOOK_SECRET'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let payload: WebhookEvent | null;
  try { payload = await request.json() as WebhookEvent; } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!validEvent(payload)) return Response.json({ error: 'Invalid menu import event' }, { status: 400 });

  const target = Deno.env.get('MENU_IMPORT_WORKER_TARGET_URL');
  const appSecret = Deno.env.get('MENU_IMPORT_AUTOMATION_SECRET');
  if (!target || !appSecret) return Response.json({ error: 'Worker target is not configured' }, { status: 503 });
  const forwarded = await fetch(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: appSecret },
    body: JSON.stringify({ type: 'INSERT', schema: 'public', table: 'menu_import_jobs', record: { id: payload.record.id } }),
  });
  return new Response(forwarded.body, { status: forwarded.status, headers: { 'content-type': forwarded.headers.get('content-type') ?? 'application/json' } });
});
