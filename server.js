import http from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { properties as seed } from "./src/seed.js";
import { db, dataDir, all, get, put } from "./lib/store.js";
import {
  normalizeEmail,
  normalizePhone,
  validEmail,
  validPassword,
  verifyPassword,
  hashPassword,
  createUser,
  currentUser,
  publicUser,
  startSession,
  endSession,
} from "./lib/auth.js";
import { renderPage, sitemap, siteOrigin } from "./lib/seo.js";
import { validText, sanitizeProperty } from "./lib/properties.js";
if (!get("initialized", "initialized")) {
  if (process.env.SEED_DEMO !== "false")
    for (const p of seed) put("properties", { ...p, demo: true });
  put("initialized", { id: "initialized" });
}
// Identify the original sample records without claiming unassigned listings for new accounts.
for (const sample of seed) {
  const existing = get("properties", sample.id);
  if (existing && !existing.ownerId && existing.demo === undefined)
    put("properties", { ...existing, demo: true });
}
const dummyHash = await hashPassword("dummy-password-for-timing");
const origin = process.env.APP_ORIGIN;
const siteUrl = siteOrigin(
  process.env.SITE_URL || (origin?.startsWith("https://") ? origin : ""),
);
const publicProperties = () =>
  all("properties")
    .filter((p) => !p.archived && (p.demo || activeOwner(p)))
    .map(publicProperty);
if (origin && new URL(origin).origin !== origin)
  throw Error("APP_ORIGIN must be an origin without a trailing slash.");
const respond = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};
const owned = (u, r) => u && (u.role === "admin" || r.ownerId === u.id);
const activeOwner = (p) =>
  p.ownerId &&
  db.prepare("SELECT id FROM users WHERE id=? AND active=1").get(p.ownerId);
