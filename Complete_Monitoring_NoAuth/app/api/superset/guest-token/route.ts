import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupersetConfig, mintGuestToken } from "@/lib/superset";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const cfg = getSupersetConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Superset is not configured. Set SUPERSET_URL/USERNAME/PASSWORD/DASHBOARD_UUID in .env." },
      { status: 501 }
    );
  }
  try {
    const token = await mintGuestToken(cfg);
    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
