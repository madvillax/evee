import { CopilotBusyError, streamCopilot } from "@evee/agents";
import { auth, type AuthSession } from "@evee/auth";
import {
  listNewOpportunities,
  listOpportunitiesForUser,
} from "@evee/platform/db/repository";
import {
  ensureWorkspaceForAuthUser,
  getWorkspaceForAuthUser,
} from "@evee/platform/db/workspaces";
import { feedbackValueSchema } from "@evee/platform/domain/types";
import { recordOpportunityFeedback } from "@evee/platform/services/feedback";
import { monitorUser } from "@evee/platform/services/monitor";
import { createTelegramLink, disconnectTelegram, getTelegramConnection, telegramConfigured } from "@evee/platform/services/telegram";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

type WorkspaceContext = NonNullable<Awaited<ReturnType<typeof getWorkspaceForAuthUser>>>;

type ApiEnv = {
  Variables: {
    session: AuthSession;
    workspace: WorkspaceContext;
  };
};

const messageSchema = z.object({
  message: z.string().trim().min(1).max(16_000),
});

const feedbackSchema = z.object({
  opportunityId: z.string().uuid(),
  value: feedbackValueSchema.exclude(["rewrite"]),
  note: z.string().max(1_000).optional(),
});

const allowedOrigins = new Set(
  (process.env.WEB_ORIGINS ?? process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const requireWorkspace = createMiddleware<ApiEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new HTTPException(401, { message: "Sign in to continue." });

  let workspace = await getWorkspaceForAuthUser(session.user.id);
  if (!workspace) {
    await ensureWorkspaceForAuthUser({ id: session.user.id, name: session.user.name });
    workspace = await getWorkspaceForAuthUser(session.user.id);
  }
  if (!workspace) throw new HTTPException(500, { message: "Could not initialize your workspace." });

  c.set("session", session);
  c.set("workspace", workspace);
  await next();
});

export const app = new Hono<ApiEnv>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => (allowedOrigins.has(origin) ? origin : undefined),
    credentials: true,
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/api/health", (c) => c.json({
  ok: true,
  service: "evee-api",
  runtime: "node",
  timestamp: new Date().toISOString(),
}));

// Better Auth and Hono both use Web Request/Response, so no Node adapter is
// needed at this boundary. The Next.js app proxies this path in production.
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

const workspaceApi = new Hono<ApiEnv>();
workspaceApi.use("*", requireWorkspace);

workspaceApi.get("/workspace", (c) => {
  const session = c.get("session");
  const { workspace, runtimeUser, role } = c.get("workspace");
  return c.json({ session, workspace, runtimeUser, role });
});

workspaceApi.get("/telegram", async (c) => {
  const { workspace, role } = c.get("workspace");
  const connection = await getTelegramConnection(workspace.id);
  return c.json({ configured: telegramConfigured(), canManage: role === "owner" || role === "admin", connected: Boolean(connection), username: connection?.telegramUsername ?? null });
});

workspaceApi.post("/telegram/link", async (c) => {
  const { workspace, role } = c.get("workspace");
  if (role !== "owner" && role !== "admin") throw new HTTPException(403, { message: "An owner or admin must link Telegram." });
  if (!telegramConfigured()) throw new HTTPException(503, { message: "Telegram has not been configured on the server." });
  c.header("Cache-Control", "no-store");
  return c.json(await createTelegramLink(workspace.id, c.get("session").user.id));
});

workspaceApi.post("/telegram/disconnect", async (c) => {
  const { workspace, role } = c.get("workspace");
  if (role !== "owner" && role !== "admin") throw new HTTPException(403, { message: "An owner or admin must disconnect Telegram." });
  await disconnectTelegram(workspace.id);
  return c.json({ ok: true });
});

workspaceApi.get("/opportunities", async (c) => {
  const parsedLimit = z.coerce.number().int().min(1).max(100).safeParse(c.req.query("limit") ?? 50);
  if (!parsedLimit.success) throw new HTTPException(400, { message: "Limit must be between 1 and 100." });
  const { runtimeUser } = c.get("workspace");
  return c.json({ opportunities: await listOpportunitiesForUser(runtimeUser.id, parsedLimit.data) });
});

workspaceApi.post("/monitors/scan", async (c) => {
  const { runtimeUser } = c.get("workspace");
  const result = await monitorUser(runtimeUser.id);
  const opportunities = await listNewOpportunities(runtimeUser.id, runtimeUser.minScore, 8);
  return c.json({ result, opportunities });
});

workspaceApi.post("/feedback", async (c) => {
  const parsed = feedbackSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HTTPException(400, { message: "Valid opportunity feedback is required." });
  const { runtimeUser } = c.get("workspace");
  await recordOpportunityFeedback(runtimeUser.id, parsed.data.opportunityId, parsed.data.value, parsed.data.note);
  return c.json({ ok: true });
});

workspaceApi.post("/copilot", async (c) => {
  const parsed = messageSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HTTPException(400, { message: "A message is required." });

  const session = c.get("session");
  const { workspace } = c.get("workspace");
  const textStream = await streamCopilot({
    workspaceId: workspace.id,
    authUserId: session.user.id,
    message: parsed.data.message,
    signal: c.req.raw.signal,
  });
  return new Response(textStream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
});

app.route("/api", workspaceApi);

app.notFound((c) => c.json({ error: "Route not found." }, 404));

app.onError((error, c) => {
  if (error instanceof CopilotBusyError) return c.json({ error: error.message }, 409);
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error("Unhandled Evee API error", error);
  return c.json({ error: "The Evee API could not complete this request." }, 500);
});
