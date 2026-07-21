/**
 * Same-origin reverse proxy for each server's Airflow web UI.
 *
 * Embedding Airflow from a different origin in an <iframe> breaks because the browser
 * blocks Airflow's (third-party, SameSite=Lax) session cookie, which surfaces as
 * "Bad Request: The CSRF session token is missing." Serving Airflow under our own origin
 * (/api/airflow/:id/...) makes its cookies first-party, so sessions + CSRF work.
 *
 * Airflow emits root-relative links (/static, /login) and absolute redirects using its own
 * host, so we rewrite URLs in headers and text bodies to stay under the proxy prefix.
 * This means it works with NO Airflow config change. (Setting enable_proxy_fix=True on
 * Airflow is an alternative that makes it emit prefixed URLs itself.)
 */
import { getSession } from "@/lib/auth";
import { getServer, getService } from "@/lib/registry";

export const dynamic = "force-dynamic";

const HOP = new Set([
  "connection", "keep-alive", "transfer-encoding", "te", "trailer",
  "upgrade", "proxy-authorization", "proxy-authenticate",
]);

const TEXTUAL = [
  "text/html", "text/css", "application/javascript", "text/javascript",
  "application/json", "application/xml", "text/xml",
];

function rewriteBody(body: string, origin: string, prefix: string, ct: string): string {
  // Absolute origin, raw and URL-encoded (e.g. the ?next=http%3A%2F%2Fhost%2Fhome param).
  let out = body.split(origin).join(prefix);
  out = out.split(encodeURIComponent(origin)).join(encodeURIComponent(prefix));
  // Root-relative refs in markup/styles -> prefix them.
  if (ct.includes("html") || ct.includes("css")) {
    out = out
      .replace(/(\b(?:href|src|action)\s*=\s*")\/(?!\/)/g, `$1${prefix}/`)
      .replace(/(\b(?:href|src|action)\s*=\s*')\/(?!\/)/g, `$1${prefix}/`)
      .replace(/(url\(\s*["']?)\/(?!\/)/g, `$1${prefix}/`);
  }
  return out;
}

function rewriteLocation(loc: string, origin: string, prefix: string): string {
  // Rewrite the Airflow origin anywhere in the value (e.g. inside ?next=...), raw + encoded.
  let out = loc.split(origin).join(prefix).split(encodeURIComponent(origin)).join(encodeURIComponent(prefix));
  if (out.startsWith(prefix)) return out;
  if (out.startsWith("/") && !out.startsWith("//")) return prefix + out;
  return out;
}

async function handler(req: Request, { params }: { params: { id: string; path?: string[] } }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const server = getServer(params.id);
  const airflow = server ? getService(params.id, "airflow") : undefined;
  if (!server || !airflow || !airflow.web) return new Response("Not found", { status: 404 });

  const origin = `http://${server.ssh.host}:${airflow.web.port}`;
  const prefix = `/api/airflow/${params.id}`;
  const url = new URL(req.url);
  // Derive the forward path from the raw pathname so trailing slashes and encoding are
  // preserved verbatim (rebuilding from params.path drops the trailing slash and loops).
  const rest = url.pathname.slice(prefix.length) || "/";
  const target = `${origin}${rest}${url.search}`;

  // ---- forward request headers ----
  const headers = new Headers();
  req.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (HOP.has(lk) || lk === "host" || lk === "content-length" || lk === "cookie") return;
    headers.set(k, v);
  });
  // strip our dashboard session cookie so the JWT is never forwarded to the Airflow host
  const cookie = req.headers.get("cookie");
  if (cookie) {
    const kept = cookie.split(/;\s*/).filter((c) => !c.startsWith("serverops_session=")).join("; ");
    if (kept) headers.set("cookie", kept);
  }
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  headers.set("X-Forwarded-Prefix", prefix);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let res: Response;
  try {
    res = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    return new Response(
      `Could not reach Airflow at ${origin} — check it is up and reachable from the dashboard host.\n${e}`,
      { status: 502 }
    );
  }

  // ---- forward response headers ----
  const out = new Headers();
  res.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (HOP.has(lk)) return;
    if (lk === "content-encoding" || lk === "content-length") return; // body already decoded by fetch
    if (lk === "x-frame-options" || lk === "content-security-policy") return; // allow embedding
    if (lk === "set-cookie" || lk === "location") return; // handled below
    out.append(k, v);
  });

  const loc = res.headers.get("location");
  if (loc) out.set("location", rewriteLocation(loc, origin, prefix));

  // pass Airflow's cookies through, scoped to the proxy path and de-domained
  const setCookies = (res.headers as any).getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const scoped = sc
      .replace(/;\s*Domain=[^;]+/gi, "")
      .replace(/;\s*Path=[^;]+/gi, `; Path=${prefix}`);
    out.append("set-cookie", /;\s*Path=/i.test(sc) ? scoped : `${scoped}; Path=${prefix}`);
  }

  // ---- rewrite textual bodies so URLs stay under the proxy; stream binaries untouched ----
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (TEXTUAL.some((t) => ct.includes(t))) {
    const text = rewriteBody(await res.text(), origin, prefix, ct);
    return new Response(text, { status: res.status, statusText: res.statusText, headers: out });
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
