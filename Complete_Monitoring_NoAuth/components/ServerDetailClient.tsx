"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusChip, { formatUptime, type Status } from "./StatusChip";
import ServiceControls from "./ServiceControls";
import RawConfigModal from "./RawConfigModal";
import { toast } from "./Toast";

interface Service {
  id: string;
  name: string;
  kind: string;
  allowedActions: string[];
  editableConfig: boolean;
  status: Status;
  uptimeSeconds: number | null;
  since: string | null;
}
interface Server {
  id: string;
  name: string;
  environment: string;
  tags: string[];
  host: string;
  online: boolean;
  services: Service[];
}

export default function ServerDetailClient({ initial, role }: { initial: Server; role: string }) {
  const [server, setServer] = useState<Server>(initial);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [configFor, setConfigFor] = useState<Service | null>(null);

  async function refresh() {
    const res = await fetch(`/api/servers/${server.id}`, { cache: "no-store" });
    if (res.ok) setServer(await res.json());
  }

  useEffect(() => {
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  async function viewLogs(svc: Service) {
    setLogsFor(svc.id);
    setLogs("Loading…");
    try {
      const res = await fetch(`/api/servers/${server.id}/services/${svc.id}/logs?lines=200`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setLogs(d.logs || "(no output)");
    } catch (e: any) {
      setLogs("");
      toast(e.message, "err");
      setLogsFor(null);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <Link href="/">← Fleet</Link>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: "4px 0" }}>{server.name}</h2>
          <div className="card-sub">{server.host} · {server.environment} · {server.tags.join(", ")}</div>
        </div>
        <StatusChip status={server.online ? "running" : "unknown"} />
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Service</th><th>Type</th><th>Status</th><th>Uptime</th><th>Since</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {server.services.map((svc) => (
              <tr key={svc.id}>
                <td><strong>{svc.name}</strong></td>
                <td className="muted">{svc.kind === "python_script" ? "python" : "systemd"}</td>
                <td><StatusChip status={svc.status} /></td>
                <td>{formatUptime(svc.uptimeSeconds)}</td>
                <td className="muted">{svc.since ? new Date(svc.since).toLocaleString() : "—"}</td>
                <td>
                  <div className="btn-row">
                    <ServiceControls
                      serverId={server.id}
                      serviceId={svc.id}
                      serviceName={svc.name}
                      allowedActions={svc.allowedActions}
                      role={role}
                      onChanged={refresh}
                    />
                    <button className="btn" onClick={() => viewLogs(svc)}>Logs</button>
                    {svc.editableConfig && (
                      <button className="btn" onClick={() => setConfigFor(svc)} disabled={role === "viewer"}>
                        Config
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logsFor && (
        <div className="modal-backdrop" onClick={() => setLogsFor(null)}>
          <div className="modal" style={{ width: "80vw", maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3>Logs · {server.services.find((s) => s.id === logsFor)?.name}</h3>
              <button className="btn" onClick={() => setLogsFor(null)}>Close</button>
            </div>
            <div className="logbox">{logs}</div>
          </div>
        </div>
      )}

      {configFor && (
        <RawConfigModal
          serverId={server.id}
          serviceId={configFor.id}
          serviceName={configFor.name}
          onClose={() => setConfigFor(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
