import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { getPoolClient } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin', 'kitchen');
  if (isAuthorizationFailure(staff)) return staff;

  const client = await getPoolClient();
  await client.query('LISTEN teburu_kds');

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let close: (() => Promise<void>) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: string) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };
      const onNotification = (message: { channel: string; payload?: string }) => {
        if (message.channel === 'teburu_kds') send('change', message.payload || '{}');
      };

      close = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        request.signal.removeEventListener('abort', onAbort);
        client.removeListener('notification', onNotification);
        await client.query('UNLISTEN teburu_kds').catch(() => undefined);
        client.release();
        try { controller.close(); } catch { /* stream already closed */ }
      };
      const onAbort = () => { void close?.(); };

      client.on('notification', onNotification);
      request.signal.addEventListener('abort', onAbort, { once: true });
      send('connected', JSON.stringify({ connected: true }));
      heartbeat = setInterval(() => send('heartbeat', '{}'), 20000);
    },
    cancel() {
      return close?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
