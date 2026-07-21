"use client";

import { useState } from "react";
import { toast } from "./Toast";

const DESTRUCTIVE = new Set(["stop", "restart"]);
const LABEL: Record<string, string> = {
  start: "Start", stop: "Stop", restart: "Restart", reload: "Reload",
};

export default function ServiceControls({
  serverId,
  serviceId,
  serviceName,
  allowedActions,
  role,
  onChanged,
}: {
  serverId: string;
  serviceId: string;
  serviceName: string;
  allowedActions: string[];
  role: string;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const canControl = role === "operator" || role === "admin";
  const actions = allowedActions.filter((a) => a !== "status");

  async function run(action: string) {
    if (DESTRUCTIVE.has(action)) {
      const ok = window.confirm(`${LABEL[action]} "${serviceName}"? This affects a live service.`);
      if (!ok) return;
    }
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
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="btn-row">
      {actions.map((a) => (
        <button
          key={a}
          className={`btn ${a === "stop" ? "danger" : ""}`}
          disabled={!canControl || busy !== null}
          title={canControl ? "" : "Requires operator role"}
          onClick={() => run(a)}
        >
          {busy === a ? "…" : LABEL[a] ?? a}
        </button>
      ))}
    </div>
  );
}
