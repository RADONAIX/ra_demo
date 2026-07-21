"use client";

import { useCallback, useEffect, useState } from "react";

interface Row {
  id: number;
  created_at: string;
  user_email: string | null;
  server_name: string | null;
  service_id: string | null;
  action: string;
  status: string;
  detail: any;
  source_ip: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  success: "running", failed: "failed", denied: "failed", pending: "restarting",
};

export default function AuditClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (action) q.set("action", action);
    const res = await fetch(`/api/audit?${q.toString()}`, { cache: "no-store" });
    if (res.ok) setRows((await res.json()).audit);
    setLoading(false);
  }, [status, action]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="stack">
      <h2 style={{ margin: "8px 0" }}>Audit Log</h2>
      <div className="filters">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="denied">Denied</option>
        </select>
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          <option value="login">login</option>
          <option value="start">start</option>
          <option value="stop">stop</option>
          <option value="restart">restart</option>
          <option value="reload">reload</option>
          <option value="config_update">config_update</option>
        </select>
        <button className="btn" onClick={load}>Refresh</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Time</th><th>User</th><th>Server</th><th>Service</th>
              <th>Action</th><th>Status</th><th>IP</th><th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{new Date(r.created_at + "Z").toLocaleString()}</td>
                <td>{r.user_email ?? "—"}</td>
                <td>{r.server_name ?? "—"}</td>
                <td>{r.service_id ?? "—"}</td>
                <td>{r.action}</td>
                <td><span className={`chip ${STATUS_COLORS[r.status] ?? "unknown"}`}><span className="dot" />{r.status}</span></td>
                <td className="muted">{r.source_ip ?? "—"}</td>
                <td className="muted" style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.detail ? JSON.stringify(r.detail) : "—"}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="muted">No audit entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
