import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/guard";
import { listAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole("viewer");
    const q = new URL(req.url).searchParams;
    const rows = listAudit({
      server: q.get("server") ?? undefined,
      service: q.get("service") ?? undefined,
      status: q.get("status") ?? undefined,
      action: q.get("action") ?? undefined,
      limit: q.get("limit") ? Number(q.get("limit")) : undefined,
    });
    return NextResponse.json({ audit: rows });
  } catch (err) {
    return errorResponse(err);
  }
}
