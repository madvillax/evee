import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const authUsers = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const authSessions = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_id_idx").on(table.userId)]);

export const authAccounts = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("account_user_id_idx").on(table.userId)]);

export const authVerifications = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  plan: text("plan", { enum: ["starter", "growth", "scale"] }).notNull().default("starter"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const workspaceMembers = sqliteTable("workspace_members", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member", "viewer"] }).notNull().default("member"),
  createdAt: integer("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  authUserId: text("auth_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  telegramChatId: text("telegram_chat_id").notNull(),
  firstName: text("first_name"),
  username: text("username"),
  timezone: text("timezone").notNull().default("UTC"),
  digestHour: integer("digest_hour").notNull().default(9),
  minScore: integer("min_score").notNull().default(65),
  alertsEnabled: integer("alerts_enabled", { mode: "boolean" }).notNull().default(true),
  onboardingStep: text("onboarding_step").notNull().default("product_name"),
  onboardingData: text("onboarding_data", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  lastDigestAt: integer("last_digest_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("users_workspace_id_unique").on(table.workspaceId)]);

export const telegramConnections = sqliteTable("telegram_connections", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authUserId: text("auth_user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  telegramChatId: text("telegram_chat_id").notNull(),
  telegramUsername: text("telegram_username"),
  firstName: text("first_name"),
  linkedAt: integer("linked_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("telegram_connections_workspace_unique").on(table.workspaceId)]);

export const telegramLinkCodes = sqliteTable("telegram_link_codes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  authUserId: text("auth_user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("telegram_link_codes_workspace_idx").on(table.workspaceId)]);

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["reddit", "github", "hackernews", "rss", "telegram", "slack", "email", "x"] }).notNull(),
  status: text("status", { enum: ["connected", "needs_attention", "disconnected"] }).notNull().default("disconnected"),
  displayName: text("display_name").notNull(),
  externalAccountId: text("external_account_id"),
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("integrations_workspace_type_unique").on(table.workspaceId, table.type)]);

export const agentConfigs = sqliteTable("agent_configs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(),
  model: text("model").notNull().default("gemini-2.5-flash"),
  status: text("status", { enum: ["active", "paused"] }).notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("agent_configs_workspace_idx").on(table.workspaceId)]);

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }).unique(),
  provider: text("provider").notNull().default("manual"),
  externalCustomerId: text("external_customer_id"),
  externalSubscriptionId: text("external_subscription_id"),
  status: text("status", { enum: ["trialing", "active", "past_due", "canceled"] }).notNull().default("trialing"),
  plan: text("plan", { enum: ["starter", "growth", "scale"] }).notNull().default("starter"),
  currentPeriodEnd: integer("current_period_end"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  productUrl: text("product_url"),
  productSummary: text("product_summary").notNull(),
  targetCustomers: text("target_customers", { mode: "json" }).$type<string[]>().notNull(),
  painPoints: text("pain_points", { mode: "json" }).$type<string[]>().notNull(),
  competitors: text("competitors", { mode: "json" }).$type<string[]>().notNull(),
  replyStyle: text("reply_style").notNull(),
  keywords: text("keywords", { mode: "json" }).$type<string[]>().notNull(),
  exclusions: text("exclusions", { mode: "json" }).$type<string[]>().notNull(),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("profiles_user_id_unique").on(table.userId)]);

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["reddit", "hackernews", "github", "rss"] }).notNull(),
  name: text("name").notNull(),
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastCheckedAt: integer("last_checked_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("sources_user_id_idx").on(table.userId)]);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  source: text("source", { enum: ["reddit", "hackernews", "github", "rss"] }).notNull(),
  externalId: text("external_id").notNull(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  author: text("author"),
  publishedAt: integer("published_at"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("conversations_source_external_unique").on(table.source, table.externalId)]);

export const opportunities = sqliteTable("opportunities", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  relevant: integer("relevant", { mode: "boolean" }).notNull(),
  score: integer("score").notNull(),
  intentScore: integer("intent_score").notNull(),
  fitScore: integer("fit_score").notNull(),
  urgencyScore: integer("urgency_score").notNull(),
  specificityScore: integer("specificity_score").notNull(),
  replySafetyScore: integer("reply_safety_score").notNull(),
  confidence: integer("confidence_basis_points").notNull(),
  reason: text("reason").notNull(),
  signals: text("signals", { mode: "json" }).$type<string[]>().notNull(),
  risks: text("risks", { mode: "json" }).$type<string[]>().notNull(),
  replyDraft: text("reply_draft").notNull(),
  status: text("status", { enum: ["new", "sent", "saved", "dismissed", "replied"] }).notNull().default("new"),
  alertedAt: integer("alerted_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("opportunities_user_conversation_unique").on(table.userId, table.conversationId),
  index("opportunities_user_score_idx").on(table.userId, table.score),
]);

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  value: text("value", { enum: ["good", "bad", "dismiss", "replied", "rewrite"] }).notNull(),
  note: text("note"),
  editedDraft: text("edited_draft"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("feedback_user_id_idx").on(table.userId)]);

export const monitorRuns = sqliteTable("monitor_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
  sourcesChecked: integer("sources_checked").notNull().default(0),
  candidatesFound: integer("candidates_found").notNull().default(0),
  opportunitiesCreated: integer("opportunities_created").notNull().default(0),
  error: text("error"),
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
});

// A scheduled workflow claims a user and time bucket before performing work.
// This makes retries safe if the scheduler is restarted or more than one worker
// is temporarily alive during a deployment.
export const scheduledRunClaims = sqliteTable("scheduled_run_claims", {
  kind: text("kind").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bucket: integer("bucket").notNull(),
  claimedAt: integer("claimed_at").notNull(),
}, (table) => [primaryKey({ columns: [table.kind, table.userId, table.bucket] })]);

export const userDigests = sqliteTable("user_digests", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  sentAt: integer("sent_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.opportunityId] })]);
