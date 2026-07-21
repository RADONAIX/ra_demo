import Link from "next/link";
import { notFound } from "next/navigation";
import { getServer, getService, serviceWebUrl, getAirflowTargets } from "@/lib/registry";

export const dynamic = "force-dynamic";

export default function AirflowPage({ params }: { params: { id: string } }) {
  const server = getServer(params.id);
  const airflow = server ? getService(params.id, "airflow") : undefined;
  if (!server || !airflow || !airflow.web) notFound();

  const url = serviceWebUrl(server, airflow)!; // direct URL (for "open in new tab")
  const proxyUrl = `/api/airflow/${server.id}`; // same-origin proxy (for the iframe)
  const targets = getAirflowTargets();

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "4px 0" }}>Airflow · {server.name}</h2>
          <div className="card-sub">
            <a href={url} target="_blank" rel="noreferrer">{url}</a>
          </div>
        </div>
        <div className="btn-row">
          {targets.map((t) => (
            <Link
              key={t.serverId}
              href={`/airflow/${t.serverId}`}
              className={`btn ${t.serverId === server.id ? "primary" : ""}`}
            >
              {t.serverName}
            </Link>
          ))}
          <a className="btn" href={url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
        </div>
      </div>

      <iframe
        key={proxyUrl}
        src={proxyUrl}
        title={`Airflow ${server.name}`}
        className="app-iframe"
      />

      <p className="muted" style={{ fontSize: 12 }}>
        Airflow is proxied through the dashboard (same-origin) so its session &amp; CSRF work
        inside the iframe. If links or static assets 404, enable proxy awareness on that Airflow:{" "}
        <code>AIRFLOW__WEBSERVER__ENABLE_PROXY_FIX=True</code> and restart it.
      </p>
    </div>
  );
}
