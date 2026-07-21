import { NextResponse } from "next/server";
import { requireRole, errorResponse, HttpError, clientIp } from "@/lib/guard";
import { getServer, getService } from "@/lib/registry";
import { readConfig, writeConfig, runAction } from "@/lib/ssh";
import { recordAudit } from "@/lib/audit";

function requireScript(id: string, serviceId: string) {
  const server = getServer(id);
  const service = server ? getService(id, serviceId) : undefined;
  if (!server || !service) throw new HttpError(404, "Server or service not found");
  if (service.kind !== "python_script" || !service.config) {
    throw new HttpError(400, "Service does not have an editable config");
  }
  return { server, service };
}

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string; service: string } }) {
  try {
    await requireRole("operator");
    const { server, service } = requireScript(params.id, params.service);
    const content = await readConfig(server, service.config!.path);
    return NextResponse.json({
      serviceId: service.id,
      path: service.config!.path,
      content,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: { id: string; service: string } }) {
  let session;
  try {
    session = await requireRole("operator");
  } catch (err) {
    return errorResponse(err);
  }

  const server = getServer(params.id);
  const service = server ? getService(params.id, params.service) : undefined;

  try {
    const { service: svc } = requireScript(params.id, params.service);
    const body = (await req.json().catch(() => ({}))) as { content?: string; restart?: boolean };
    
    if (typeof body.content !== "string") {
      throw new HttpError(400, "Missing or invalid content");
    }

    // 1. Write atomically on the server.
    const wr = await writeConfig(server!, svc.config!.path, body.content);
    if (!wr.ok) throw new HttpError(502, `Failed to write config: ${wr.detail}`);

    // 2. Restart only the affected script if requested.
    let restart: string | null = null;
    if (body.restart) {
      const r = await runAction(server!, svc, "restart").catch((e) => ({ ok: false, stderr: String(e), code: null, stdout: "" }));
      restart = r.ok ? "success" : "failed";
    }

    recordAudit({
      userEmail: session.sub, serverId: server!.id, serverName: server!.name,
      serviceId: svc.id, action: "raw_config_update", status: "success",
      detail: { restart }, sourceIp: clientIp(req),
    });

    return NextResponse.json({ ok: true, restart });
  } catch (err) {
    if (!(err instanceof HttpError) || err.status >= 500) {
      recordAudit({
        userEmail: session.sub, serverId: server?.id, serverName: server?.name,
        serviceId: service?.id, action: "raw_config_update", status: "failed",
        detail: { error: String(err) }, sourceIp: clientIp(req),
      });
    }
    return errorResponse(err);
  }
}
