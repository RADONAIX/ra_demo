import fs from "node:fs";
import path from "node:path";

export type ServiceKind = "systemd" | "python_script" | "custom";
export type Action = "status" | "start" | "stop" | "restart" | "reload";

export interface ScriptConfigDef {
  path: string;
  format: "yaml" | "json" | "env";
  schema: Record<string, any>;
  defaults?: Record<string, any>;
}

export interface WebDef {
  port: number;
  path?: string;
}

export interface CheckDef {
  // How to determine live status from the dashboard host (no SSH required):
  //  - tcp:       connect to host:port (postgres 5433, pgbouncer 6432)
  //  - http:      GET host:port{path}; healthy on 2xx (+ optional expectBody substring)
  //  - http_json: GET host:port{path}, read jsonPath, compare to healthyValue
  //               (Airflow /health -> scheduler.status == "healthy")
  type: "tcp" | "http" | "http_json";
  port: number;
  path?: string;
  expectBody?: string;
  jsonPath?: string;
  healthyValue?: string;
}

export interface ServiceDef {
  id: string;
  name: string;
  kind: ServiceKind;
  unit?: string;
  allowedActions: Action[];
  logUnit?: string;
  logPath?: string;
  config?: ScriptConfigDef;
  web?: WebDef; // embeddable web UI (e.g. Airflow on :8086)
  check?: CheckDef; // network health check for real status
}

export interface ServerDef {
  id: string;
  name: string;
  environment: string;
  tags: string[];
  ssh: {
    host: string;
    port: number;
    username: string;
    privateKeyEnv?: string;
    passwordEnv?: string;
  };
  services: ServiceDef[];
}

let cache: ServerDef[] | null = null;

export function getServers(): ServerDef[] {
  if (cache) return cache;
  const file = path.join(process.cwd(), "config", "servers.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  cache = raw.servers as ServerDef[];
  return cache;
}

export function getServer(id: string): ServerDef | undefined {
  return getServers().find((s) => s.id === id);
}

export function getService(serverId: string, serviceId: string): ServiceDef | undefined {
  return getServer(serverId)?.services.find((s) => s.id === serviceId);
}

/** Build the embeddable URL for a service's web UI, or null if it has none. */
export function serviceWebUrl(server: ServerDef, service: ServiceDef): string | null {
  if (!service.web) return null;
  return `http://${server.ssh.host}:${service.web.port}${service.web.path ?? "/"}`;
}

/** All servers that expose an Airflow web UI — used by the nav dropdown. */
export function getAirflowTargets(): { serverId: string; serverName: string; url: string }[] {
  const out: { serverId: string; serverName: string; url: string }[] = [];
  for (const s of getServers()) {
    const airflow = s.services.find((svc) => svc.id === "airflow" && svc.web);
    if (airflow) out.push({ serverId: s.id, serverName: s.name, url: serviceWebUrl(s, airflow)! });
  }
  return out;
}

/** Public view — never leaks SSH secrets to the client. */
export function publicServer(s: ServerDef) {
  return {
    id: s.id,
    name: s.name,
    environment: s.environment,
    tags: s.tags,
    host: s.ssh.host,
    services: s.services.map((svc) => ({
      id: svc.id,
      name: svc.name,
      kind: svc.kind,
      port: svc.check?.port ?? svc.web?.port ?? null,
      allowedActions: svc.allowedActions,
      editableConfig: Boolean(svc.config),
    })),
  };
}
