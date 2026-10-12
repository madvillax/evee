import type { SessionContext } from "eve/context";
import { getWorkspaceForAuthUser } from "@evee/platform/db/workspaces";
import { getTelegramCaller } from "@evee/platform/services/telegram";

export async function getRuntimeUserId(ctx: SessionContext) {
  const caller = ctx.session.auth.current;
  if (!caller || caller.principalType !== "user") throw new Error("A signed-in workspace is required.");
  const workspace = await getWorkspaceForAuthUser(caller.principalId);
  if (!workspace || workspace.workspace.id !== caller.attributes.workspaceId) throw new Error("Workspace access is no longer available.");
  if (caller.authenticator === "evee-telegram") {
    const { telegramUserId, telegramChatId, connectionId } = caller.attributes;
    if (typeof telegramUserId !== "string" || typeof telegramChatId !== "string") throw new Error("Link Telegram from Evee Connections.");
    const linked = await getTelegramCaller(telegramUserId, telegramChatId);
    if (linked?.connection.id !== connectionId) throw new Error("Telegram has been disconnected.");
  } else if (caller.authenticator !== "evee-web") { throw new Error("An Evee caller is required."); }
  return workspace.runtimeUser.id;
}
