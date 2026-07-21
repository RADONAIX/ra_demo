/**
 * Server-side helper to mint a Superset guest token for embedding a dashboard.
 * Superset credentials never reach the browser — only the short-lived guest token does.
 *
 * Flow (Superset 2.x–4.x):
 *   1. POST /api/v1/security/login            -> access_token (+ session cookie)
 *   2. GET  /api/v1/security/csrf_token/      -> csrf token
 *   3. POST /api/v1/security/guest_token/     -> guest token for the dashboard
 */
export interface SupersetConfig {
  url: string;
  username: string;
  password: string;
  provider: string;
  dashboardUuid: string;
}

export function getSupersetConfig(): SupersetConfig | null {
  const url = process.env.SUPERSET_URL;
  const username = process.env.SUPERSET_USERNAME;
  const password = process.env.SUPERSET_PASSWORD;
  const dashboardUuid = process.env.SUPERSET_DASHBOARD_UUID;
  if (!url || !username || !password || !dashboardUuid) return null;
  return { url: url.replace(/\/$/, ""), username, password, provider: process.env.SUPERSET_PROVIDER || "db", dashboardUuid };
}

const TIMEOUT = 15000;

function collectCookies(res: Response, jar: Record<string, string>) {
  for (const sc of (res.headers as any).getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

export async function mintGuestToken(cfg: SupersetConfig): Promise<string> {
  const jar: Record<string, string> = {};

  // 1. login
  const loginRes = await fetch(`${cfg.url}/api/v1/security/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: cfg.username, password: cfg.password, provider: cfg.provider, refresh: true }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!loginRes.ok) throw new Error(`Superset login failed (${loginRes.status}): ${(await loginRes.text()).slice(0, 200)}`);
  collectCookies(loginRes, jar);
  const accessToken = (await loginRes.json()).access_token as string;

  // 2. csrf token
  const csrfRes = await fetch(`${cfg.url}/api/v1/security/csrf_token/`, {
    headers: { Authorization: `Bearer ${accessToken}`, Cookie: cookieHeader(jar) },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!csrfRes.ok) throw new Error(`Superset csrf_token failed (${csrfRes.status})`);
  collectCookies(csrfRes, jar);
  const csrfToken = (await csrfRes.json()).result as string;

  // 3. guest token
  const guestRes = await fetch(`${cfg.url}/api/v1/security/guest_token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-CSRFToken": csrfToken,
      Cookie: cookieHeader(jar),
      Referer: cfg.url,
    },
    body: JSON.stringify({
      user: { username: "embed", first_name: "Embedded", last_name: "Viewer" },
      resources: [{ type: "dashboard", id: cfg.dashboardUuid }],
      rls: [],
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!guestRes.ok) throw new Error(`Superset guest_token failed (${guestRes.status}): ${(await guestRes.text()).slice(0, 200)}`);
  return (await guestRes.json()).token as string;
}
