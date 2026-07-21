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

interface ConfigData {
  path: string;
  format: string;
  schema: any;
  values: Record<string, any>;
}

export default function ConfigModal({ serverId, serviceId, serviceName, onClose, onSaved }: Props) {
  const [data, setData] = useState<ConfigData | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [restart, setRestart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/servers/${serverId}/scripts/${serviceId}/config`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setValues(d.values ?? {});
      })
      .catch((e) => setError(e.message));
  }, [serverId, serviceId]);

  function setField(key: string, value: any) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/scripts/${serviceId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, restart }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      toast(
        `Config saved (${d.changedKeys?.length ?? 0} changed)` +
          (restart ? ` · restart ${d.restart}` : ""),
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

  const props: Record<string, any> = data?.schema?.properties ?? {};

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit config · {serviceName}</h3>
        {data && <div className="card-sub">{data.path} ({data.format})</div>}
        {!data && !error && <p className="muted">Loading…</p>}
        {error && <div className="error">{error}</div>}

        {data && (
          <div className="stack">
            {Object.entries(props).map(([key, spec]) => (
              <Field key={key} name={key} spec={spec} value={values[key]} onChange={(v) => setField(key, v)} />
            ))}

            <label className="row" style={{ marginTop: 14 }}>
              <input type="checkbox" checked={restart} onChange={(e) => setRestart(e.target.checked)} style={{ width: "auto" }} />
              <span>Restart {serviceName} after applying</span>
            </label>

            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={save} disabled={busy}>
                {busy ? "Applying…" : "Validate & apply"}
              </button>
              <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ name, spec, value, onChange }: { name: string; spec: any; value: any; onChange: (v: any) => void }) {
  const label = spec.title || name;

  if (spec.enum) {
    return (
      <div>
        <label>{label}</label>
        <select className="select" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          {spec.enum.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }
  if (spec.type === "boolean") {
    return (
      <label className="row">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} style={{ width: "auto" }} />
        <span>{label}</span>
      </label>
    );
  }
  if (spec.type === "integer" || spec.type === "number") {
    return (
      <div>
        <label>{label}{spec.minimum != null ? ` (${spec.minimum}–${spec.maximum ?? "∞"})` : ""}</label>
        <input className="input" type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
    );
  }
  if (spec.type === "array") {
    const text = Array.isArray(value) ? value.join(", ") : "";
    return (
      <div>
        <label>{label} (comma separated)</label>
        <input className="input" value={text} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </div>
    );
  }
  return (
    <div>
      <label>{label}</label>
      <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
