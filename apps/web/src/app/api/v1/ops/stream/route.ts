import { subscribeOpsEvents } from "@/lib/events";
import { getOpsSession } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/stream — Server-Sent Events feed of new/updated requests.
// The dashboard also polls, so SSE is an enhancement, not the source of truth.
export async function GET() {
  const session = await getOpsSession();
  if (!session) {
    return new Response("event: error\ndata: unauthorized\n\n", {
      status: 401,
      headers: { "content-type": "text/event-stream" },
    });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));
      send(`event: ready\ndata: {"ok":true}\n\n`);

      unsubscribe = subscribeOpsEvents((event) => {
        try {
          send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        } catch {
          /* controller closed */
        }
      });

      // Keep the connection alive through proxies.
      heartbeat = setInterval(() => {
        try {
          send(`: ping\n\n`);
        } catch {
          /* closed */
        }
      }, 25_000);
    },
    cancel() {
      unsubscribe();
      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
