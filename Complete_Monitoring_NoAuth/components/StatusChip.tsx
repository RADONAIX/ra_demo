export type Status = "running" | "stopped" | "restarting" | "failed" | "unknown";

const LABELS: Record<Status, string> = {
  running: "Running",
  stopped: "Stopped",
  restarting: "Restarting",
  failed: "Failed",
  unknown: "Unknown",
};

export default function StatusChip({ status }: { status: Status }) {
  const s = (LABELS[status] ? status : "unknown") as Status;
  return (
    <span className={`chip ${s}`}>
      <span className="dot" />
      {LABELS[s]}
    </span>
  );
}

export function formatUptime(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}
