import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";

const directory = await mkdtemp(path.join(os.tmpdir(), "evee-api-test-"));
process.env.TURSO_DATABASE_URL = `file:${path.join(directory, "test.db")}`;
process.env.TURSO_AUTH_TOKEN = "";
process.env.BETTER_AUTH_URL = "http://localhost:3001";
process.env.BETTER_AUTH_SECRET = "test-only-auth-secret-for-web-only-regressions";
const { db, client } = await import("@evee/platform/db/client");
const { app } = await import("../src/app");
await migrate(db, { migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle") });
after(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

test("health identifies the Node Hono API", async () => {
  const response = await app.request("/api/health");
  assert.equal(response.status, 200);
  const body = await response.json() as { ok: boolean; runtime: string; service: string };
  assert.deepEqual(
    { ok: body.ok, runtime: body.runtime, service: body.service },
    { ok: true, runtime: "node", service: "evee-api" },
  );
});

test("workspace routes reject unauthenticated requests", async () => {
  const response = await app.request("/api/opportunities");
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Sign in to continue." });
});


test("web sign-up and workspace access work without any Telegram API", async () => {
  const signup = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
    body: JSON.stringify({ name: "Web user", email: `${crypto.randomUUID()}@example.test`, password: "test-only-password-123" }),
  });
  assert.equal(signup.status, 200);
  const cookie = signup.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const headers = { Cookie: cookie };
  assert.equal((await app.request("/api/workspace", { headers })).status, 200);
  for (const [method, endpoint] of [["GET", ""], ["POST", "/link"], ["POST", "/disconnect"]] as const) {
    const response = await app.request(`/api/telegram${endpoint}`, { method, headers });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Route not found." });
  }
});
