/**
 * Whitelisted remote execution.
 *
 * Security model:
 * - We NEVER build a shell string from user input. The only variable interpolated
 *   into a command is a systemd unit name that comes from config/servers.json
 *   (operator-curated), and we additionally validate it against a strict charset.
 * - Actions are restricted to a fixed map; anything else is rejected before SSH.
 * - Config file contents are transferred base64-encoded, so file bytes can never
 *   break out of the command.
 * - MOCK_MODE returns simulated results so the UI is usable without real servers.
 */
import { NodeSSH } from "node-ssh";
import type { Action, ServerDef, ServiceDef } from "./registry";

export interface ExecResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface StatusInfo {
  status: "running" | "stopped" | "restarting" | "failed" | "unknown";
  uptimeSeconds: number | null;
  since: string | null;
  raw?: string;
}

const UNIT_RE = /^[A-Za-z0-9._@-]+$/;

function assertUnit(unit: string | undefined): string {
  if (!unit || !UNIT_RE.test(unit)) {
    throw new Error(`Invalid or missing unit name: ${unit ?? "(none)"}`);
  }
  return unit;
}

const isMock = () => (process.env.MOCK_MODE ?? "true") === "true";

async function connect(server: ServerDef): Promise<NodeSSH> {
  const ssh = new NodeSSH();
  const privateKey = server.ssh.privateKeyEnv ? process.env[server.ssh.privateKeyEnv] : undefined;
  const password = server.ssh.passwordEnv ? process.env[server.ssh.passwordEnv] : undefined;
  await ssh.connect({
    host: server.ssh.host,
    port: server.ssh.port,
    username: server.ssh.username,
    ...(privateKey ? { privateKey } : {}),
    ...(password ? { password } : {}),
    readyTimeout: 8000,
  });
  return ssh;
}

async function run(server: ServerDef, command: string, args: string[]): Promise<ExecResult> {
  const ssh = await connect(server);
  try {
    const r = await ssh.execCommand(`${command} ${args.join(" ")}`.trim());
    return { ok: r.code === 0, code: r.code, stdout: r.stdout, stderr: r.stderr };
  } finally {
    ssh.dispose();
  }
}

