import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { telegramConnections, telegramLinkCodes, users, workspaceMembers } from "../db/schema";

const hash = (code: string) => createHash("sha256").update(code).digest("hex");
export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN);
}
export async function getTelegramConnection(workspaceId: string) {
  return db.query.telegramConnections.findFirst({ where: eq(telegramConnections.workspaceId, workspaceId) });
}
export async function getTelegramCaller(telegramUserId: string, chatId: string) {
  const rows = await db.select({ connection: telegramConnections, user: users }).from(telegramConnections)
    .innerJoin(users, eq(users.id, telegramConnections.userId))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, telegramConnections.workspaceId), eq(workspaceMembers.userId, telegramConnections.authUserId)))
    .where(and(eq(telegramConnections.telegramUserId, telegramUserId), eq(telegramConnections.telegramChatId, chatId))).limit(1);
  return rows[0];
}
export async function createTelegramLink(workspaceId: string, authUserId: string) {
  if (!telegramConfigured()) throw new Error("Telegram has not been configured on the server.");
  const username = process.env.TELEGRAM_BOT_USERNAME!.replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) throw new Error("Set a valid TELEGRAM_BOT_USERNAME.");
  const code = randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + 10 * 60_000;
  await db.transaction(async (tx) => {
    await tx.delete(telegramLinkCodes).where(eq(telegramLinkCodes.workspaceId, workspaceId));
    await tx.insert(telegramLinkCodes).values({ id: crypto.randomUUID(), workspaceId, authUserId, codeHash: hash(code), expiresAt, createdAt: Date.now() });
  });
  return { url: `https://t.me/${username}?start=${code}`, expiresAt };
}
export async function consumeTelegramLink(code: string, telegramUserId: string, chatId: string, username?: string) {
  if (!/^[a-zA-Z0-9_-]{32}$/.test(code)) throw new Error("This link is invalid or expired. Create a new link in Evee Connections.");
  return db.transaction(async (tx) => {
    const [link] = await tx.update(telegramLinkCodes).set({ consumedAt: Date.now() })
      .where(and(eq(telegramLinkCodes.codeHash, hash(code)), isNull(telegramLinkCodes.consumedAt), gt(telegramLinkCodes.expiresAt, Date.now()))).returning();
    if (!link) throw new Error("This link is invalid or expired. Create a new link in Evee Connections.");
    const [member] = await tx.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, link.workspaceId), eq(workspaceMembers.userId, link.authUserId))).limit(1);
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("An owner or admin must link Telegram.");
    const [user] = await tx.select().from(users).where(eq(users.workspaceId, link.workspaceId)).limit(1);
    if (!user) throw new Error("The workspace could not be found.");
    const [existing] = await tx.select().from(telegramConnections).where(eq(telegramConnections.telegramUserId, telegramUserId)).limit(1);
    if (existing && existing.workspaceId !== link.workspaceId) throw new Error("Disconnect Telegram from your other workspace first.");
    // A new link identity also starts fresh bot history.
    await tx.delete(telegramConnections).where(eq(telegramConnections.workspaceId, link.workspaceId));
    await tx.insert(telegramConnections).values({ id: crypto.randomUUID(), workspaceId: link.workspaceId, userId: user.id, authUserId: link.authUserId, telegramUserId, telegramChatId: chatId, telegramUsername: username ?? null, linkedAt: Date.now() });
    return { workspaceId: link.workspaceId };
  });
}
export async function disconnectTelegram(workspaceId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(telegramConnections).where(eq(telegramConnections.workspaceId, workspaceId));
    await tx.delete(telegramLinkCodes).where(eq(telegramLinkCodes.workspaceId, workspaceId));
  });
}
