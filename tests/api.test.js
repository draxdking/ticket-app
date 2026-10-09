import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
test("accounts isolate records; photos, fees, contact details and sessions persist", async () => {
  const dir = mkdtempSync(join(tmpdir(), "homestead-test-")),
    base = "http://127.0.0.1:3109";
  let child;
  async function start() {
    child = spawn(process.execPath, ["server.js"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
        APP_ORIGIN: base,
        SEED_DEMO: "false",
        PORT: "3109",
        DATA_DIR: dir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    await new Promise((resolve, reject) => {
      const t = setTimeout(
        () => reject(Error("Server readiness timeout: " + log)),
        10000,
      );
      child.stdout.on("data", (b) => {
        log += b;
        if (log.includes("listening")) {
          clearTimeout(t);
          resolve();
        }
      });
      child.stderr.on("data", (b) => (log += b));
      child.once("exit", (code) => {
        clearTimeout(t);
        reject(Error("Server exited " + code + ": " + log));
      });
    });
  }
  async function stop() {
    const done = once(child, "exit");
    child.kill();
    await done;
  }
  async function request(
    path,
    method = "GET",
    body,
    cookie = "",
    origin = base,
  ) {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie"),
    };
  }
  const account = (name, email) => ({
    name,
    email,
    phone: "08012345678",
    password: "A secure test password 123!",
  });
  try {
    await start();
    assert.equal((await request("/api/auth/me")).body.user, null);
    for (const path of [
      "/api/leads",
      "/api/viewings",
      "/api/properties?mine=1",
      "/api/users",
    ])
      assert.equal((await request(path)).status, 401);
    assert.equal((await request("/api/properties", "POST", {})).status, 401);
    assert.equal(
      (
        await request("/api/auth/register", "POST", {
          ...account("Weak", "weak@example.com"),
          password: "short",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "/api/auth/register",
          "POST",
          account("Bad origin", "bad@example.com"),
          "",
          "https://evil.example",
        )
      ).status,
      403,
    );
    let r = await request("/api/auth/register", "POST", {
      ...account("Agent A", "a@example.com"),
      role: "admin",
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, "agent");
    assert.equal(r.body.user.phone, "2348012345678");
    assert(!("password" in r.body.user));
    assert.match(r.cookie, /HttpOnly/);
    assert.match(r.cookie, /SameSite=Lax/);
    const a = r.cookie.split(";")[0],
      aId = r.body.user.id;
    r = await request(
      "/api/auth/register",
      "POST",
      account("Agent B", "b@example.com"),
    );
    assert.equal(r.status, 201);
    const b = r.cookie.split(";")[0],
      bId = r.body.user.id;
    assert.equal((await request("/api/users", "GET", null, a)).status, 403);
    assert.equal(
      (
        await request("/api/auth/login", "POST", {
          email: "a@example.com",
          password: "wrong",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/api/auth/login", "POST", {
          email: "a@example.com",
          password: account().password,
        })
      ).status,
      200,
    );
    const input = await sharp({
        create: {
          width: 1800,
          height: 1000,
          channels: 3,
          background: "#aa9944",
        },
      })
        .png()
        .toBuffer(),
      image = "data:image/png;base64," + input.toString("base64");
    assert.equal(
      (await request("/api/uploads", "POST", { data: image })).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/api/uploads",
          "POST",
          { data: "data:image/png;base64,ZmFrZQ==" },
          a,
        )
      ).status,
      400,
    );
    r = await request("/api/uploads", "POST", { data: image }, a);
    assert.equal(r.status, 201);
    const photo = r.body.url;
    const downloaded = await fetch(base + photo);
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get("content-type"), "image/jpeg");
    const meta = await sharp(
      Buffer.from(await downloaded.arrayBuffer()),
    ).metadata();
    assert.equal(meta.width, 1600);
    assert(!meta.exif);
    const property = {
      title: "Test home",
      type: "Apartment",
      location: "Ikeja, Lagos",
      city: "Lagos",
      purpose: "Rent",
      price: 3000000,
      beds: 3,
      baths: 3,
      area: 150,
      description: "A test home with space to grow.",
      images: [photo, "https://example.com/second.jpg"],
      fees: {
        agency: { amount: 300000, frequency: "once", refundable: false },
        legal: { amount: 300000, frequency: "once", refundable: false },
        caution: { amount: 200000, frequency: "once", refundable: true },
        service: { amount: 500000, frequency: "annual", refundable: false },
      },
    };
    assert.equal(
      (await request("/api/properties", "POST", { ...property, price: -1 }, a))
        .status,
      400,
    );
    assert.equal(
      (await request("/api/properties", "POST", property, b)).status,
      400,
    ); // cannot attach another agent's photo
    r = await request(
      "/api/properties",
      "POST",
      { ...property, ownerId: bId },
      a,
    );
    assert.equal(r.status, 201);
    const saved = r.body;
    assert.equal(saved.ownerId, aId);
    assert.equal(saved.fees.caution.refundable, true);
    assert.equal(
      (await request("/api/properties?mine=1", "GET", null, b)).body.length,
      0,
    );
    assert.equal(
      (await request("/api/properties/" + saved.id, "PUT", property, b)).status,
      404,
    );
    assert.equal(
      (await request("/api/properties/" + saved.id, "DELETE", null, b)).status,
      404,
    );
    r = await request("/api/properties");
    assert.equal(r.body.length, 1);
    assert.equal(r.body[0].agent.phone, "2348012345678");
    assert(!("ownerId" in r.body[0]));
    const lead = {
      name: "Client",
      email: "client@example.com",
      phone: "08000000000",
      propertyId: saved.id,
      message: "Please arrange a viewing.",
      consent: true,
      status: "Closed",
      ownerId: bId,
    };
    assert.equal(
      (await request("/api/leads", "POST", { ...lead, consent: false })).status,
      400,
    );
    assert.equal((await request("/api/leads", "POST", lead)).status, 201);
    let list = (await request("/api/leads", "GET", null, a)).body;
    assert.equal(list.length, 1);
    const savedLead = list[0];
    assert.equal(savedLead.ownerId, aId);
    assert.equal(savedLead.status, "New");
    assert.equal((await request("/api/leads", "GET", null, b)).body.length, 0);
    assert.equal(
      (
        await request(
          "/api/leads/" + savedLead.id,
          "PUT",
          { status: "Closed" },
          b,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          "/api/leads/" + savedLead.id,
          "PUT",
          { status: "Contacted" },
          a,
        )
      ).body.status,
      "Contacted",
    );
    const viewing = {
      name: "Client",
      propertyId: saved.id,
      date: new Date(Date.now() + 86400000).toISOString(),
    };
    assert.equal(
      (await request("/api/viewings", "POST", viewing, b)).status,
      404,
    );
    assert.equal(
      (
        await request(
          "/api/viewings",
          "POST",
          { ...viewing, date: "2000-01-01" },
          a,
        )
      ).status,
      400,
    );
    r = await request("/api/viewings", "POST", viewing, a);
    assert.equal(r.status, 201);
    assert.equal(
      (
        await request(
          "/api/viewings/" + r.body.id,
          "PUT",
          { status: "Completed" },
          a,
        )
      ).body.status,
      "Completed",
    );
    await stop();
    const database = new DatabaseSync(join(dir, "homestead.sqlite"));
    const stored = database
      .prepare("SELECT password FROM users WHERE id=?")
      .get(aId).password;
    assert(!stored.includes(account().password));
    database.close();
    const promoted = spawn(
      process.execPath,
      ["scripts/create-admin.js", "b@example.com"],
      { env: { ...process.env, DATA_DIR: dir }, stdio: "ignore" },
    );
    assert.equal((await once(promoted, "exit"))[0], 0);
    await start();
    assert.equal(
      (await request("/api/auth/me", "GET", null, a)).body.user.id,
      aId,
    );
    assert.equal(
      (await request("/api/leads", "GET", null, a)).body[0].status,
      "Contacted",
    );
    assert.equal(
      (await request("/api/viewings", "GET", null, a)).body[0].status,
      "Completed",
    );
    assert.equal((await request("/api/users", "GET", null, b)).body.length, 2);
    // Reassignment moves the client records, while the incoming agent can
    // continue editing photos already attached to the assigned property.
    r = await request(
      "/api/auth/register",
      "POST",
      account("Agent C", "c@example.com"),
    );
    const c = r.cookie.split(";")[0],
      cId = r.body.user.id;
    assert.equal(
      (
        await request(
          "/api/properties/" + saved.id,
          "PUT",
          { ...property, ownerId: cId },
          b,
        )
      ).status,
      200,
    );
    assert.equal((await request("/api/leads", "GET", null, a)).body.length, 0);
    assert.equal((await request("/api/leads", "GET", null, c)).body.length, 1);
    assert.equal(
      (await request("/api/viewings", "GET", null, c)).body.length,
      1,
    );
    assert.equal(
      (
        await request(
          "/api/properties/" + saved.id,
          "PUT",
          { ...property, title: "Incoming agent edit" },
          c,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "/api/properties/" + saved.id,
          "PUT",
          { ...property, ownerId: aId },
          b,
        )
      ).status,
      200,
    );
    assert.equal((await request("/api/leads", "GET", null, c)).body.length, 0);
    assert.equal(
      (await request("/api/properties/" + saved.id, "PUT", property, c)).status,
      404,
    );

    assert.equal(
      (await request("/api/users/" + aId, "PUT", { active: false }, b)).status,
      200,
    );
    assert.equal(
      (await request("/api/auth/me", "GET", null, a)).body.user,
      null,
    );
    assert.equal((await request("/api/properties")).body.length, 0);
    await request("/api/users/" + aId, "PUT", { active: true }, b);
    r = await request("/api/auth/login", "POST", {
      email: "a@example.com",
      password: account().password,
    });
    const resumed = r.cookie.split(";")[0];
    assert.equal(
      (
        await request(
          "/api/account",
          "PUT",
          { name: "Agent Updated", phone: "+234 809 876 5432" },
          resumed,
        )
      ).status,
      200,
    );
    assert.equal(
      (await request("/api/properties")).body[0].agent.phone,
      "2348098765432",
    );
    assert.equal(
      (await request("/api/properties/" + saved.id, "DELETE", null, resumed))
        .status,
      200,
    );
    assert.equal((await request("/api/properties")).body.length, 0);
    assert.equal(
      (await request("/api/leads", "GET", null, resumed)).body.length,
      1,
    );
    assert.equal(
      (await request("/api/properties?mine=1", "GET", null, resumed)).body[0]
        .archived,
      true,
    );
    assert.equal((await request("/api/leads", "POST", lead)).status, 400);
    assert.equal(
      (
        await request(
          "/api/properties/" + saved.id,
          "PUT",
          { ...property, archived: false },
          resumed,
        )
      ).status,
      200,
    );
    assert.equal((await request("/api/properties")).body.length, 1);
    await request("/api/auth/logout", "POST", {}, resumed);
    assert.equal(
      (await request("/api/leads", "GET", null, resumed)).status,
      401,
    );
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Homestead/);
  } finally {
    if (child?.exitCode === null) await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
