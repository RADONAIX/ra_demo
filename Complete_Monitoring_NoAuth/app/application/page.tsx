import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export const dynamic = "force-dynamic";

const APPLICATION_URL = "https://10.200.37.142";

export default function ApplicationPage() {
  return (
    <div className="stack">
      <section className="app-hero">
        <div className="app-hero-copy">
          <div className="app-title-row">
            <span className="app-mark"><AppIcon name="grid" size={23} /></span>
            <div>
              <div className="eyebrow">APPLICATION PORTAL</div>
              <h2>Application</h2>
            </div>
          </div>
          <p>Securely access the application hosted on Server 1 without leaving Server Ops.</p>
          <div className="app-meta">
            <span><AppIcon name="shield" size={14} /> Secure dashboard proxy</span>
            <span><AppIcon name="server" size={14} /> Private application service</span>
          </div>
        </div>
        <div className="btn-row app-hero-actions">
          <Link className="btn" href="/"><AppIcon name="back" size={15} />Back to dashboard</Link>
          <a className="btn primary" href={APPLICATION_URL} target="_blank" rel="noreferrer">
            Open in new tab <AppIcon name="external" size={15} />
          </a>
        </div>
      </section>

      <div className="app-frame-wrap">
        <div className="app-frame-bar">
          <span className="app-live-dot" /> Application workspace
          <span className="app-frame-url">{APPLICATION_URL}</span>
        </div>
        <iframe src="/api/application" title="Application" className="app-iframe" />
      </div>
    </div>
  );
}
