import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";

// Every test process imports the platform only after selecting a throwaway DB.
test("Telegram linking isolates workspaces and survives the full migration history", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "evee-telegram-test-"));
  process.env.TURSO_DATABASE_URL = `file:${path.join(directory, "test.db")}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.TELEGRAM_BOT_TOKEN = "test-only-token";
  process.env.TELEGRAM_BOT_USERNAME = "evee_test_bot";
  process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = "test-only-webhook-secret";
  const { db, client } = await import("../src/db/client");
  const { authUsers, telegramLinkCodes, workspaceMembers } = await import("../src/db/schema");
  const { ensureWorkspaceForAuthUser } = await import("../src/db/workspaces");
  const { createTelegramLink, consumeTelegramLink, getTelegramCaller, getTelegramConnection, disconnectTelegram } = await import("../src/services/telegram");
  try {
    await migrate(db, { migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle") });
    async function account(name: string) {
      const id = crypto.randomUUID();
      await db.insert(authUsers).values({ id, name, email: `${id}@example.test`, createdAt: new Date(), updatedAt: new Date() });
      const context = await ensureWorkspaceForAuthUser({ id, name });
      assert.ok(context);
      return { id, workspaceId: context.workspace.id };
    }
    const a = await account("Workspace A");
    const b = await account("Workspace B");
    const link = await createTelegramLink(a.workspaceId, a.id);
    const code = new URL(link.url).searchParams.get("start")!;
    const stored = await db.query.telegramLinkCodes.findFirst();
    assert.notEqual(stored?.codeHash, code);
    await consumeTelegramLink(code, "101", "101", "tester");
    assert.equal((await getTelegramCaller("101", "101"))?.connection.workspaceId, a.workspaceId);
    assert.equal(await getTelegramCaller("101", "different-chat"), undefined);
    await assert.rejects(() => consumeTelegramLink(code, "102", "102"), /invalid or expired/);
    const other = await createTelegramLink(b.workspaceId, b.id);
    await assert.rejects(() => consumeTelegramLink(new URL(other.url).searchParams.get("start")!, "101", "101"), /other workspace/);
    assert.equal(await getTelegramConnection(b.workspaceId), undefined);
    const oldId = (await getTelegramConnection(a.workspaceId))!.id;
    const relink = await createTelegramLink(a.workspaceId, a.id);
    await consumeTelegramLink(new URL(relink.url).searchParams.get("start")!, "101", "101");
    assert.notEqual((await getTelegramConnection(a.workspaceId))!.id, oldId);
    const expired = await createTelegramLink(a.workspaceId, a.id);
    await db.update(telegramLinkCodes).set({ expiresAt: Date.now() - 1 });
    await assert.rejects(() => consumeTelegramLink(new URL(expired.url).searchParams.get("start")!, "101", "101"), /invalid or expired/);
    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, a.id));
    assert.equal(await getTelegramCaller("101", "101"), undefined);
    await disconnectTelegram(a.workspaceId);
    assert.equal(await getTelegramConnection(a.workspaceId), undefined);
    assert.equal((await db.select().from(telegramLinkCodes).where(eq(telegramLinkCodes.workspaceId, a.workspaceId))).length, 0);
  } finally { client.close(); await rm(directory, { recursive: true, force: true }); }
});