// -------- Mock data (deterministic per service id) --------
function mockStatus(service: ServiceDef): StatusInfo {
  const roll = [...service.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 10;
  if (roll === 0) return { status: "failed", uptimeSeconds: null, since: null };
  if (roll === 1) return { status: "stopped", uptimeSeconds: null, since: null };
  const uptime = 3600 * (roll + 1) + roll * 137;
  return {
    status: "running",
    uptimeSeconds: uptime,
    since: new Date(Date.now() - uptime * 1000).toISOString(),
    raw: "active (running) [mock]",
  };
}

// -------- Public API --------
export async function getStatus(server: ServerDef, service: ServiceDef): Promise<StatusInfo> {
  if (isMock()) return mockStatus(service);
  const unit = assertUnit(service.unit);
  try {
    const active = await run(server, "systemctl", ["is-active", unit]);
    const show = await run(server, "systemctl", [
      "show",
      unit,
      "-p",
      "ActiveEnterTimestamp,SubState"
    ]);
    const first = active.stdout.trim();
    let sinceRaw = null;
    for (const line of show.stdout.trim().split("\n")) {
      if (line.startsWith("ActiveEnterTimestamp=")) {
        sinceRaw = line.substring(21).trim();
      }
    }
    let since: string | null = null;
    if (sinceRaw && sinceRaw !== "null") {
      try {
        const d = new Date(sinceRaw);
        if (!isNaN(d.getTime())) since = d.toISOString();
      } catch (e) {}
    }
    const uptimeSeconds = since ? Math.floor((Date.now() - Date.parse(since)) / 1000) : null;
    const status: StatusInfo["status"] =
      first === "active" ? "running"
      : first === "inactive" ? "stopped"
      : first === "activating" ? "restarting"
      : first === "failed" ? "failed"
      : "unknown";
    return { status, uptimeSeconds, since, raw: active.stdout + show.stdout };
  } catch (e: any) {
    return { status: "unknown", uptimeSeconds: null, since: null, raw: String(e?.message ?? e) };
  }
}

export async function runAction(
  server: ServerDef,
  service: ServiceDef,
  action: Action
): Promise<ExecResult> {
  if (!service.allowedActions.includes(action)) {
    throw new Error(`Action '${action}' is not permitted for '${service.id}'`);
  }
  if (action === "status") {
    const s = await getStatus(server, service);
    return { ok: s.status !== "unknown", code: 0, stdout: JSON.stringify(s), stderr: "" };
  }
  if (isMock()) {
    return { ok: true, code: 0, stdout: `[mock] systemctl ${action} ${service.unit} -> OK`, stderr: "" };
  }
  const unit = assertUnit(service.unit);
  const password = server.ssh.passwordEnv ? process.env[server.ssh.passwordEnv] : "";
  const cmd = `echo ${shq(password || "")} | sudo -S systemctl ${action} ${shq(unit)}`;
  return run(server, "sh", ["-c", shq(cmd)]);
}

export async function readLogs(
  server: ServerDef,
  service: ServiceDef,
  lines = 200
): Promise<string> {
  const n = Math.min(Math.max(lines, 1), 1000);
  if (isMock()) {
    return Array.from({ length: 12 }, (_, i) =>
      `${new Date(Date.now() - i * 60000).toISOString()}  [mock] ${service.id}: heartbeat ok`
    ).join("\n");
  }
  if (service.logPath) {
    const password = server.ssh.passwordEnv ? process.env[server.ssh.passwordEnv] : "";
    const cmd = `echo ${shq(password || "")} | sudo -S tail -n ${n} ${shq(service.logPath)}`;
    const r = await run(server, "sh", ["-c", shq(cmd)]);
    return r.stdout || r.stderr;
  }
  const unit = assertUnit(service.logUnit || service.unit);
  const password = server.ssh.passwordEnv ? process.env[server.ssh.passwordEnv] : "";
  const cmd = `echo ${shq(password || "")} | sudo -S journalctl -u ${shq(unit)} -n ${n} --no-pager`;
  const r = await run(server, "sh", ["-c", shq(cmd)]);
  return r.stdout || r.stderr;
}

/** Atomically write a config file on the server (base64 transfer, temp + mv, keeps a backup). */
export async function writeConfig(
  server: ServerDef,
  remotePath: string,
  content: string
): Promise<{ ok: boolean; detail: string }> {
  if (isMock()) {
    return { ok: true, detail: `[mock] wrote ${content.length} bytes to ${remotePath}` };
  }
  const b64 = Buffer.from(content, "utf-8").toString("base64");
  const tmp = `${remotePath}.tmp.$$`;
  // Path comes from operator-curated config, not user input. Content is base64.
  const script =
    `cp -f ${shq(remotePath)} ${shq(remotePath)}.bak 2>/dev/null; ` +
    `printf %s ${shq(b64)} | base64 -d > ${shq(tmp)} && ` +
    `mv ${shq(tmp)} ${shq(remotePath)}`;
  const ssh = await connect(server);
  try {
    const r = await ssh.execCommand(script);
    return { ok: r.code === 0, detail: r.code === 0 ? "written" : r.stderr };
  } finally {
    ssh.dispose();
  }
}

export async function readConfig(
  server: ServerDef,
  remotePath: string
): Promise<string> {
  if (isMock()) {
    return `[mock] contents of ${remotePath}\nKEY=VALUE`;
  }
  const ssh = await connect(server);
  try {
    const r = await ssh.execCommand(`cat ${shq(remotePath)}`);
    if (r.code !== 0) throw new Error(r.stderr || `Failed to read ${remotePath}`);
    return r.stdout;
  } finally {
    ssh.dispose();
  }
}

// single-quote shell-escape for the few fixed, non-user values we interpolate
function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// ---- Server resource metrics (CPU / RAM / disk) ----
export interface ServerMetrics {
  cpuPercent: number | null;
  cores: number | null;
  memTotal: number | null;
  memUsed: number | null;
  rootTotal: number | null;
  rootUsed: number | null;
  homeTotal: number | null;
  homeUsed: number | null;
  source: "ssh" | "mock" | "unavailable";
  updatedAt?: string; // set by the metrics cache when the value was collected
}

// Fixed, read-only command — no user input is interpolated.
const METRICS_CMD = [
  'echo CORES=$(nproc 2>/dev/null || echo 1)',
  "echo CPU=$(vmstat 1 2 2>/dev/null | tail -1 | awk '{print 100-$15}')",
  "free -b 2>/dev/null | awk '/^Mem:/{print \"MEM=\"$2\",\"$3}'",
  "df -B1 / 2>/dev/null | awk 'NR==2{print \"ROOT=\"$2\",\"$3}'",
  "df -B1 /home 2>/dev/null | awk 'NR==2{print \"HOME=\"$2\",\"$3}'",
].join("; ");

function hasCreds(server: ServerDef): boolean {
  const key = server.ssh.privateKeyEnv ? process.env[server.ssh.privateKeyEnv] : undefined;
  const pass = server.ssh.passwordEnv ? process.env[server.ssh.passwordEnv] : undefined;
  return Boolean(key || pass);
}

function mockMetrics(server: ServerDef): ServerMetrics {
  const seed = [...server.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const gb = 1024 ** 3;
  const memTotal = 16 * gb;
  const rootTotal = 100 * gb;
  const homeTotal = 500 * gb;
  return {
    cpuPercent: 8 + (seed % 40),
    cores: 8,
    memTotal,
    memUsed: memTotal * (0.35 + (seed % 30) / 100),
    rootTotal,
    rootUsed: rootTotal * (0.3 + (seed % 25) / 100),
    homeTotal,
    homeUsed: homeTotal * (0.2 + (seed % 40) / 100),
    source: "mock",
  };
}

export async function getMetrics(server: ServerDef): Promise<ServerMetrics> {
  if (!hasCreds(server)) {
    return isMock()
      ? mockMetrics(server)
      : { cpuPercent: null, cores: null, memTotal: null, memUsed: null, rootTotal: null, rootUsed: null, homeTotal: null, homeUsed: null, source: "unavailable" };
  }
  try {
    const ssh = await connect(server);
    try {
      const r = await ssh.execCommand(METRICS_CMD);
      const kv: Record<string, string> = {};
      for (const line of r.stdout.split("\n")) {
        const i = line.indexOf("=");
        if (i > 0) kv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      const num = (v?: string) => (v && !isNaN(Number(v)) ? Number(v) : null);
      const pair = (v?: string) => {
        const [a, b] = (v ?? "").split(",");
        return [num(a), num(b)] as const;
      };
      const [memTotal, memUsed] = pair(kv.MEM);
      const [rootTotal, rootUsed] = pair(kv.ROOT);
      const [homeTotal, homeUsed] = pair(kv.HOME);
      return {
        cpuPercent: num(kv.CPU),
        cores: num(kv.CORES),
        memTotal, memUsed,
        rootTotal, rootUsed,
        homeTotal: homeTotal ?? rootTotal, // /home may live on / — fall back
        homeUsed: homeUsed ?? rootUsed,
        source: "ssh",
      };
    } finally {
      ssh.dispose();
    }
  } catch {
    return { cpuPercent: null, cores: null, memTotal: null, memUsed: null, rootTotal: null, rootUsed: null, homeTotal: null, homeUsed: null, source: "unavailable" };
  }
}
