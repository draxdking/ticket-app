import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
export const dataDir = process.env.DATA_DIR || "./data";
mkdirSync(join(dataDir, "uploads"), { recursive: true });
export const db = new DatabaseSync(join(dataDir, "homestead.sqlite"));
db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS records(kind TEXT,id TEXT PRIMARY KEY,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'agent',active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,user_id TEXT NOT NULL);
`);
export const all = (kind) =>
  db
    .prepare("SELECT body FROM records WHERE kind=? ORDER BY rowid DESC")
    .all(kind)
    .map((r) => JSON.parse(r.body));
export const get = (kind, id) => {
  const r = db
    .prepare("SELECT body FROM records WHERE kind=? AND id=?")
    .get(kind, id);
  return r ? JSON.parse(r.body) : null;
};
export const put = (kind, value) =>
  db
    .prepare("INSERT OR REPLACE INTO records(kind,id,body) VALUES(?,?,?)")
    .run(kind, value.id, JSON.stringify(value));
