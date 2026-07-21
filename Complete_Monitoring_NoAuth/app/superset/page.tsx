import { getSupersetConfig } from "@/lib/superset";
import SupersetEmbed from "@/components/SupersetEmbed";

export const dynamic = "force-dynamic";

export default function SupersetPage() {
  const cfg = getSupersetConfig();

  if (!cfg) {
    return (
      <div className="stack">
        <h2 style={{ margin: "8px 0" }}>Superset</h2>
        <div className="card">
          <p>Superset embedding isn&apos;t configured yet. Add these to <code>.env</code> and restart:</p>
          <div className="logbox">
{`SUPERSET_URL=http://10.200.37.142:8088
SUPERSET_USERNAME=<a superset user that can create guest tokens>
SUPERSET_PASSWORD=<password>
SUPERSET_DASHBOARD_UUID=<embed UUID of the dashboard>`}
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            In Superset: enable the <code>EMBEDDED_SUPERSET</code> feature flag, open the dashboard,
            use the “…” menu → <b>Embed dashboard</b> to enable it and copy the UUID (add this app&apos;s
            domain under allowed domains, or leave blank to allow all).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: "8px 0" }}>Superset</h2>
        <a className="btn" href={cfg.url} target="_blank" rel="noreferrer">Open Superset ↗</a>
      </div>
      <SupersetEmbed supersetDomain={cfg.url} dashboardUuid={cfg.dashboardUuid} />
    </div>
  );
}
