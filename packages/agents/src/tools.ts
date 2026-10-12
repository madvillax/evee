import { defineTool } from "eve/tools";
import {
  createMonitor,
  getProfile,
  listNewOpportunities,
  getUser,
  listOpportunitiesForUser,
  updateUserPreferences,
} from "@evee/platform/db/repository";
import { feedbackValueSchema, sourceTypeSchema } from "@evee/platform/domain/types";
import { recordOpportunityFeedback, rewriteOpportunity } from "@evee/platform/services/feedback";
import { monitorUser } from "@evee/platform/services/monitor";
import { z } from "zod";
import { getRuntimeUserId } from "./context";

export const createMonitorTool = defineTool({
  description: "Create a focused workspace monitor after translating the user's natural-language monitoring goal into a source and query configuration.",
  inputSchema: z.object({
    type: sourceTypeSchema,
    name: z.string().min(2).max(80),
    query: z.string().min(2).max(500),
    communities: z.array(z.string().min(1)).max(20).default([]),
    exclusions: z.array(z.string().min(1)).max(20).default([]),
  }),
  execute: async (input, context) => createMonitor({
    userId: await getRuntimeUserId(context),
    type: input.type,
    name: input.name,
    config: { query: input.query, communities: input.communities, exclusions: input.exclusions },
  }),
});

export const findOpportunitiesTool = defineTool({
  description: "Scan configured public sources for a user, analyze new conversations, and return the strongest unsent opportunities.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const userId = await getRuntimeUserId(context);
    const result = await monitorUser(userId);
    const user = await getUser(userId);
    const opportunities = await listNewOpportunities(userId, user?.minScore ?? 65, 5);
    return { result, opportunities };
  },
});

export const getLatestDigestTool = defineTool({
  description: "Read the workspace's latest qualified opportunities as a concise web digest without changing their review state.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const userId = await getRuntimeUserId(context);
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

export const getProductProfileTool = defineTool({
  description: "Read a user's saved product, audience, pain points, competitors, keywords, exclusions, and preferred reply style.",
  inputSchema: z.object({}),
  execute: async (_input, context) => (await getProfile(await getRuntimeUserId(context))) ?? { error: "No saved product profile." },
});

export const manageMonitoringTool = defineTool({
  description: "Pause or resume automated workspace scans after an explicit user request.",
  inputSchema: z.object({ enabled: z.boolean().describe("True to resume automated scans; false to pause them.") }),
  execute: async ({ enabled }, context) => {
    const userId = await getRuntimeUserId(context);
    await updateUserPreferences(userId, { alertsEnabled: enabled });
    const user = await getUser(userId);
    return { monitoringEnabled: user?.alertsEnabled ?? enabled };
  },
});

export const manageSettingsTool = defineTool({
  description: "Read web automation settings, or update the minimum opportunity score after an explicit user request. With no values, only read settings.",
  inputSchema: z.object({
    minScore: z.number().int().min(40).max(100).optional(),
  }),
  execute: async (input, context) => {
    const userId = await getRuntimeUserId(context);
    const preferences = {
      ...(input.minScore === undefined ? {} : { minScore: input.minScore }),
    };
    if (Object.keys(preferences).length) await updateUserPreferences(userId, preferences);
    const user = await getUser(userId);
    if (!user) throw new Error("Workspace settings could not be loaded.");
    return {
      monitoringEnabled: user.alertsEnabled,
      minScore: user.minScore,
    };
  },
});

export const recordFeedbackTool = defineTool({
  description: "Record a user's explicit feedback on an opportunity so future scoring and drafts improve.",
  inputSchema: z.object({
    opportunityId: z.string().uuid(),
    value: feedbackValueSchema.exclude(["rewrite"]),
    note: z.string().max(1_000).optional(),
  }),
  execute: async ({ opportunityId, value, note }, context) => {
    await recordOpportunityFeedback(await getRuntimeUserId(context), opportunityId, value, note);
    return { saved: true };
  },
});

export const rewriteOpportunityTool = defineTool({
  description: "Rewrite an opportunity's reply draft with the user's explicit direction, while preserving the saved product profile and disclosure rules.",
  inputSchema: z.object({
    opportunityId: z.string().uuid(),
    instruction: z.string().min(2).max(1_000).optional(),
  }),
  execute: async ({ opportunityId, instruction }, context) => {
    const replyDraft = await rewriteOpportunity(await getRuntimeUserId(context), opportunityId, instruction);
    return { opportunityId, replyDraft };
  },
});
