# ServerOps Dashboard (No-Auth build)

> **This is the authentication-free variant.** There is no login page. Every
> request runs as a fixed `system` admin (`lib/auth.ts`), so the app opens
> straight to the fleet view. **Only deploy this behind your own network/proxy
> access controls** — anyone who can reach it has full admin rights.
>
> To re-enable login, restore `middleware.ts`, `app/login/`, `app/api/auth/`, and
> the cookie/JWT `lib/auth.ts` from the original project.

A single **Next.js** application to operate services across your Linux fleet
(pgbouncer, postgres, clickhouse, airflow, ngrok, and custom Python scripts) from one
role-based, auditable dashboard.

- **Framework:** Next.js 14 (App Router) + TypeScript — UI **and** API in one app
- **Auth:** none — fixed `system` admin identity (no login page)
- **Remote execution:** whitelisted `systemctl` / `journalctl` over SSH (`node-ssh`) — no arbitrary shell
- **Storage:** SQLite (`better-sqlite3`) for users, audit log, and config history
- **Config registry:** `config/servers.json` describes servers + services (secrets stay in env vars)
- **Demo mode:** `MOCK_MODE=true` simulates statuses so you can explore without real servers

---

## Quick start

```bash
cp .env.example .env      # AUTH_SECRET is no longer needed in this build

npm install
npm run dev        # http://localhost:3000
```

The app opens directly on the dashboard — no login required.
`MOCK_MODE=true` is on by default, so the three demo servers show simulated statuses immediately.

To manage **real** servers: set `MOCK_MODE=false`, edit `config/servers.json` with real hostnames,
and put each server's SSH key or password in the env vars it references (`SRV1_SSH_KEY`, …).

---

## How it works

```
Browser ──▶ Next.js pages (app/)        server components read the session cookie
   │
   ├── /                Dashboard grid — all servers + services, status chips, quick actions
   ├── /servers/[id]    Detail — service table, uptime, logs viewer, config editor
   └── /audit           Audit log with filters
   │
   ▼ fetch()
Next.js API routes (app/api/**)         RBAC enforced per-route via lib/guard
   │
   ├── lib/registry.ts  loads config/servers.json (server + service definitions)
   ├── lib/ssh.ts       whitelisted systemctl/journalctl over SSH (or mock)
   ├── lib/db.ts        SQLite: users + audit_log + config history
   └── lib/audit.ts     every mutating action is recorded
```

### Roles
| Role | Can do |
|------|--------|
| `viewer` | view servers, statuses, logs, audit |
| `operator` | + start / stop / restart / reload services, edit script configs |
| `admin` | everything (intended for user management / server config changes) |

`middleware.ts` redirects unauthenticated page requests to `/login`; API routes independently
verify the session and required role.

### Service control flow
`POST /api/servers/:id/services/:service/action { action }`
→ RBAC check → action must be in the service's `allowedActions` whitelist
→ `lib/ssh.runAction` maps it to a fixed `systemctl <action> <unit>` (unit validated against a strict charset)
→ result recorded in `audit_log` → UI toast + status refresh.

### Python config update flow
`GET/POST /api/servers/:id/scripts/:service/config`
1. `GET` returns the JSON Schema + current values.
2. `ConfigModal` renders a structured form from the schema.
3. `POST` validates values with **Ajv** → renders YAML/JSON/env → writes atomically over SSH
   (base64 transfer, temp file + `mv`, keeps a `.bak`) → optionally restarts only that script
   → records a `config_versions` history row + audit entry.
   Validation failure (422) changes nothing on the server.

---

## Project structure

```
app/
  layout.tsx  page.tsx  login/  servers/[id]/  audit/
  api/
    auth/{login,logout,me}/route.ts
    servers/route.ts
    servers/[id]/route.ts
    servers/[id]/services/[service]/{action,logs}/route.ts
    servers/[id]/scripts/[service]/config/route.ts
    audit/route.ts
components/   TopBar, StatusChip, DashboardClient, ServerDetailClient,
              ServiceControls, ConfigModal, AuditClient, Toast
lib/          registry, db, auth, guard, ssh, status, audit
config/servers.json      server + service registry (edit this)
examples/price_ingestor/ example managed Python script + systemd unit
middleware.ts            page-level auth gate
```

---

## Security notes

- **No secrets in the client.** SSH keys/passwords live only in env vars referenced by
  `config/servers.json`; `publicServer()` strips them from every API response.
- **No command injection.** The dashboard never builds a shell string from user input.
  Actions come from a fixed whitelist; the only interpolated value is a unit name validated
  against `^[A-Za-z0-9._@-]+$`; config bytes are transferred base64-encoded.
- **Least privilege.** Give the SSH user a narrow `sudoers` rule limited to `systemctl`
  on the specific units (see `examples/price_ingestor/price-ingestor.service`).
- **Auditable.** Login, denied attempts, every service action, and every config change are
  written to `audit_log` with user, server, service, result, and source IP.
- **Session cookie** is `httpOnly` + `SameSite=Lax` (CSRF-resistant) and `Secure` in production.
  Serve behind HTTPS and pin SSH host keys before going to production.

---

## Production deployment (sketch)

```bash
npm run build && npm start        # or run behind a reverse proxy (nginx/caddy) with TLS
```

- Set `MOCK_MODE=false`, a strong `AUTH_SECRET`, and change the admin password.
- Persist the `data/` directory (SQLite). For higher scale, swap `lib/db.ts` to PostgreSQL.
- Run as a systemd service or in Docker; front it with HTTPS.

## Acceptance criteria mapping
- View all services on all servers → `/` dashboard grid (`GET /api/servers`).
- Start/stop/restart → `ServiceControls` → action API (RBAC + whitelist).
- Edit config + restart Python scripts → `ConfigModal` → config API (validate → write → restart).
- Status updates + logs → 10s auto-refresh polling + logs viewer on the detail page.
- Auditable → `/audit` page backed by `audit_log`.
