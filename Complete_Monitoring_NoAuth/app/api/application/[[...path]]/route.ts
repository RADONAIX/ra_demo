import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// This is an internal application with a certificate the dashboard host does
// not trust. TLS verification is disabled only for this fixed private address.
const ORIGIN = "https://10.200.37.142";
const PREFIX = "/api/application";
const HOP_HEADERS = new Set([
  "connection", "keep-alive", "transfer-encoding", "te", "trailer",
  "upgrade", "proxy-authorization", "proxy-authenticate",
]);

interface UpstreamResponse {
  status: number;
  statusText: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

function requestApplication(target: string, method: string, headers: Headers, body?: ArrayBuffer): Promise<UpstreamResponse> {
  return new Promise((resolve, reject) => {
    const upstream = https.request(target, {
      method,
      headers: Object.fromEntries(headers.entries()),
      rejectUnauthorized: false,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({
        status: response.statusCode ?? 502,
        statusText: response.statusMessage ?? "",
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    upstream.setTimeout(30_000, () => upstream.destroy(new Error("Application request timed out")));
    upstream.on("error", reject);
    if (body) upstream.write(Buffer.from(body));
    upstream.end();
  });
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function rewriteLocation(location: string): string {
  if (location.startsWith(ORIGIN)) return location.replace(ORIGIN, PREFIX);
  if (location.startsWith("/") && !location.startsWith("//")) return PREFIX + location;
  return location;
}

function rewriteText(body: string, contentType: string): string {
  let output = body.split(ORIGIN).join(PREFIX);
  if (contentType.includes("text/html") || contentType.includes("text/css")) {
    output = output
      .replace(/(\b(?:href|src|action)\s*=\s*")\/(?!\/)/g, `$1${PREFIX}/`)
      .replace(/(\b(?:href|src|action)\s*=\s*')\/(?!\/)/g, `$1${PREFIX}/`)
      .replace(/(url\(\s*["']?)\/(?!\/)/g, `$1${PREFIX}/`);
  }
  return output;
}

async function proxy(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const path = url.pathname.slice(PREFIX.length) || "/";
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_HEADERS.has(lower) && !["host", "content-length", "cookie"].includes(lower)) headers.set(key, value);
  });
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  headers.set("X-Forwarded-Prefix", PREFIX);

  let upstream: UpstreamResponse;
  try {
    upstream = await requestApplication(
      `${ORIGIN}${path}${url.search}`,
      req.method,
      headers,
      ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    );
  } catch (error) {
    return new Response(`Could not reach the application at ${ORIGIN}.\n${error}`, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(upstream.headers)) {
    const lower = key.toLowerCase();
    if (value !== undefined && !HOP_HEADERS.has(lower) && !["content-encoding", "content-length", "x-frame-options", "content-security-policy", "location", "set-cookie"].includes(lower)) {
      responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }
  const location = headerValue(upstream.headers, "location");
  if (location) responseHeaders.set("location", rewriteLocation(location));

  const cookies = upstream.headers["set-cookie"];
  for (const cookie of Array.isArray(cookies) ? cookies : cookies ? [cookies] : []) {
    const scoped = cookie.replace(/;\s*Domain=[^;]+/gi, "").replace(/;\s*Path=[^;]+/gi, `; Path=${PREFIX}`);
    responseHeaders.append("set-cookie", /;\s*Path=/i.test(cookie) ? scoped : `${scoped}; Path=${PREFIX}`);
  }

  const contentType = headerValue(upstream.headers, "content-type")?.toLowerCase() ?? "";
  const textual = contentType.includes("text/html") || contentType.includes("text/css") || contentType.includes("javascript");
  const body: BodyInit = textual
    ? rewriteText(upstream.body.toString("utf-8"), contentType)
    : upstream.body.buffer.slice(upstream.body.byteOffset, upstream.body.byteOffset + upstream.body.byteLength) as ArrayBuffer;
  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD, proxy as OPTIONS };
