import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";

test("native Telegram webhook verifies secrets and scopes dispatch to a private link", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "evee-channel-test-"));
  process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "test.db")}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.TELEGRAM_BOT_TOKEN = "test-only-token";
  process.env.TELEGRAM_BOT_USERNAME = "evee_test_bot";
  process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = "test-webhook-secret";
  const { db, client } = await import("@evee/platform/db/client");
  const { authUsers } = await import("@evee/platform/db/schema");
  const { ensureWorkspaceForAuthUser } = await import("@evee/platform/db/workspaces");
  const { createTelegramLink, getTelegramConnection, disconnectTelegram } = await import("@evee/platform/services/telegram");
  const { default: telegram } = await import("../agent/channels/telegram");
  const route = telegram.routes.find((route) => route.transport !== "websocket")!;
  assert.ok(route.transport !== "websocket");
  const tasks: Promise<unknown>[] = [];
  const addresses: string[] = [];
  const replies: string[] = [];
  mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.match(String(url), /^https:\/\/api\.telegram\.org\//);
    const body = JSON.parse(String(options.body)) as { text: string };
    replies.push(body.text);
    return Response.json({ ok: true, result: { message_id: 99, chat: { id: 101, type: "private" } } });
  });
  const args = {
    waitUntil: (task: Promise<unknown>) => tasks.push(task),
    from: (address: string) => ({ send: async () => { addresses.push(address); return { id: "test-session" }; } }),
  } as unknown as Parameters<typeof route.handler>[1];
  async function message(text: string, type = "private", secret = "test-webhook-secret") {
    const response = await route.handler(new Request("http://localhost/eve/v1/telegram", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
      body: JSON.stringify({ update_id: 1, message: { message_id: 1, text, chat: { id: 101, type }, from: { id: 101, is_bot: false } } }),
    }), args);
    await Promise.all(tasks.splice(0));
    return response;
  }
  try {
    await migrate(db, { migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle") });
    assert.equal((await message("hello", "private", "wrong-secret")).status, 401);
    assert.equal(addresses.length, 0);
    assert.equal((await message("hello", "group")).status, 200);
    assert.equal(replies.length, 0);
    await message("hello");
    assert.match(replies.pop()!, /Link Telegram/);
    const id = crypto.randomUUID();
    await db.insert(authUsers).values({ id, name: "Test", email: `${id}@example.test`, createdAt: new Date(), updatedAt: new Date() });
    const workspace = await ensureWorkspaceForAuthUser({ id, name: "Test" });
    assert.ok(workspace);
    const link = await createTelegramLink(workspace.workspace.id, id);
    await message(`/start ${new URL(link.url).searchParams.get("start")}`);
    const connection = await getTelegramConnection(workspace.workspace.id);
    assert.ok(connection);
    await message("/digest");
    assert.equal(addresses.length, 1);
    assert.ok(addresses[0]!.endsWith(`:link:${connection.id}`));
    await disconnectTelegram(workspace.workspace.id);
    await message("/digest");
    assert.equal(addresses.length, 1);
  } finally { mock.restoreAll(); client.close(); await rm(dir, { recursive: true, force: true }); }
});
