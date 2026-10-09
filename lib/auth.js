import {
  scrypt,
  randomBytes,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
import { db } from "./store.js";
const derive = promisify(scrypt);
export const normalizeEmail = (e) =>
  String(e || "")
    .trim()
    .toLowerCase();
export function normalizePhone(value) {
  let p = String(value || "").replace(/[\s()+-]/g, "");
  if (/^0[789]\d{9}$/.test(p)) p = "234" + p.slice(1);
  return /^234[789]\d{9}$/.test(p) ? p : null;
}
export const validEmail = (e) =>
  typeof e === "string" &&
  e.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const validPassword = (p) =>
  typeof p === "string" && p.length >= 12 && p.length <= 128;
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return salt + ":" + hash.toString("hex");
}
export async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(":");
  const hash = await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(hash, Buffer.from(hex, "hex"));
}
export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  active: Boolean(u.active),
});
export async function createUser({
  name,
  email,
  phone,
  password,
  role = "agent",
}) {
  const user = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizeEmail(email),
    phone: normalizePhone(phone),
    role,
    password: await hashPassword(password),
  };
  db.prepare(
    "INSERT INTO users(id,name,email,phone,password,role) VALUES(?,?,?,?,?,?)",
  ).run(user.id, user.name, user.email, user.phone, user.password, user.role);
  return publicUser({ ...user, active: 1 });
}
const digest = (t) => createHash("sha256").update(t).digest("hex");
export const secureCookie =
  process.env.COOKIE_SECURE !== "false" &&
  process.env.NODE_ENV === "production";
export function startSession(res, user) {
  const token = randomBytes(32).toString("hex"),
    expires = Date.now() + 7 * 24 * 3600 * 1000;
  db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    digest(token),
    user.id,
    expires,
  );
  res.setHeader(
    "Set-Cookie",
    `homestead_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureCookie ? "; Secure" : ""}`,
  );
}
function tokenFrom(req) {
  const value = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("homestead_session="))
    ?.slice(18);
  return /^[a-f0-9]{64}$/.test(value || "") ? value : null;
}
export function currentUser(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const u = db
    .prepare(
      "SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>? AND users.active=1",
    )
    .get(digest(token), Date.now());
  return u ? publicUser(u) : null;
}
export function endSession(req, res) {
  const token = tokenFrom(req);
  if (token)
    db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
  res.setHeader(
    "Set-Cookie",
    `homestead_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie ? "; Secure" : ""}`,
  );
}
