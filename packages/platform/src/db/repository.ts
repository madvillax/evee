import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Candidate, FeedbackValue, OpportunityAnalysis, Profile, ProfileInput, StoredOpportunity } from "../domain/types";
import { db } from "./client";
import { conversations, discordConnections, feedback, monitorRuns, opportunities, profiles, scheduledRunClaims, sources, userDigests, users } from "./schema";

const now = () => Date.now();
const id = () => crypto.randomUUID();

export type UserRow = typeof users.$inferSelect;
export type SourceRow = typeof sources.$inferSelect;

export async function getUserForDiscordInteraction(input: {
  discordUserId: string;
  discordGuildId: string;
  discordChannelId: string;
}): Promise<UserRow | undefined> {
  const linked = await db.select({ user: users })
    .from(discordConnections)
    .innerJoin(users, eq(discordConnections.userId, users.id))
    .where(and(
      eq(discordConnections.discordUserId, input.discordUserId),
      eq(discordConnections.discordGuildId, input.discordGuildId),
      eq(discordConnections.discordChannelId, input.discordChannelId),
    ))
    .limit(1);
  return linked[0]?.user;
}

export async function getUser(userId: string) {
  return db.query.users.findFirst({ where: eq(users.id, userId) });
}

export async function listActiveUsers() {
  return db.select({ user: users }).from(users)
    .innerJoin(discordConnections, eq(discordConnections.userId, users.id))
    .where(eq(users.alertsEnabled, true))
    .then((rows) => rows.map((row) => row.user));
}

/**
 * Atomically claim a scheduled unit of work. The composite key prevents a
 * deploy overlap or scheduler replay from scanning/notifying the same user in
 * the same time bucket twice.
 */
export async function claimScheduledRun(kind: "monitor" | "digest", userId: string, bucket: number) {
  const inserted = await db.insert(scheduledRunClaims)
    .values({ kind, userId, bucket, claimedAt: now() })
    .onConflictDoNothing()
    .returning({ userId: scheduledRunClaims.userId });
  return inserted.length === 1;
}

export async function releaseScheduledRun(kind: "monitor" | "digest", userId: string, bucket: number) {
  await db.delete(scheduledRunClaims).where(and(
    eq(scheduledRunClaims.kind, kind),
    eq(scheduledRunClaims.userId, userId),
    eq(scheduledRunClaims.bucket, bucket),
  ));
}

export async function setOnboarding(userId: string, step: string, data: Record<string, unknown>) {
  await db.update(users).set({ onboardingStep: step, onboardingData: data, updatedAt: now() }).where(eq(users.id, userId));
}

export async function updateUserPreferences(
  userId: string,
  values: Partial<Pick<UserRow, "alertsEnabled" | "digestHour" | "timezone" | "minScore" | "lastDigestAt">>,
) {
  await db.update(users).set({ ...values, updatedAt: now() }).where(eq(users.id, userId));
}

