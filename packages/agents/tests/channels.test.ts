import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import type { SessionContext } from "eve/context";

test("Copilot accepts current web members and rejects legacy bot callers", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "evee-channel-test-"));
  process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "test.db")}`;
  process.env.TURSO_AUTH_TOKEN = "";
  const { db, client } = await import("@evee/platform/db/client");
  const { authUsers, telegramConnections, workspaceMembers } = await import("@evee/platform/db/schema");
  const { ensureWorkspaceForAuthUser } = await import("@evee/platform/db/workspaces");
  const { getRuntimeUserId } = await import("../src/context");
  try {
    await migrate(db, { migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle") });
    const id = crypto.randomUUID();
    await db.insert(authUsers).values({ id, name: "Test", email: `${id}@example.test`, createdAt: new Date(), updatedAt: new Date() });
    const workspace = await ensureWorkspaceForAuthUser({ id, name: "Test" });
    assert.ok(workspace);
    const connectionId = crypto.randomUUID();
    await db.insert(telegramConnections).values({
      id: connectionId, workspaceId: workspace.workspace.id, userId: workspace.runtimeUser.id,
      authUserId: id, telegramUserId: "101", telegramChatId: "101", linkedAt: Date.now(),
    });
    const context = (authenticator: string, workspaceId = workspace.workspace.id) => ({
      session: { auth: { current: {
        authenticator, principalType: "user", principalId: id,
        attributes: { workspaceId, connectionId, telegramUserId: "101", telegramChatId: "101" },
      } } },
    }) as unknown as SessionContext;

    assert.equal(await getRuntimeUserId(context("evee-web")), workspace.runtimeUser.id);
    await assert.rejects(() => getRuntimeUserId(context("evee-telegram")), /web/i);
    await assert.rejects(() => getRuntimeUserId(context("other")), /web/i);
    await assert.rejects(() => getRuntimeUserId(context("evee-web", "another-workspace")), /Workspace access/);
    await assert.rejects(() => getRuntimeUserId({ session: { auth: { current: null } } } as unknown as SessionContext), /signed-in/i);

    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, id));
    await assert.rejects(() => getRuntimeUserId(context("evee-web")), /Workspace access/);
  } finally {
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
});
