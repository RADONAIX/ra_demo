import type { ReactNode } from "react";

type IconName = "grid" | "dashboard" | "layers" | "workflow" | "audit" | "shield" | "server" | "external" | "back" | "refresh" | "sun" | "moon";

const icons: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  dashboard: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 16v-3M12 16V8M17 16v-6" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  workflow: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6h5a4.5 4.5 0 0 1 4.5 4.5v5M6 8.5v7a2.5 2.5 0 0 0 2.5 2.5H15" /></>,
  audit: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  shield: <path d="M12 3 4.5 6v5.2c0 4.8 3.2 8.3 7.5 9.8 4.3-1.5 7.5-5 7.5-9.8V6L12 3Z" />,
  server: <><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  back: <><path d="M19 12H5M11 18l-6-6 6-6" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0 2 5.3" /><path d="M20 4v7h-7" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
};

export default function AppIcon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}
