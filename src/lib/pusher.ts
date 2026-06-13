import Pusher from "pusher";

/**
 * Returns true only when every required Pusher env var is set AND none of them
 * still contain a placeholder value (e.g. the default "your-..." stubs shipped
 * in .env.local). When this returns false the app must degrade to local-only mode.
 */
export function isPusherConfigured(): boolean {
  const vars = [
    process.env.PUSHER_APP_ID,
    process.env.PUSHER_KEY,
    process.env.PUSHER_SECRET,
    process.env.PUSHER_CLUSTER,
  ];

  return vars.every((v) => {
    if (!v || typeof v !== "string") return false;
    const trimmed = v.trim();
    if (trimmed.length === 0) return false;
    // Reject obvious placeholders like "your-app-id", "your-pusher-key", etc.
    if (trimmed.toLowerCase().includes("your")) return false;
    return true;
  });
}

let cachedServer: Pusher | null = null;

/**
 * Lazily creates (and caches) the server-side Pusher instance.
 * Throws a clear Error if Pusher is not configured — callers should guard
 * with isPusherConfigured() first.
 */
export function getPusherServer(): Pusher {
  if (!isPusherConfigured()) {
    throw new Error(
      "Pusher belum dikonfigurasi: set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, dan PUSHER_CLUSTER di .env.local."
    );
  }

  if (!cachedServer) {
    cachedServer = new Pusher({
      appId: process.env.PUSHER_APP_ID as string,
      key: process.env.PUSHER_KEY as string,
      secret: process.env.PUSHER_SECRET as string,
      cluster: process.env.PUSHER_CLUSTER as string,
      useTLS: true,
    });
  }

  return cachedServer;
}
