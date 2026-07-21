import { getServers, publicServer, type ServerDef } from "./registry";
import { getStatus } from "./ssh";
import { getCachedMetrics } from "./metricsCache";
import { checkService } from "./health";

/** Build a server payload including live status for each service (fetched concurrently). */
export async function serverWithStatus(server: ServerDef) {
  const base = publicServer(server);
  const metricsPromise = getCachedMetrics(server);
  const statuses = await Promise.all(
    server.services.map(async (svc) => {
      // Prefer a real network health check when one is defined; else fall back to systemd/SSH.
      const info = await (svc.check ? checkService(server, svc) : getStatus(server, svc)).catch(() => ({
        status: "unknown" as const,
        uptimeSeconds: null,
        since: null,
      }));
      return [svc.id, info] as const;
    })
  );
  const map = Object.fromEntries(statuses);
  const online = Object.values(map).some((s) => s.status !== "unknown");
  return {
    ...base,
    online,
    metrics: await metricsPromise,
    services: base.services.map((s) => ({ ...s, ...map[s.id] })),
  };
}

export async function allServersWithStatus() {
  return Promise.all(getServers().map(serverWithStatus));
}
