"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "./Toast";

const DESTRUCTIVE = new Set(["stop", "restart"]);
const LABEL: Record<string, string> = { start: "Start", stop: "Stop", restart: "Restart", reload: "Reload" };

export default function ServiceActionsMenu({
  serverId,
  serviceId,
  serviceName,
  allowedActions,
  editableConfig,
  role,
  onChanged,
  onViewLogs,
  onEditConfig,
}: {
  serverId: string;
  serviceId: string;
  serviceName: string;
  allowedActions: string[];
  editableConfig?: boolean;
  role: string;
  onChanged?: () => void;
  onViewLogs?: () => void;
  onEditConfig?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const canControl = role === "operator" || role === "admin";
  const actions = allowedActions.filter((a) => a !== "status");

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function run(action: string) {
    if (DESTRUCTIVE.has(action) && !window.confirm(`${LABEL[action]} "${serviceName}"? This affects a live service.`)) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/servers/${serverId}/services/${serviceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast(`${LABEL[action]} ${serviceName}: ${data.ok ? "ok" : "failed"}`, data.ok ? "ok" : "err");
      onChanged?.();
      setOpen(false);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  }

  if (actions.length === 0 && !onViewLogs && !onEditConfig) return <span className="muted">—</span>;

  return (
    <div className="dropdown" ref={ref}>
      <button
        className="btn"
        disabled={!canControl && !onViewLogs}
        title={canControl || onViewLogs ? "" : "Requires operator role"}
        onClick={() => setOpen((v) => !v)}
      >
        Actions ▾
      </button>
      {open && (
        <div className="dropdown-menu" style={{ minWidth: 130 }}>
          {canControl && actions.map((a) => (
            <button
              key={a}
              className="action-item"
              disabled={busy !== null}
              onClick={() => run(a)}
            >
              {busy === a ? "…" : LABEL[a] ?? a}
            </button>
          ))}
          {onViewLogs && (
            <button
              className="action-item"
              onClick={() => {
                setOpen(false);
                onViewLogs();
              }}
            >
              Logs
            </button>
          )}
          {editableConfig && onEditConfig && role !== "viewer" && (
            <button
              className="action-item"
              onClick={() => {
                setOpen(false);
                onEditConfig();
              }}
            >
              Edit Config
            </button>
          )}
        </div>
      )}
    </div>
  );
}
