import { createEveeRequestContext, eveeCoordinatorAgent } from "@evee/agents";
import { auth } from "@evee/auth";
import { ensureWorkspaceForAuthUser, getWorkspaceForAuthUser } from "@evee/platform/db/workspaces";
import { z } from "zod";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(16_000),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to use Evee Copilot." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A message is required." }, { status: 400 });

  let workspace = await getWorkspaceForAuthUser(session.user.id);
  if (!workspace) {
    await ensureWorkspaceForAuthUser({ id: session.user.id, name: session.user.name });
    workspace = await getWorkspaceForAuthUser(session.user.id);
  }
  if (!workspace) return Response.json({ error: "Could not initialize your workspace." }, { status: 500 });

  const stream = await eveeCoordinatorAgent.stream(parsed.data.message, {
    abortSignal: request.signal,
    maxSteps: 8,
    memory: {
      resource: `workspace:${workspace.workspace.id}`,
      thread: `web:${workspace.workspace.id}:${session.user.id}`,
    },
    requestContext: createEveeRequestContext(workspace.runtimeUser.id),
  });

  // Mastra's stream is structurally compatible with the Web stream used by
  // Next.js, but it carries a different TypeScript stream declaration.
  const textStream = stream.textStream as unknown as ReadableStream<string>;
  const body = textStream.pipeThrough(new TextEncoderStream());

  return new Response(body as unknown as BodyInit, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
