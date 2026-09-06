import assert from "node:assert/strict";
import { test } from "node:test";
import { app } from "../src/app";

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