const publicProperty = (p) => {
  const u = p.ownerId
    ? db
        .prepare("SELECT name,phone FROM users WHERE id=? AND active=1")
        .get(p.ownerId)
    : null;
  const { ownerId, ...value } = p;
  return { ...value, agent: u ? { name: u.name, phone: u.phone } : null };
};
const limits = new Map();
function limited(req, bucket, max) {
  const now = Date.now();
  if (limits.size > 5000)
    for (const [key, v] of limits) if (v.until < now) limits.delete(key);
  const key = bucket + ":" + req.socket.remoteAddress;
  let entry = limits.get(key);
  if (!entry || entry.until < now) {
    entry = { count: 0, until: now + 15 * 60 * 1000 };
    limits.set(key, entry);
  }
  entry.count++;
  return entry.count > max;
}
async function body(req, max = 40000) {
  let size = 0,
    chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) {
      const e = Error("Request too large.");
      e.status = 413;
      throw e;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw Error("Invalid request.");
  }
}
let vite;
if (process.env.NODE_ENV !== "production")
  vite = await (
    await import("vite")
  ).createServer({ server: { middlewareMode: true }, appType: "spa" });
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  const pathname = new URL(req.url, "http://localhost").pathname;
  try {
    if (pathname.startsWith("/api/")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      if (!["GET", "HEAD"].includes(req.method)) {
        const expected = origin || "http://" + req.headers.host;
        if (req.headers.origin !== expected)
          return respond(res, 403, { error: "Request origin is not allowed." });
      }
      const user = currentUser(req);
      if (pathname === "/api/auth/me" && req.method === "GET")
        return respond(res, 200, { user });
      if (pathname === "/api/auth/logout" && req.method === "POST") {
        endSession(req, res);
        return respond(res, 200, { ok: true });
      }
      if (
        ["/api/auth/register", "/api/auth/login"].includes(pathname) &&
        req.method === "POST"
      ) {
        if (limited(req, "auth", 30))
          return respond(res, 429, {
            error: "Too many attempts. Please try again in 15 minutes.",
          });
        const b = await body(req),
          email = normalizeEmail(b.email);
        if (
          !validEmail(email) ||
          typeof b.password !== "string" ||
          b.password.length > 128
        )
          return respond(res, 400, {
            error: "Enter a valid email and password.",
          });
        if (pathname.endsWith("/register")) {
          if (
            !validText(b.name, 100) ||
            !normalizePhone(b.phone) ||
            !validPassword(b.password)
          )
            return respond(res, 400, {
              error:
                "Enter your name, a Nigerian mobile number, and a password of 12–128 characters.",
            });
          if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
            return respond(res, 409, {
              error: "An account already uses this email. Please sign in.",
            });
          const created = await createUser({ ...b, email, role: "agent" });
          startSession(res, created);
          return respond(res, 201, { user: created });
        }
        const candidate = db
          .prepare("SELECT * FROM users WHERE email=?")
          .get(email);
        const valid = await verifyPassword(
          b.password,
          candidate?.password || dummyHash,
        );
        if (!candidate || !valid || !candidate.active)
          return respond(res, 401, {
            error:
              "Email or password is incorrect, or the account is inactive.",
          });
        startSession(res, candidate);
        return respond(res, 200, { user: publicUser(candidate) });
      }
      if (pathname === "/api/account" && req.method === "PUT") {
        if (!user) return respond(res, 401, { error: "Please sign in." });
        const b = await body(req);
        if (!validText(b.name, 100) || !normalizePhone(b.phone))
          return respond(res, 400, {
            error: "Enter a name and valid Nigerian WhatsApp number.",
          });
        db.prepare("UPDATE users SET name=?,phone=? WHERE id=?").run(
          b.name.trim(),
          normalizePhone(b.phone),
          user.id,
        );
        return respond(res, 200, {
          user: publicUser(
            db.prepare("SELECT * FROM users WHERE id=?").get(user.id),
          ),
        });
      }
      if (pathname.startsWith("/api/users")) {
        if (!user) return respond(res, 401, { error: "Please sign in." });
        if (user.role !== "admin")
          return respond(res, 403, {
            error: "Administrator access is required.",
          });
        if (pathname === "/api/users" && req.method === "GET")
          return respond(
            res,
            200,
            db
              .prepare("SELECT * FROM users ORDER BY name")
              .all()
              .map(publicUser),
          );
        if (req.method === "PUT") {
          const id = pathname.split("/")[3],
            target = db.prepare("SELECT * FROM users WHERE id=?").get(id),
            b = await body(req);
          if (!target)
            return respond(res, 404, { error: "Account not found." });
          if (target.role === "admin")
            return respond(res, 403, {
              error: "Administrator accounts cannot be suspended here.",
            });
          if (typeof b.active !== "boolean")
            return respond(res, 400, { error: "Invalid account status." });
          db.prepare("UPDATE users SET active=? WHERE id=?").run(
            Number(b.active),
            id,
          );
          if (!b.active)
            db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
          return respond(res, 200, { ok: true });
        }
        return respond(res, 405, { error: "Method not allowed." });
      }
      if (pathname === "/api/uploads" && req.method === "POST") {
        if (!user)
          return respond(res, 401, {
            error: "Please sign in to upload photos.",
          });
        if (limited(req, "upload", 100))
          return respond(res, 429, {
            error: "Upload limit reached. Please try again later.",
          });
        const b = await body(req, 8 * 1024 * 1024);
        if (
          typeof b.data !== "string" ||
          !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.data)
        )
          return respond(res, 400, {
            error: "Choose a JPEG, PNG or WebP photo.",
          });
        let image;
        try {
          const input = Buffer.from(b.data.split(",")[1], "base64");
          if (input.length > 5 * 1024 * 1024)
            return respond(res, 413, {
              error: "Each photo must be 5 MB or smaller.",
            });
          image = await sharp(input, {
            limitInputPixels: 25000000,
            animated: false,
          })
            .rotate()
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 80 })
            .toBuffer();
        } catch {
          return respond(res, 400, {
            error:
              "This image cannot be processed. Use a JPEG, PNG or WebP photo under 25 megapixels.",
          });
        }
        const id = randomUUID() + ".jpg";
        writeFileSync(join(dataDir, "uploads", id), image);
        db.prepare("INSERT INTO uploads VALUES(?,?)").run(id, user.id);
        return respond(res, 201, { url: "/uploads/" + id });
      }
      const [, , kind, id] = pathname.split("/");
      if (!["properties", "leads", "viewings"].includes(kind))
        return respond(res, 404, { error: "Not found." });
      if (kind === "properties" && req.method === "GET") {
        const mine =
          new URL(req.url, "http://localhost").searchParams.get("mine") === "1";
        if (mine && !user)
          return respond(res, 401, { error: "Please sign in." });
        return respond(
          res,
          200,
          all(kind)
            .filter((p) =>
              mine ? owned(user, p) : !p.archived && (p.demo || activeOwner(p)),
            )
            .map((p) => (mine ? p : publicProperty(p))),
        );
      }
      const publicLead = kind === "leads" && req.method === "POST";
      if (!publicLead && !user)
        return respond(res, 401, { error: "Please sign in." });
      if (req.method === "GET")
        return respond(
          res,
          200,
          all(kind).filter((r) => owned(user, r)),
        );
      const existing = id ? get(kind, id) : null;
      if (id && (!existing || !owned(user, existing)))
        return respond(res, 404, { error: "Record not found." });
      if (req.method === "DELETE" && id) {
        if (kind === "properties") {
          put(kind, { ...existing, archived: true });
          return respond(res, 200, { ok: true });
        }
        db.prepare("DELETE FROM records WHERE id=? AND kind=?").run(id, kind);
        return respond(res, 200, { ok: true });
      }
      if (!["POST", "PUT"].includes(req.method))
        return respond(res, 405, { error: "Method not allowed." });
      if (req.method === "PUT" && !id)
        return respond(res, 404, { error: "Record not found." });
      const b = await body(req);
      let value;
      if (kind === "properties") {
        let ownerId = existing?.ownerId || user.id;
        if (user.role === "admin" && b.ownerId) {
          const owner = db
            .prepare("SELECT id FROM users WHERE id=? AND active=1")
            .get(b.ownerId);
          if (!owner)
            return respond(res, 400, { error: "Choose an active agent." });
          ownerId = owner.id;
        }
        value = {
          ...sanitizeProperty(
            b,
            ownerId,
            user,
            existing?.images || (existing?.image ? [existing.image] : []),
          ),
          demo: existing?.demo || false,
          archived: b.archived === true,
        };
        if (existing && ownerId !== existing.ownerId)
          for (const child of ["leads", "viewings"])
            for (const record of all(child))
              if (record.propertyId === existing.id)
                put(child, { ...record, ownerId });
      } else if (existing) {
        const statuses =
          kind === "leads"
            ? ["New", "Contacted", "Closed"]
            : ["Scheduled", "Completed", "Cancelled"];
        if (!statuses.includes(b.status))
          return respond(res, 400, { error: "Choose a valid status." });
        value = { ...existing, status: b.status };
      } else {
        const property = get("properties", b.propertyId);
        if (!property || property.archived || !activeOwner(property))
          return respond(res, 400, {
            error: "This property is not accepting enquiries or viewings.",
          });
        if (!validText(b.name, 100))
          return respond(res, 400, { error: "Enter a client name." });
        if (kind === "leads") {
          if (limited(req, "enquiry", 20))
            return respond(res, 429, {
              error: "Too many enquiries. Please try again later.",
            });
          if (
            !validEmail(b.email) ||
            !validText(b.phone, 30) ||
            !validText(b.message) ||
            b.consent !== true
          )
            return respond(res, 400, {
              error:
                "Enter your contact details and consent to sharing them with this agent.",
            });
          value = {
            name: b.name,
            email: b.email,
            phone: b.phone,
            message: b.message,
            consent: true,
            status: "New",
            propertyId: property.id,
            ownerId: property.ownerId,
          };
        } else {
          if (!owned(user, property))
            return respond(res, 404, { error: "Property not found." });
          if (
            !validText(b.date, 100) ||
            !Number.isFinite(Date.parse(b.date)) ||
            Date.parse(b.date) < Date.now()
          )
            return respond(res, 400, {
              error: "Choose a future viewing date.",
            });
          value = {
            name: b.name,
            date: new Date(b.date).toISOString(),
            status: "Scheduled",
            propertyId: property.id,
            ownerId: property.ownerId,
          };
        }
      }
      value = {
        ...value,
        id: existing?.id || randomUUID(),
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      put(kind, value);
      // Public enquiries never return owner details or identifiers for other client records.
      return respond(
        res,
        existing ? 200 : 201,
        publicLead ? { ok: true } : value,
      );
    }
    if (pathname.startsWith("/uploads/")) {
      if (!/^\/uploads\/[a-f0-9-]+\.jpg$/.test(pathname)) {
        res.writeHead(404);
        return res.end();
      }
      const id = pathname.slice(9);
      if (!db.prepare("SELECT id FROM uploads WHERE id=?").get(id)) {
        res.writeHead(404);
        return res.end();
      }
      try {
        res.writeHead(200, {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        });
        return res.end(readFileSync(join(dataDir, "uploads", id)));
      } catch {
        res.writeHead(404);
        return res.end();
      }
    }
    if (pathname === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(
        siteUrl
          ? `User-agent: *
Disallow: /api/
Disallow: /agent
Sitemap: ${siteUrl}/sitemap.xml
`
          : "User-agent: *\nDisallow: /\n",
      );
    }
    if (pathname === "/sitemap.xml") {
      res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
      return res.end(sitemap(publicProperties(), siteUrl));
    }
    const isPage =
      pathname === "/" || pathname === "/index.html" || !extname(pathname);
    if (
      pathname === "/index.html" ||
      (pathname.length > 1 && pathname.endsWith("/"))
    ) {
      res.writeHead(308, {
        Location:
          pathname === "/index.html" ? "/" : pathname.replace(/\/+$/, ""),
      });
      return res.end();
    }
    if (isPage) {
      const template = readFileSync(
        vite ? "index.html" : "dist/index.html",
        "utf8",
      );
      const page = renderPage(template, pathname, publicProperties(), siteUrl);
      const html = vite
        ? await vite.transformIndexHtml(req.url, page.html)
        : page.html;
      res.writeHead(page.status, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...(pathname === "/agent"
          ? { "X-Robots-Tag": "noindex, nofollow" }
          : {}),
      });
      return res.end(html);
    }
    if (vite) return vite.middlewares(req, res);
    const root = resolve("dist");
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      res.writeHead(400);
      return res.end("Invalid URL");
    }
    let file = resolve(root, "." + decoded);
    if (file !== root && !file.startsWith(root + "/")) {
      res.writeHead(403);
      return res.end();
    }
    if (!existsSync(file)) {
      res.writeHead(404);
      return res.end("Not found");
    }
    try {
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
      });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  } catch (e) {
    respond(res, e.status || 400, {
      error:
        e.status === 413
          ? "Request too large."
          : e.message || "Invalid request.",
    });
  }
});
server.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("Homestead listening on port " + (process.env.PORT || 3000)),
);
