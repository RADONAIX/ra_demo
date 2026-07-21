"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusChip, { type Status } from "./StatusChip";
import ServiceActionsMenu from "./ServiceActionsMenu";
import ServerMetrics, { type Metrics } from "./ServerMetrics";
import RawConfigModal from "./RawConfigModal";
import { toast } from "./Toast";
import AppIcon from "./AppIcon";

interface Service {
  id: string;
  name: string;
  kind: string;
  port: number | null;
  allowedActions: string[];
  editableConfig: boolean;
  status: Status;
}
interface Server {
  id: string;
  name: string;
  environment: string;
  tags: string[];
  host: string;
  online: boolean;
  metrics?: Metrics;
  services: Service[];
}

const POLL_MS = 10000;

export default function DashboardClient({ initial, role }: { initial: Server[]; role: string }) {
  const [servers, setServers] = useState<Server[]>(initial);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [logsFor, setLogsFor] = useState<{ serverId: string; serviceId: string; serviceName: string } | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [configFor, setConfigFor] = useState<{ serverId: string; serviceId: string; serviceName: string } | null>(null);

  async function viewLogs(serverId: string, svc: Service) {
    setLogsFor({ serverId, serviceId: svc.id, serviceName: svc.name });
    setLogs("Loading…");
    try {
      const res = await fetch(`/api/servers/${serverId}/services/${svc.id}/logs?lines=200`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setLogs(d.logs || "(no output)");
    } catch (e: any) {
      setLogs("");
      toast(e.message, "err");
      setLogsFor(null);
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/servers", { cache: "no-store" });
      if (res.ok) setServers((await res.json()).servers);
    } catch {
      /* keep last known state on transient failure */
    }
  }

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return servers
      .map((s) => ({
        ...s,
        services: s.services.filter((svc) => {
          const matchQ = !needle || svc.name.toLowerCase().includes(needle) || s.host.includes(needle);
          const matchStatus = statusFilter === "all" || svc.status === statusFilter;
          return matchQ && matchStatus;
        }),
      }))
      .filter((s) => s.services.length > 0 || (!q && statusFilter === "all"));
  }, [servers, q, statusFilter]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="page-title"><span className="title-icon"><AppIcon name="dashboard" size={20} /></span>Fleet Overview</h2>
        <span className="refresh-label"><AppIcon name="refresh" size={14} />auto-refresh every {POLL_MS / 1000}s</span>
      </div>

      <div className="filters">
        <input className="input" placeholder="Search server or service…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="restarting">Restarting</option>
          <option value="failed">Failed</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div className="grid">
        {filtered.map((s) => (
          <div className="card" key={s.id}>
            <div className="card-header">
              <Link className="card-title" href={`/servers/${s.id}`}>{s.host}</Link>
              <StatusChip status={s.online ? "running" : "unknown"} />
            </div>

            <ServerMetrics m={s.metrics} />

            <table className="svc-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Port</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {s.services.map((svc) => (
                  <tr key={svc.id}>
                    <td className="svc-name">{svc.name}</td>
                    <td className="muted">{svc.port ?? "—"}</td>
                    <td><StatusChip status={svc.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      <ServiceActionsMenu
                        serverId={s.id}
                        serviceId={svc.id}
                        serviceName={svc.name}
                        allowedActions={svc.allowedActions}
                        editableConfig={svc.editableConfig}
                        role={role}
                        onChanged={refresh}
                        onViewLogs={() => viewLogs(s.id, svc)}
                        onEditConfig={() => setConfigFor({ serverId: s.id, serviceId: svc.id, serviceName: svc.name })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="row">
              <Link className="btn" href={`/servers/${s.id}`}>Details &amp; logs →</Link>
            </div>
          </div>
        ))}
      </div>

      {logsFor && (
        <div className="modal-backdrop" onClick={() => setLogsFor(null)}>
          <div className="modal" style={{ width: "80vw", maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3>Logs · {logsFor.serviceName}</h3>
              <button className="btn" onClick={() => setLogsFor(null)}>Close</button>
            </div>
            <div className="logbox">{logs}</div>
          </div>
        </div>
      )}

      {configFor && (
        <RawConfigModal
          serverId={configFor.serverId}
          serviceId={configFor.serviceId}
          serviceName={configFor.serviceName}
          onClose={() => setConfigFor(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
