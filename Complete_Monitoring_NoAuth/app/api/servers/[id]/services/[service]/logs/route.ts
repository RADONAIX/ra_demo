import { NextResponse } from "next/server";
import { requireRole, errorResponse, HttpError } from "@/lib/guard";
import { getServer, getService } from "@/lib/registry";
import { readLogs } from "@/lib/ssh";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string; service: string } }
) {
  try {
    await requireRole("viewer");
    const server = getServer(params.id);
    const service = server ? getService(params.id, params.service) : undefined;
    if (!server || !service) throw new HttpError(404, "Server or service not found");

    const lines = Number(new URL(req.url).searchParams.get("lines") ?? 200);
    const logs = await readLogs(server, service, lines);
    return NextResponse.json({ logs });
  } catch (err) {
    return errorResponse(err);
  }
}
