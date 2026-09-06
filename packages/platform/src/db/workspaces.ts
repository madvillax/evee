import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "./client";
import {
  agentConfigs,
  feedback,
  integrations,
  monitorRuns,
  opportunities,
  profiles,
  sources,
  subscriptions,
  users,
  workspaceMembers,
  workspaces,
} from "./schema";

const now = () => Date.now();
const id = () => crypto.randomUUID();

function slugify(value: string) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function ensureWorkspaceForAuthUser(authUser: { id: string; name: string }) {
  const membership = await db.select({ workspace: workspaces, runtimeUser: users })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .leftJoin(users, eq(users.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, authUser.id))
    .limit(1);
  if (membership[0]?.runtimeUser) return membership[0];

  const timestamp = now();
  const workspaceId = membership[0]?.workspace.id ?? id();
  if (!membership[0]) {
    await db.insert(workspaces).values({
      id: workspaceId,
      name: `${authUser.name}'s workspace`,
      slug: slugify(authUser.name),
      ownerId: authUser.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await db.insert(workspaceMembers).values({ workspaceId, userId: authUser.id, role: "owner", createdAt: timestamp });
  }

  const runtimeUserId = id();
  await db.insert(users).values({
    id: runtimeUserId,
    workspaceId,
    authUserId: authUser.id,
    legacyIdentityKey: `web:${authUser.id}`,
    legacyDestinationKey: `web:${authUser.id}`,
    firstName: authUser.name,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.insert(subscriptions).values({
    id: id(), workspaceId, status: "trialing", plan: "starter", createdAt: timestamp, updatedAt: timestamp,
  }).onConflictDoNothing();

  const integrationTypes = ["reddit", "github", "hackernews", "rss", "slack", "email", "x"] as const;
  await db.insert(integrations).values(integrationTypes.map((type) => ({
    id: id(),
    workspaceId,
    type,
    displayName: type === "hackernews" ? "Hacker News" : type === "x" ? "X" : `${type[0]!.toUpperCase()}${type.slice(1)}`,
    status: (["reddit", "github", "hackernews", "rss"] as const).includes(type as "reddit") ? "connected" as const : "disconnected" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))).onConflictDoNothing();

  await db.insert(agentConfigs).values({
    id: id(), workspaceId, name: "GTM Copilot", description: "Researches demand, prioritizes opportunities, and drafts useful replies.",
    instructions: "Use the workspace profile and feedback. Prefer explicit need, explain evidence, and never post without approval.",
    createdAt: timestamp, updatedAt: timestamp,
  });

  return getWorkspaceForAuthUser(authUser.id);
}

export async function getWorkspaceForAuthUser(authUserId: string) {
  const rows = await db.select({ workspace: workspaces, runtimeUser: users, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .innerJoin(users, eq(users.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, authUserId))
    .limit(1);
  return rows[0];
}

export async function getWorkspaceDashboard(runtimeUserId: string) {
  const since = now() - 7 * 24 * 60 * 60 * 1_000;
  const [opportunityRows, monitorRows, recentRuns] = await Promise.all([
    db.select({
      total: sql<number>`count(*)`,
      averageScore: sql<number>`coalesce(avg(${opportunities.score}), 0)`,
      replied: sql<number>`sum(case when ${opportunities.status} = 'replied' then 1 else 0 end)`,
    }).from(opportunities).where(and(eq(opportunities.userId, runtimeUserId), gt(opportunities.createdAt, since))),
    db.select({ active: sql<number>`count(*)` }).from(sources)
      .where(and(eq(sources.userId, runtimeUserId), eq(sources.enabled, true))),
    db.select().from(monitorRuns).where(eq(monitorRuns.userId, runtimeUserId))
      .orderBy(desc(monitorRuns.startedAt)).limit(6),
  ]);
  const opportunityStats = opportunityRows[0];
  const monitorStats = monitorRows[0];
  return {
    opportunities: Number(opportunityStats?.total ?? 0),
    averageScore: Math.round(Number(opportunityStats?.averageScore ?? 0)),
    replied: Number(opportunityStats?.replied ?? 0),
    activeMonitors: Number(monitorStats?.active ?? 0),
    recentRuns,
  };
}

export async function listWorkspaceIntegrations(workspaceId: string) {
  return db.select().from(integrations).where(eq(integrations.workspaceId, workspaceId));
}

export async function listWorkspaceAgents(workspaceId: string) {
  return db.select().from(agentConfigs).where(eq(agentConfigs.workspaceId, workspaceId));
}

export async function getWorkspaceSubscription(workspaceId: string) {
  return db.query.subscriptions.findFirst({ where: eq(subscriptions.workspaceId, workspaceId) });
}
