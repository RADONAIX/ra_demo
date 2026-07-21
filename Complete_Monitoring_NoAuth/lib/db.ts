import fs from "node:fs";
import path from "node:path";
// Node's built-in SQLite (Node 22.5+). No native compilation required.
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

export type Role = "viewer" | "operator" | "admin";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH || "./data/serverops.db";
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_email TEXT,
      server_id TEXT,
      server_name TEXT,
      service_id TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      source_ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

    CREATE TABLE IF NOT EXISTS config_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_email TEXT,
      server_id TEXT,
      service_id TEXT,
      old_values TEXT,
      new_values TEXT
    );

    CREATE TABLE IF NOT EXISTS script_current (
      server_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      values_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (server_id, service_id)
    );
  `);

  seedAdmin(db);
  return db;
}

function seedAdmin(database: DatabaseSync) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const existing = database.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "ChangeMe123!";
  const hash = bcrypt.hashSync(password, 10);
  database
    .prepare("INSERT INTO users (email, full_name, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(email, "Bootstrap Admin", hash);
  // eslint-disable-next-line no-console
  console.log(`[seed] created admin '${email}' — change this password after logging in.`);
}
