import { createTool } from "@mastra/core/tools";
import {
  createMonitor,
  getProfile,
  getUnalertedOpportunities,
  getUser,
  listOpportunitiesForUser,
  updateUserPreferences,
} from "@evee/platform/db/repository";
import { feedbackValueSchema, sourceTypeSchema } from "@evee/platform/domain/types";
import { recordOpportunityFeedback, rewriteOpportunity } from "@evee/platform/services/feedback";
import { monitorUser } from "@evee/platform/services/monitor";
import { z } from "zod";

const requestContextSchema = z.object({
  runtimeUserId: z.string().uuid(),
});

type EveeRequestContext = z.infer<typeof requestContextSchema>;

function runtimeUserId(context: { requestContext: { get: (key: "runtimeUserId") => string | undefined } }) {
  const userId = context.requestContext.get("runtimeUserId");
  if (!userId) throw new Error("A signed-in workspace is required.");
  return userId;
}

export const createMonitorTool = createTool({
  id: "create-monitor",
  description: "Create a focused workspace monitor after translating the user's natural-language monitoring goal into a source and query configuration.",
  inputSchema: z.object({
    type: sourceTypeSchema,
    name: z.string().min(2).max(80),
    query: z.string().min(2).max(500),
    communities: z.array(z.string().min(1)).max(20).default([]),
    exclusions: z.array(z.string().min(1)).max(20).default([]),
  }),
  requestContextSchema,
  execute: async (input, context) => {
    const userId = runtimeUserId(context);
    return createMonitor({
      userId,
      type: input.type,
      name: input.name,
      config: { query: input.query, communities: input.communities, exclusions: input.exclusions },
    });
  },
});

export const findOpportunitiesTool = createTool({
  id: "find-opportunities",
  description: "Scan configured public sources for a user, analyze new conversations, and return the strongest unsent opportunities.",
  inputSchema: z.object({}),
  requestContextSchema,
  execute: async (_input, context) => {
    const userId = runtimeUserId(context);
    const result = await monitorUser(userId);
    const user = await getUser(userId);
    const opportunities = await getUnalertedOpportunities(userId, user?.minScore ?? 65, 5);
    return { result, opportunities };
  },
});

export const getLatestDigestTool = createTool({
  id: "get-latest-digest",
  description: "Read the workspace's latest qualified opportunities as a concise digest. This does not mark the Telegram digest as sent.",
  inputSchema: z.object({}),
  requestContextSchema,
  execute: async (_input, context) => {
    const userId = runtimeUserId(context);
    const user = await getUser(userId);
    const minimumScore = user?.minScore ?? 65;
    const opportunities = (await listOpportunitiesForUser(userId, 30))
      .filter((opportunity) => opportunity.relevant && opportunity.score >= minimumScore)
      .slice(0, 8)
      .map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.candidate.title,
        source: opportunity.candidate.source,
        url: opportunity.candidate.url,
        score: opportunity.score,
        reason: opportunity.reason,
        signals: opportunity.signals,
        replyDraft: opportunity.replyDraft,
        status: opportunity.status,
        createdAt: opportunity.createdAt,
      }));

    return { minimumScore, count: opportunities.length, opportunities };
  },
});

export const getProductProfileTool = createTool({
  id: "get-product-profile",
  description: "Read a user's saved product, audience, pain points, competitors, keywords, exclusions, and preferred reply style.",
  inputSchema: z.object({}),
  requestContextSchema,
  execute: async (_input, context) => getProfile(runtimeUserId(context)) ?? { error: "No saved product profile." },
});

export const manageAlertsTool = createTool({
  id: "manage-alerts",
  description: "Pause or resume workspace monitoring alerts after an explicit user request.",
  inputSchema: z.object({ enabled: z.boolean().describe("True to resume alerts; false to pause alerts.") }),
  requestContextSchema,
  execute: async ({ enabled }, context) => {
    const userId = runtimeUserId(context);
    await updateUserPreferences(userId, { alertsEnabled: enabled });
    const user = await getUser(userId);
    return { alertsEnabled: user?.alertsEnabled ?? enabled };
  },
});

export const manageSettingsTool = createTool({
  id: "manage-settings",
  description: "Read notification settings, or update digest hour, IANA timezone, and minimum opportunity score after an explicit user request. With no values, only read settings.",
  inputSchema: z.object({
    digestHour: z.number().int().min(0).max(23).optional(),
    timezone: z.string().min(1).optional(),
    minScore: z.number().int().min(40).max(100).optional(),
  }),
  requestContextSchema,
  execute: async (input, context) => {
    const userId = runtimeUserId(context);
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format();
      } catch {
        throw new Error("Use a valid IANA timezone such as Asia/Kolkata or America/New_York.");
      }
    }

    const preferences = {
      ...(input.digestHour === undefined ? {} : { digestHour: input.digestHour }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.minScore === undefined ? {} : { minScore: input.minScore }),
    };
    if (Object.keys(preferences).length) await updateUserPreferences(userId, preferences);
    const user = await getUser(userId);
    if (!user) throw new Error("Workspace settings could not be loaded.");
    return {
      alertsEnabled: user.alertsEnabled,
      digestHour: user.digestHour,
      timezone: user.timezone,
      minScore: user.minScore,
    };
  },
});

export const recordFeedbackTool = createTool({
  id: "record-feedback",
  description: "Record a user's explicit feedback on an opportunity so future scoring and drafts improve.",
  inputSchema: z.object({
    opportunityId: z.string().uuid(),
    value: feedbackValueSchema.exclude(["rewrite"]),
    note: z.string().max(1_000).optional(),
  }),
  requestContextSchema,
  execute: async ({ opportunityId, value, note }, context) => {
    await recordOpportunityFeedback(runtimeUserId(context), opportunityId, value, note);
    return { saved: true };
  },
});

export const rewriteOpportunityTool = createTool({
  id: "rewrite-opportunity",
  description: "Rewrite an opportunity's reply draft with the user's explicit direction, while preserving the saved product profile and disclosure rules.",
  inputSchema: z.object({
    opportunityId: z.string().uuid(),
    instruction: z.string().min(2).max(1_000).optional(),
  }),
  requestContextSchema,
  execute: async ({ opportunityId, instruction }, context) => {
    const replyDraft = await rewriteOpportunity(runtimeUserId(context), opportunityId, instruction);
    return { opportunityId, replyDraft };
  },
});

export const eveeTools = {
  createMonitor: createMonitorTool,
  findOpportunities: findOpportunitiesTool,
  getLatestDigest: getLatestDigestTool,
  getProductProfile: getProductProfileTool,
  manageAlerts: manageAlertsTool,
  manageSettings: manageSettingsTool,
  recordFeedback: recordFeedbackTool,
  rewriteOpportunity: rewriteOpportunityTool,
};
