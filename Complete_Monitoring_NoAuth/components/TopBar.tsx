"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppIcon from "./AppIcon";
import ThemeToggle from "./ThemeToggle";

interface AirflowTarget {
  serverId: string;
  serverName: string;
  url: string;
}

export default function TopBar({
  airflowTargets,
  supersetEnabled,
}: {
  airflowTargets: AirflowTarget[];
  supersetEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="topbar">
      <div className="row">
        <span className="brand"><span className="brand-icon"><AppIcon name="layers" size={17} /></span>PLATUM SERVER OPS</span>
      </div>
      <nav>
        <Link className="nav-link" href="/"><AppIcon name="dashboard" size={15} />Dashboard</Link>
        <Link className="nav-link" href="/application"><AppIcon name="grid" size={15} />Application</Link>

        <div className="dropdown" ref={ref}>
          <button className="dropdown-toggle nav-link" onClick={() => setOpen((v) => !v)}>
            <AppIcon name="workflow" size={15} />Airflow <span style={{ fontSize: 10 }}>▾</span>
          </button>
          {open && (
            <div className="dropdown-menu">
              {airflowTargets.length === 0 && <div className="dropdown-empty">No Airflow servers</div>}
              {airflowTargets.map((t) => (
                <Link
                  key={t.serverId}
                  href={`/airflow/${t.serverId}`}
                  className="dropdown-item"
                  onClick={() => setOpen(false)}
                >
                  {t.serverName}
                  <span className="dropdown-sub">{t.url.replace(/^https?:\/\//, "")}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {supersetEnabled && <Link className="nav-link" href="/superset"><AppIcon name="layers" size={15} />Superset</Link>}

        <Link className="nav-link" href="/audit"><AppIcon name="audit" size={15} />Audit Log</Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
