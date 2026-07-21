import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/guard";
import { allServersWithStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("viewer");
    return NextResponse.json({ servers: await allServersWithStatus() });
  } catch (err) {
    return errorResponse(err);
  }
}