function profileFromRow(row: typeof profiles.$inferSelect): Profile {
  return {
    id: row.id,
    userId: row.userId,
    productName: row.productName,
    ...(row.productUrl ? { productUrl: row.productUrl } : {}),
    productSummary: row.productSummary,
    targetCustomers: row.targetCustomers,
    painPoints: row.painPoints,
    competitors: row.competitors,
    replyStyle: row.replyStyle,
    keywords: row.keywords,
    exclusions: row.exclusions,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getProfile(userId: string): Promise<Profile | undefined> {
  const row = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  return row ? profileFromRow(row) : undefined;
}

export async function saveProfile(userId: string, input: ProfileInput): Promise<Profile> {
  const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  const timestamp = now();
  if (existing) {
    await db.update(profiles).set({ ...input, productUrl: input.productUrl ?? null, version: existing.version + 1, updatedAt: timestamp })
      .where(eq(profiles.id, existing.id));
    return (await getProfile(userId))!;
  }
  await db.insert(profiles).values({ id: id(), userId, ...input, productUrl: input.productUrl ?? null, createdAt: timestamp, updatedAt: timestamp });
  return (await getProfile(userId))!;
}

export async function provisionDefaultSources(userId: string, rssFeeds: string[] = []) {
  const existing = await db.select().from(sources).where(eq(sources.userId, userId));
  const existingNames = new Set(existing.map((source) => `${source.type}:${source.name}`));
  const timestamp = now();
  const defaults: Array<typeof sources.$inferInsert> = [
    { id: id(), userId, type: "reddit", name: "Reddit", config: {}, createdAt: timestamp, updatedAt: timestamp },
    { id: id(), userId, type: "hackernews", name: "Hacker News", config: {}, createdAt: timestamp, updatedAt: timestamp },
    { id: id(), userId, type: "github", name: "GitHub discussions and issues", config: {}, createdAt: timestamp, updatedAt: timestamp },
    ...rssFeeds.map((url) => ({ id: id(), userId, type: "rss" as const, name: url, config: { url }, createdAt: timestamp, updatedAt: timestamp })),
  ];
  const missing = defaults.filter((source) => !existingNames.has(`${source.type}:${source.name}`));
  if (missing.length) await db.insert(sources).values(missing);
}

export async function getEnabledSources(userId: string) {
  return db.select().from(sources).where(and(eq(sources.userId, userId), eq(sources.enabled, true)));
}

export async function listSourcesForUser(userId: string) {
  return db.select().from(sources).where(eq(sources.userId, userId)).orderBy(desc(sources.updatedAt));
}

export async function createMonitor(input: {
  userId: string;
  type: SourceRow["type"];
  name: string;
  config: Record<string, unknown>;
}) {
  const timestamp = now();
  const row: typeof sources.$inferInsert = {
    id: id(), userId: input.userId, type: input.type, name: input.name, config: input.config,
    enabled: true, createdAt: timestamp, updatedAt: timestamp,
  };
  await db.insert(sources).values(row);
  return row;
}

export async function setMonitorEnabled(userId: string, sourceId: string, enabled: boolean) {
  await db.update(sources).set({ enabled, updatedAt: now() })
    .where(and(eq(sources.id, sourceId), eq(sources.userId, userId)));
}

export async function markSourceChecked(sourceId: string) {
  await db.update(sources).set({ lastCheckedAt: now(), updatedAt: now() }).where(eq(sources.id, sourceId));
}

export async function storeCandidate(candidate: Candidate) {
  const conversationId = id();
  await db.insert(conversations).values({
    id: conversationId,
    ...candidate,
    author: candidate.author ?? null,
    publishedAt: candidate.publishedAt ?? null,
    createdAt: now(),
  }).onConflictDoNothing({ target: [conversations.source, conversations.externalId] });
  return (await db.query.conversations.findFirst({
    where: and(eq(conversations.source, candidate.source), eq(conversations.externalId, candidate.externalId)),
  }))!;
}

export async function hasOpportunity(userId: string, conversationId: string) {
  return Boolean(await db.query.opportunities.findFirst({
    where: and(eq(opportunities.userId, userId), eq(opportunities.conversationId, conversationId)),
  }));
}

export async function storeOpportunity(userId: string, conversationId: string, analysis: OpportunityAnalysis) {
  const opportunityId = id();
  const timestamp = now();
  await db.insert(opportunities).values({
    id: opportunityId,
    userId,
    conversationId,
    ...analysis,
    confidence: Math.round(analysis.confidence * 10_000),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).onConflictDoNothing({ target: [opportunities.userId, opportunities.conversationId] });
  return db.query.opportunities.findFirst({
    where: and(eq(opportunities.userId, userId), eq(opportunities.conversationId, conversationId)),
  });
}

function storedOpportunity(row: typeof opportunities.$inferSelect, candidate: typeof conversations.$inferSelect): StoredOpportunity {
  return {
    id: row.id,
    userId: row.userId,
    relevant: row.relevant,
    score: row.score,
    intentScore: row.intentScore,
    fitScore: row.fitScore,
    urgencyScore: row.urgencyScore,
    specificityScore: row.specificityScore,
    replySafetyScore: row.replySafetyScore,
    confidence: row.confidence / 10_000,
    reason: row.reason,
    signals: row.signals,
    risks: row.risks,
    replyDraft: row.replyDraft,
    status: row.status,
    createdAt: row.createdAt,
    candidate: {
      source: candidate.source,
      externalId: candidate.externalId,
      url: candidate.url,
      title: candidate.title,
      body: candidate.body,
      ...(candidate.author ? { author: candidate.author } : {}),
      ...(candidate.publishedAt ? { publishedAt: candidate.publishedAt } : {}),
      metadata: candidate.metadata,
    },
  };
}

export async function getOpportunity(opportunityId: string): Promise<StoredOpportunity | undefined> {
  const rows = await db.select().from(opportunities).innerJoin(conversations, eq(opportunities.conversationId, conversations.id))
    .where(eq(opportunities.id, opportunityId)).limit(1);
  const row = rows[0];
  return row ? storedOpportunity(row.opportunities, row.conversations) : undefined;
}

export async function getUnalertedOpportunities(userId: string, minScore: number, limit = 10) {
  const rows = await db.select().from(opportunities).innerJoin(conversations, eq(opportunities.conversationId, conversations.id))
    .where(and(eq(opportunities.userId, userId), eq(opportunities.relevant, true), gt(opportunities.score, minScore - 1), isNull(opportunities.alertedAt)))
    .orderBy(desc(opportunities.score), desc(opportunities.createdAt)).limit(limit);
  return rows.map((row) => storedOpportunity(row.opportunities, row.conversations));
}

export async function listOpportunitiesForUser(userId: string, limit = 50) {
  const rows = await db.select().from(opportunities).innerJoin(conversations, eq(opportunities.conversationId, conversations.id))
    .where(eq(opportunities.userId, userId))
    .orderBy(desc(opportunities.createdAt), desc(opportunities.score)).limit(limit);
  return rows.map((row) => storedOpportunity(row.opportunities, row.conversations));
}

export async function listOpportunityAnalyticsForUser(userId: string, limit = 500) {
  return db.select({
    source: conversations.source,
    score: opportunities.score,
    status: opportunities.status,
    createdAt: opportunities.createdAt,
  }).from(opportunities)
    .innerJoin(conversations, eq(opportunities.conversationId, conversations.id))
    .where(eq(opportunities.userId, userId))
    .orderBy(desc(opportunities.createdAt), desc(opportunities.score))
    .limit(limit);
}

export async function markAlerted(opportunityId: string) {
  await db.update(opportunities).set({ alertedAt: now(), status: "sent", updatedAt: now() }).where(eq(opportunities.id, opportunityId));
}

export async function updateOpportunity(
  opportunityId: string,
  values: Partial<Pick<typeof opportunities.$inferSelect, "status" | "replyDraft">>,
) {
  await db.update(opportunities).set({ ...values, updatedAt: now() }).where(eq(opportunities.id, opportunityId));
}

export async function saveFeedback(input: {
  userId: string;
  opportunityId: string;
  value: FeedbackValue;
  note?: string;
  editedDraft?: string;
}) {
  await db.insert(feedback).values({ id: id(), ...input, createdAt: now() });
}

export async function getRecentFeedback(userId: string, limit = 20) {
  return db.select({
    value: feedback.value,
    note: feedback.note,
    editedDraft: feedback.editedDraft,
    title: conversations.title,
    replyDraft: opportunities.replyDraft,
  }).from(feedback)
    .innerJoin(opportunities, eq(feedback.opportunityId, opportunities.id))
    .innerJoin(conversations, eq(opportunities.conversationId, conversations.id))
    .where(eq(feedback.userId, userId)).orderBy(desc(feedback.createdAt)).limit(limit);
}

export async function listDigestOpportunities(userId: string, since: number, limit = 8) {
  const alreadySent = db.select({ id: userDigests.opportunityId }).from(userDigests).where(eq(userDigests.userId, userId));
  const rows = await db.select().from(opportunities).innerJoin(conversations, eq(opportunities.conversationId, conversations.id))
    .where(and(eq(opportunities.userId, userId), eq(opportunities.relevant, true), gt(opportunities.createdAt, since), sql`${opportunities.id} not in ${alreadySent}`))
    .orderBy(desc(opportunities.score)).limit(limit);
  return rows.map((row) => storedOpportunity(row.opportunities, row.conversations));
}

export async function markDigestSent(userId: string, opportunityIds: string[]) {
  if (!opportunityIds.length) return;
  const timestamp = now();
  await db.insert(userDigests).values(opportunityIds.map((opportunityId) => ({ userId, opportunityId, sentAt: timestamp }))).onConflictDoNothing();
  await updateUserPreferences(userId, { lastDigestAt: timestamp });
}

export async function beginMonitorRun(userId: string) {
  const runId = id();
  await db.insert(monitorRuns).values({ id: runId, userId, status: "running", startedAt: now() });
  return runId;
}

export async function finishMonitorRun(runId: string, result: {
  sourcesChecked: number;
  candidatesFound: number;
  opportunitiesCreated: number;
  error?: string;
}) {
  await db.update(monitorRuns).set({
    status: result.error ? "failed" : "completed",
    ...result,
    finishedAt: now(),
  }).where(eq(monitorRuns.id, runId));
}
