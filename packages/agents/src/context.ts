import type { SessionContext } from "eve/context";
import { getWorkspaceForAuthUser } from "@evee/platform/db/workspaces";

export async function getRuntimeUserId(ctx: SessionContext) {
  const caller = ctx.session.auth.current;
  if (!caller || caller.principalType !== "user") throw new Error("A signed-in workspace is required.");
  if (caller.authenticator !== "evee-web") throw new Error("An authenticated Evee web caller is required.");
  const workspace = await getWorkspaceForAuthUser(caller.principalId);
  if (!workspace || workspace.workspace.id !== caller.attributes.workspaceId) throw new Error("Workspace access is no longer available.");
  return workspace.runtimeUser.id;
}
