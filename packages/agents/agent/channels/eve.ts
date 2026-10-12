import { eveChannel } from "eve/channels/eve";
import { and, eq } from "drizzle-orm";
import { db } from "@evee/platform/db/client";
import { copilotSessions } from "@evee/platform/db/schema";
import { getWorkspaceForAuthUser } from "@evee/platform/db/workspaces";
import { verifyAgentCaller } from "@evee/platform/services/agent-auth";

export default eveChannel({
  auth: async (request) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return null;
    const caller = verifyAgentCaller(token);
    if (!caller) return null;
    const workspace = await getWorkspaceForAuthUser(caller.authUserId);
    if (workspace?.workspace.id !== caller.workspaceId) return null;
    // Eve route auth does not enforce ownership; enforce it on streams,
    // continuation messages, and controls before admitting this principal.
    const sessionId = new URL(request.url).pathname.match(/\/session\/([^/]+)/)?.[1];
    if (sessionId) {
      const row = await db.query.copilotSessions.findFirst({ where: and(
        eq(copilotSessions.sessionId, sessionId),
        eq(copilotSessions.workspaceId, caller.workspaceId),
        eq(copilotSessions.authUserId, caller.authUserId),
      ) });
      if (!row) return null;
    }
    return { authenticator: "evee-web", principalType: "user", principalId: caller.authUserId, attributes: { workspaceId: caller.workspaceId } };
  },
});
