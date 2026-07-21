/**
 * Metrics cache: the dashboard status polls every ~10s, but SSH is comparatively
 * expensive, so we open an SSH connection and collect CPU/RAM/disk at most once per
 * minute per server. Requests within the TTL get the cached value instantly; once the
 * value goes stale we return the last known value immediately and refresh in the
 * background (single-flight, so overlapping requests share one SSH connection).
 */
import { getMetrics, type ServerMetrics } from "./ssh";
import type { ServerDef } from "./registry";

const TTL_MS = 60_000; // refresh over SSH at most once per minute

interface Entry {
  data: ServerMetrics;
  at: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<ServerMetrics>>();

function refresh(server: ServerDef): Promise<ServerMetrics> {
  let p = inflight.get(server.id);
  if (p) return p;
  p = getMetrics(server)
    .then((data) => {
      cache.set(server.id, { data, at: Date.now() });
      return data;
    })
    .finally(() => inflight.delete(server.id));
  inflight.set(server.id, p);
  return p;
}

function withMeta(entry: Entry): ServerMetrics {
  return { ...entry.data, updatedAt: new Date(entry.at).toISOString() };
}

export async function getCachedMetrics(server: ServerDef): Promise<ServerMetrics> {
  const entry = cache.get(server.id);
  const fresh = entry && Date.now() - entry.at < TTL_MS;

  if (fresh) return withMeta(entry!);

  // Stale but present: serve it now, refresh in the background (don't block the dashboard).
  if (entry) {
    void refresh(server);
    return withMeta(entry);
  }

  // First load for this server: wait for the initial SSH collection.
  const data = await refresh(server);
  return withMeta(cache.get(server.id) ?? { data, at: Date.now() });
}
