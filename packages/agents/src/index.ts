import { Client, type ClientSession } from "eve/client";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@evee/platform/db/client";
import { copilotSessions } from "@evee/platform/db/schema";
import { signAgentCaller } from "@evee/platform/services/agent-auth";

export class CopilotBusyError extends Error {}

export async function streamCopilot(input: { workspaceId: string; authUserId: string; message: string; signal: AbortSignal }) {
  const where = and(eq(copilotSessions.workspaceId, input.workspaceId), eq(copilotSessions.authUserId, input.authUserId));
  await db.insert(copilotSessions).values({ workspaceId: input.workspaceId, authUserId: input.authUserId, createdAt: Date.now() }).onConflictDoNothing();
  const [claimed] = await db.update(copilotSessions).set({ busyUntil: Date.now() + 180_000 })
    .where(and(where, lt(copilotSessions.busyUntil, Date.now()))).returning();
  if (!claimed) throw new CopilotBusyError("Your previous Copilot request is still running.");

  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(120_000)]);
  const client = new Client({
    host: process.env.EVE_INTERNAL_URL ?? "http://localhost:4001",
    redirect: "error",
    headers: () => ({ Authorization: `Bearer ${signAgentCaller(input.authUserId, input.workspaceId)}` }),
  });
  let session: ClientSession;
  try {
    // Sessions expire after seven days. Retire the mapping before creating a
    // new one; old session IDs are then inaccessible through route auth.
    if (claimed.sessionId && claimed.createdAt > Date.now() - 7 * 24 * 60 * 60_000) {
      session = client.sessions.attach(claimed.sessionId, { streamIndex: claimed.streamIndex });
    } else {
      ({ session } = await client.sessions.create({ signal }));
      await db.update(copilotSessions).set({ sessionId: session.state.sessionId, streamIndex: 0, createdAt: Date.now() }).where(where);
    }
    const response = await session.send(input.message, { signal });
    const iterator = response[Symbol.asyncIterator]();
    let terminal = false;
    let failed = false;
    let finished = false;
    async function release() {
      if (finished) return;
      finished = true;
      await db.update(copilotSessions).set({
        busyUntil: 0,
        sessionId: terminal ? null : session.state.sessionId,
        streamIndex: session.state.streamIndex,
      }).where(where);
    }
    return new ReadableStream<string>({
      async pull(controller) {
        try {
          while (true) {
            const next = await iterator.next();
            if (next.done) {
              await release();
              if (failed) controller.error(new Error("The agent could not complete this turn. Please try again."));
              else controller.close();
              return;
            }
            const event = next.value;
            if (event.type === "session.completed" || event.type === "session.failed") terminal = true;
            // Consume the failure's boundary as well, so the saved cursor
            // cannot replay that failed turn on the next request.
            if (event.type === "session.failed" || event.type === "turn.failed") failed = true;
            if (event.type === "message.appended") { controller.enqueue(event.data.messageDelta); return; }
          }
        } catch (error) {
          // Cancellation stops server work, rather than only detaching HTTP.
          await response.cancel().catch(() => undefined);
          await release();
          controller.error(error);
        }
      },
      async cancel() {
        await response.cancel().catch(() => undefined);
        await iterator.return?.();
        await release();
      },
    });
  } catch (error) {
    await db.update(copilotSessions).set({ busyUntil: 0 }).where(where);
    throw error;
  }
}
