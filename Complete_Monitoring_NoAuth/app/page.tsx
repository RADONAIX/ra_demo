import { getSession } from "@/lib/auth";
import { allServersWithStatus } from "@/lib/status";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const servers = await allServersWithStatus();
  return <DashboardClient initial={servers} role={session!.role} />;
}
