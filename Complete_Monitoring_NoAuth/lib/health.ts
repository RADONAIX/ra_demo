/**
 * Network health checks run from the dashboard host — real status without SSH.
 *
 *  tcp        -> connect succeeds => running, refused => stopped, timeout => unknown
 *  http       -> 2xx (+ optional body substring) => running, non-2xx => failed, no conn => stopped
 *  http_json  -> read a dotted jsonPath and compare to healthyValue (Airflow /health)
 *
 * These run regardless of MOCK_MODE (they are safe, read-only, and give live status even
 * when SSH credentials for control actions are not configured).
 */
import net from "node:net";
import type { CheckDef, ServerDef, ServiceDef } from "./registry";
import type { StatusInfo } from "./ssh";

const TIMEOUT_MS = 5000;

function unknown(raw?: string): StatusInfo {
  return { status: "unknown", uptimeSeconds: null, since: null, raw };
}

function tcpCheck(host: string, port: number): Promise<StatusInfo> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(TIMEOUT_MS);
    const finish = (info: StatusInfo) => {
      socket.destroy();
      resolve(info);
    };
    socket.on("connect", () => finish({ status: "running", uptimeSeconds: null, since: null, raw: `tcp ${host}:${port} open` }));
    socket.on("timeout", () => finish(unknown(`tcp ${host}:${port} timeout`)));
    socket.on("error", (e: NodeJS.ErrnoException) =>
      finish(e.code === "ECONNREFUSED"
        ? { status: "stopped", uptimeSeconds: null, since: null, raw: e.code }
        : unknown(`tcp ${host}:${port} ${e.code}`))
    );
  });
}

async function httpFetch(host: string, c: CheckDef): Promise<{ ok: boolean; status: number; body: string } | null> {
  const url = `http://${host}:${c.port}${c.path ?? "/"}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "manual" });
    const body = await res.text().catch(() => "");
    return { ok: res.status >= 200 && res.status < 400, status: res.status, body };
  } catch {
    return null; // connection failed
  }
}

async function httpCheck(host: string, c: CheckDef): Promise<StatusInfo> {
  const r = await httpFetch(host, c);
  if (!r) return { status: "stopped", uptimeSeconds: null, since: null, raw: "no connection" };
  const bodyOk = c.expectBody ? r.body.includes(c.expectBody) : true;
  if (r.ok && bodyOk) return { status: "running", uptimeSeconds: null, since: null, raw: `HTTP ${r.status}` };
  return { status: "failed", uptimeSeconds: null, since: null, raw: `HTTP ${r.status}` };
}

function readPath(obj: any, dotted: string): any {
  return dotted.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

async function httpJsonCheck(host: string, c: CheckDef): Promise<StatusInfo> {
  const r = await httpFetch(host, c);
  if (!r) return { status: "stopped", uptimeSeconds: null, since: null, raw: "no connection" };
  let value: any;
  try {
    value = readPath(JSON.parse(r.body), c.jsonPath ?? "");
  } catch {
    return unknown("bad json");
  }
  if (value == null) return unknown(`no ${c.jsonPath}`);
  const healthy = value === (c.healthyValue ?? "healthy");
  return {
    status: healthy ? "running" : "failed",
    uptimeSeconds: null,
    since: null,
    raw: `${c.jsonPath}=${value}`,
  };
}

export async function checkService(server: ServerDef, service: ServiceDef): Promise<StatusInfo> {
  const c = service.check!;
  const host = server.ssh.host;
  try {
    if (c.type === "tcp") return await tcpCheck(host, c.port);
    if (c.type === "http") return await httpCheck(host, c);
    if (c.type === "http_json") return await httpJsonCheck(host, c);
  } catch (e) {
    return unknown(String(e));
  }
  return unknown("unsupported check");
}
