import { NextResponse } from "next/server";
import Ajv from "ajv";
import yaml from "js-yaml";
import { requireRole, errorResponse, HttpError, clientIp } from "@/lib/guard";
import { getServer, getService, type ServiceDef } from "@/lib/registry";
import { getDb } from "@/lib/db";
import { writeConfig, runAction } from "@/lib/ssh";
import { recordAudit } from "@/lib/audit";

const ajv = new Ajv({ allErrors: true, coerceTypes: true });

function currentValues(serverId: string, service: ServiceDef): Record<string, any> {
  const row = getDb()
    .prepare("SELECT values_json FROM script_current WHERE server_id = ? AND service_id = ?")
    .get(serverId, service.id) as { values_json: string } | undefined;
  if (row) return JSON.parse(row.values_json);
  return service.config?.defaults ?? {};
}

function render(format: string, values: Record<string, any>): string {
  if (format === "yaml") return yaml.dump(values, { sortKeys: false });
  if (format === "json") return JSON.stringify(values, null, 2);
  return Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

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
    const { service } = requireScript(params.id, params.service);
    return NextResponse.json({
      serviceId: service.id,
      path: service.config!.path,
      format: service.config!.format,
      schema: service.config!.schema,
      values: currentValues(params.id, service),
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

  const body = (await req.json().catch(() => ({}))) as { values?: Record<string, any>; restart?: boolean };
  const server = getServer(params.id);
  const service = server ? getService(params.id, params.service) : undefined;

  try {
    const { service: svc } = requireScript(params.id, params.service);

    // 1. Validate against the schema before touching anything.
    const validate = ajv.compile(svc.config!.schema);
    if (!validate(body.values ?? {})) {
      throw new HttpError(422, "Validation failed: " + ajv.errorsText(validate.errors));
    }
    const newValues = body.values!;
    const oldValues = currentValues(params.id, svc);

    // 2. Render + write atomically on the server.
    const rendered = render(svc.config!.format, newValues);
    const wr = await writeConfig(server!, svc.config!.path, rendered);
    if (!wr.ok) throw new HttpError(502, `Failed to write config: ${wr.detail}`);

    // 3. Persist new values + version history.
    const db = getDb();
    db.prepare(
      `INSERT INTO script_current (server_id, service_id, values_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(server_id, service_id) DO UPDATE SET values_json = excluded.values_json, updated_at = datetime('now')`
    ).run(params.id, svc.id, JSON.stringify(newValues));
    db.prepare(
      `INSERT INTO config_versions (user_email, server_id, service_id, old_values, new_values)
       VALUES (?, ?, ?, ?, ?)`
    ).run(session.sub, params.id, svc.id, JSON.stringify(oldValues), JSON.stringify(newValues));

    // 4. Restart only the affected script if requested.
    let restart: string | null = null;
    if (body.restart) {
      const r = await runAction(server!, svc, "restart").catch((e) => ({ ok: false, stderr: String(e), code: null, stdout: "" }));
      restart = r.ok ? "success" : "failed";
    }

    const changedKeys = Object.keys(newValues).filter((k) => JSON.stringify(newValues[k]) !== JSON.stringify(oldValues[k]));
    recordAudit({
      userEmail: session.sub, serverId: server!.id, serverName: server!.name,
      serviceId: svc.id, action: "config_update", status: "success",
      detail: { changedKeys, restart }, sourceIp: clientIp(req),
    });

    return NextResponse.json({ ok: true, values: newValues, restart, changedKeys });
  } catch (err) {
    if (!(err instanceof HttpError) || err.status >= 500) {
      recordAudit({
        userEmail: session.sub, serverId: server?.id, serverName: server?.name,
        serviceId: service?.id, action: "config_update", status: "failed",
        detail: { error: String(err) }, sourceIp: clientIp(req),
      });
    }
    return errorResponse(err);
  }
}
