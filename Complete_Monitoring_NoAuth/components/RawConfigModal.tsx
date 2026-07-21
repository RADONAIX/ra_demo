"use client";

import { useEffect, useState } from "react";
import { toast } from "./Toast";

interface Props {
  serverId: string;
  serviceId: string;
  serviceName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function RawConfigModal({ serverId, serviceId, serviceName, onClose, onSaved }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [restart, setRestart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState("");

  useEffect(() => {
    fetch(`/api/servers/${serverId}/scripts/${serviceId}/raw-config`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setContent(d.content ?? "");
        setPath(d.path ?? "");
      })
      .catch((e) => setError(e.message));
  }, [serverId, serviceId]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/scripts/${serviceId}/raw-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, restart }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      toast(
        `Config saved` + (restart ? ` · restart ${d.restart}` : ""),
        "ok"
      );
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: "80vw", maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
        <h3>Edit Config · {serviceName}</h3>
        {path && <div className="card-sub" style={{ marginBottom: 12 }}>{path}</div>}
        {content === null && !error && <p className="muted">Loading…</p>}
        {error && <div className="error">{error}</div>}

        {content !== null && (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Edit the complete config file. Saving writes these contents to the path above.
            </p>
            <textarea
              className="config-editor"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: 400,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontSize: 13,
                lineHeight: 1.6,
                padding: "16px",
                background: "var(--card-bg, #1a1a2e)",
                color: "var(--text, #e0e0e0)",
                border: "1px solid var(--border, #333)",
                borderRadius: 8,
                resize: "vertical",
                outline: "none",
                tabSize: 4,
              }}
            />

            <label className="row" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={restart} onChange={(e) => setRestart(e.target.checked)} style={{ width: "auto" }} />
              <span>Restart {serviceName} after applying</span>
            </label>

            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save & Apply"}
              </button>
              <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
