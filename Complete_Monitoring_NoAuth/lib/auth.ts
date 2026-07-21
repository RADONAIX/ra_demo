import type { Role } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-FREE BUILD
// This deployment has no login. Every request runs as a fixed "system" admin so
// that the rest of the app (RBAC guards, audit logging, role-gated UI) keeps
// working unchanged. Swap this back to a cookie/JWT implementation to re-enable
// authentication.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_ORDER: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

export interface Session {
  sub: string; // email / identity
  name?: string;
  role: Role;
}

// The single identity every request operates as.
const SYSTEM_SESSION: Session = {
  sub: "system@local",
  name: "System",
  role: "admin",
};

/** Always returns the system admin session (no authentication in this build). */
export async function getSession(): Promise<Session | null> {
  return SYSTEM_SESSION;
}

export function hasRole(session: Session | null, minimum: Role): boolean {
  return !!session && ROLE_ORDER[session.role] >= ROLE_ORDER[minimum];
}
