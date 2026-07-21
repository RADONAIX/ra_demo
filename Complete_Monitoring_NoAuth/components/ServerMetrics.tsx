"use client";

import { useEffect, useState } from "react";

export interface Metrics {
  cpuPercent: number | null;
  cores: number | null;
  memTotal: number | null;
  memUsed: number | null;
  rootTotal: number | null;
  rootUsed: number | null;
  homeTotal: number | null;
  homeUsed: number | null;
  source: "ssh" | "mock" | "unavailable";
  updatedAt?: string;
}

function ago(iso?: string): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

function gb(bytes: number | null): string {
  if (bytes == null) return "—";
  const g = bytes / 1024 ** 3;
  return g >= 100 ? `${g.toFixed(0)}` : `${g.toFixed(1)}`;
}

function pct(used: number | null, total: number | null): number | null {
  if (used == null || total == null || total === 0) return null;
  return Math.round((used / total) * 100);
}

function Bar({ percent }: { percent: number | null }) {
  const p = percent ?? 0;
  const cls = p >= 90 ? "bar-red" : p >= 75 ? "bar-yellow" : "bar-green";
  return (
    <div className="meter">
      <div className={`meter-fill ${cls}`} style={{ width: `${Math.min(p, 100)}%` }} />
    </div>
  );
}

export default function ServerMetrics({ m }: { m?: Metrics }) {
  // Relative time depends on the current clock.  Keep the first client render
  // identical to the server output, then start showing the live value once the
  // component has hydrated.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!m || m.source === "unavailable") {
    return <div className="metrics muted">Resource metrics need SSH credentials (add SRV*_SSH_KEY/PASSWORD).</div>;
  }
  const memPct = pct(m.memUsed, m.memTotal);
  const rootPct = pct(m.rootUsed, m.rootTotal);
  const homePct = pct(m.homeUsed, m.homeTotal);

  return (
    <div className="metrics">
      <div className="stat">
        <div className="stat-top"><span className="stat-label">CPU</span><span className="stat-val">{m.cpuPercent != null ? `${Math.round(m.cpuPercent)}%` : "—"}</span></div>
        <Bar percent={m.cpuPercent} />
        <div className="stat-sub">{m.cores ?? "—"} cores</div>
      </div>
      <div className="stat">
        <div className="stat-top"><span className="stat-label">RAM</span><span className="stat-val">{memPct != null ? `${memPct}%` : "—"}</span></div>
        <Bar percent={memPct} />
        <div className="stat-sub">{gb(m.memUsed)} / {gb(m.memTotal)} GB</div>
      </div>
      <div className="stat">
        <div className="stat-top"><span className="stat-label">/root</span><span className="stat-val">{rootPct != null ? `${rootPct}%` : "—"}</span></div>
        <Bar percent={rootPct} />
        <div className="stat-sub">{gb(m.rootUsed)} / {gb(m.rootTotal)} GB</div>
      </div>
      <div className="stat">
        <div className="stat-top"><span className="stat-label">/home</span><span className="stat-val">{homePct != null ? `${homePct}%` : "—"}</span></div>
        <Bar percent={homePct} />
        <div className="stat-sub">{gb(m.homeUsed)} / {gb(m.homeTotal)} GB</div>
      </div>
      <div className="stat-sub muted" style={{ alignSelf: "center" }}>
        {m.source === "mock" ? "demo values" : hydrated ? `SSH · ${ago(m.updatedAt)}` : "SSH · updating…"}
      </div>
    </div>
  );
}
