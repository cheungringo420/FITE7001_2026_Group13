import { getMarketSnapshot, subscribeToMarketSnapshots } from '@/lib/realtime/market-stream';

export async function GET() {
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let pingInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (snapshot: unknown) => {
        controller.enqueue(
          encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
        );
      };

      controller.enqueue(encoder.encode(`: connected\n\n`));
      send(getMarketSnapshot());

      unsubscribe = subscribeToMarketSnapshots((snapshot) => {
        send(snapshot);
      });

      pingInterval = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 15000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (pingInterval) clearInterval(pingInterval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
