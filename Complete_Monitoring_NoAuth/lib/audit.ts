import { getDb } from "./db";

export interface AuditEntry {
  userEmail?: string | null;
  serverId?: string | null;
  serverName?: string | null;
  serviceId?: string | null;
  action: string;
  status: "success" | "failed" | "denied" | "pending";
  detail?: unknown;
  sourceIp?: string | null;
}

export function recordAudit(e: AuditEntry) {
  getDb()
    .prepare(
      `INSERT INTO audit_log
        (user_email, server_id, server_name, service_id, action, status, detail, source_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      e.userEmail ?? null,
      e.serverId ?? null,
      e.serverName ?? null,
      e.serviceId ?? null,
      e.action,
      e.status,
      e.detail ? JSON.stringify(e.detail) : null,
      e.sourceIp ?? null
    );
}

export function listAudit(filters: {
  server?: string;
  service?: string;
  status?: string;
  action?: string;
  limit?: number;
}) {
  const clauses: string[] = [];
  const params: any[] = [];
  if (filters.server) { clauses.push("server_id = ?"); params.push(filters.server); }
  if (filters.service) { clauses.push("service_id = ?"); params.push(filters.service); }
  if (filters.status) { clauses.push("status = ?"); params.push(filters.status); }
  if (filters.action) { clauses.push("action = ?"); params.push(filters.action); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(filters.limit ?? 200, 500);
  const rows = getDb()
    .prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(...params, limit) as any[];
  return rows.map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null }));
}
