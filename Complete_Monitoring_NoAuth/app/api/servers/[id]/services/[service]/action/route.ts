import { NextResponse } from "next/server";
import { requireRole, errorResponse, HttpError, clientIp } from "@/lib/guard";
import { getServer, getService, type Action } from "@/lib/registry";
import { runAction } from "@/lib/ssh";
import { recordAudit } from "@/lib/audit";

const ACTIONS: Action[] = ["start", "stop", "restart", "reload", "status"];

export async function POST(
  req: Request,
  { params }: { params: { id: string; service: string } }
) {
  let session;
  try {
    // operator or admin may control services
    session = await requireRole("operator");
  } catch (err) {
    return errorResponse(err);
  }

  const { action } = (await req.json().catch(() => ({}))) as { action?: Action };
  const server = getServer(params.id);
  const service = server ? getService(params.id, params.service) : undefined;

  try {
    if (!server || !service) throw new HttpError(404, "Server or service not found");
    if (!action || !ACTIONS.includes(action)) throw new HttpError(400, "Invalid action");
    if (!service.allowedActions.includes(action)) {
      recordAudit({
        userEmail: session.sub, serverId: server.id, serverName: server.name,
        serviceId: service.id, action, status: "denied",
        detail: { reason: "action not allowed for service" }, sourceIp: clientIp(req),
      });
      throw new HttpError(403, `Action '${action}' not permitted for '${service.id}'`);
    }

    const result = await runAction(server, service, action);
    recordAudit({
      userEmail: session.sub, serverId: server.id, serverName: server.name,
      serviceId: service.id, action, status: result.ok ? "success" : "failed",
      detail: { code: result.code, stdout: result.stdout.slice(-1500), stderr: result.stderr.slice(-1500) },
      sourceIp: clientIp(req),
    });

    return NextResponse.json({
      ok: result.ok, code: result.code,
      stdout: result.stdout, stderr: result.stderr,
    });
  } catch (err) {
    if (!(err instanceof HttpError)) {
      recordAudit({
        userEmail: session.sub, serverId: server?.id, serverName: server?.name,
        serviceId: service?.id, action: action ?? "unknown", status: "failed",
        detail: { error: String(err) }, sourceIp: clientIp(req),
      });
    }
    return errorResponse(err);
  }
}
