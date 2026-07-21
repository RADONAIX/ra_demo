"use client";

import { useEffect, useRef, useState } from "react";
import { embedDashboard } from "@superset-ui/embedded-sdk";

export default function SupersetEmbed({
  supersetDomain,
  dashboardUuid,
}: {
  supersetDomain: string;
  dashboardUuid: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!ref.current) return;

    embedDashboard({
      id: dashboardUuid,
      supersetDomain,
      mountPoint: ref.current,
      fetchGuestToken: async () => {
        const res = await fetch("/api/superset/guest-token", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to get guest token");
        return data.token as string;
      },
      dashboardUiConfig: { hideTitle: false, hideChartControls: false, filters: { visible: true, expanded: true } },
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [supersetDomain, dashboardUuid]);

  return (
    <>
      {error && <div className="card error">Superset embed error: {error}</div>}
      <div ref={ref} className="superset-embed" />
    </>
  );
}
