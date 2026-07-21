import { NextResponse } from "next/server";
import { requireRole, errorResponse, HttpError } from "@/lib/guard";
import { getServer } from "@/lib/registry";
import { serverWithStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole("viewer");
    const server = getServer(params.id);
    if (!server) throw new HttpError(404, "Server not found");
    return NextResponse.json(await serverWithStatus(server));
  } catch (err) {
    return errorResponse(err);
  }
}
