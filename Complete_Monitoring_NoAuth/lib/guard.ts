import { NextResponse } from "next/server";
import { getSession, hasRole, type Session } from "./auth";
import type { Role } from "./db";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Resolve the session and enforce a minimum role. Throws HttpError on failure. */
export async function requireRole(minimum: Role): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Not authenticated");
  if (!hasRole(session, minimum)) throw new HttpError(403, `Requires role >= ${minimum}`);
  return session;
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Internal error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}
