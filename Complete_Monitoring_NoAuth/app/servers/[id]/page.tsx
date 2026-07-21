import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getServer } from "@/lib/registry";
import { serverWithStatus } from "@/lib/status";
import ServerDetailClient from "@/components/ServerDetailClient";

export const dynamic = "force-dynamic";

export default async function ServerDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const def = getServer(params.id);
  if (!def) notFound();
  const server = await serverWithStatus(def);
  return <ServerDetailClient initial={server} role={session!.role} />;
}
