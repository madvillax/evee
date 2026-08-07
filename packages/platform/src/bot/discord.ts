import { defaultRssFeeds } from "../config/env";
import {
  getProfile,
  getUser,
  getUserForDiscordInteraction,
  provisionDefaultSources,
  saveProfile,
  updateUserPreferences,
} from "../db/repository";
import { consumeDiscordLinkCode } from "../db/workspaces";
import { profileInputSchema, type ProfileInput } from "../domain/types";
import { recordOpportunityFeedback, rewriteOpportunity } from "../services/feedback";
import { monitorUser } from "../services/monitor";
import { splitCommaList } from "../utils/text";
import { opportunityMessage, profileMessage, type DiscordMessage } from "./messages";
import { DiscordClient, sendDailyDigest, sendPendingAlerts } from "./notifications";

const ephemeral = 1 << 6;

type DiscordUser = { id: string; username: string; global_name?: string | null };
type DiscordOption = { name: string; value?: string | number | boolean; options?: DiscordOption[] };
type DiscordInteraction = {
  id: string;
  token: string;
  application_id: string;
  type: number;
  guild_id?: string;
  channel_id?: string;
  member?: { user?: DiscordUser };
  user?: DiscordUser;
  data?: { name?: string; custom_id?: string; options?: DiscordOption[] };
};

type InteractionResponse = { type: number; data?: DiscordMessage };

export const discordCommands = [
  { name: "connect", description: "Connect this Discord channel to Evee", options: [{ name: "code", description: "One-time code from Evee Connections", type: 3, required: true }] },
  { name: "setup", description: "Create or update the workspace opportunity profile", options: [
    { name: "product_name", description: "Product name", type: 3, required: true },
    { name: "product_summary", description: "What it does and the outcome", type: 3, required: true },
    { name: "target_customers", description: "Comma-separated ideal customer segments", type: 3, required: true },
    { name: "pain_points", description: "Comma-separated problems solved", type: 3, required: true },
    { name: "reply_style", description: "Desired reply style", type: 3, required: true },
    { name: "product_url", description: "Optional public URL", type: 3 },
    { name: "competitors", description: "Optional comma-separated alternatives", type: 3 },
    { name: "keywords", description: "Optional comma-separated monitored terms", type: 3 },
    { name: "exclusions", description: "Optional comma-separated exclusions", type: 3 },
  ] },
  { name: "profile", description: "View the current opportunity profile" },
  { name: "scan", description: "Scan public sources now" },
  { name: "digest", description: "Send the latest opportunity digest" },
  { name: "settings", description: "View or update digest and alert settings", options: [
    { name: "digest_hour", description: "Hour 0-23", type: 4 },
    { name: "timezone", description: "IANA timezone, e.g. Asia/Kolkata", type: 3 },
    { name: "minimum_score", description: "Minimum score 40-100", type: 4 },
  ] },
  { name: "pause", description: "Pause monitoring alerts" },
  { name: "resume", description: "Resume monitoring alerts" },
] as const;

function response(data: DiscordMessage, type = 4): InteractionResponse {
  return { type, data };
}

function errorResponse(message: string) {
  return response({ content: message, flags: ephemeral });
}

function interactionUser(interaction: DiscordInteraction) {
  return interaction.member?.user ?? interaction.user;
}

function optionValue(interaction: DiscordInteraction, name: string) {
  return interaction.data?.options?.find((option) => option.name === name)?.value;
}

function stringOption(interaction: DiscordInteraction, name: string) {
  const value = optionValue(interaction, name);
  return typeof value === "string" ? value.trim() : undefined;
}

function numberOption(interaction: DiscordInteraction, name: string) {
  const value = optionValue(interaction, name);
  return typeof value === "number" ? value : undefined;
}

function interactionContext(interaction: DiscordInteraction) {
  const user = interactionUser(interaction);
  if (!user || !interaction.guild_id || !interaction.channel_id) throw new Error("Use Evee commands from the connected Discord server channel.");
  return { user, discordGuildId: interaction.guild_id, discordChannelId: interaction.channel_id };
}

function profileInputFromInteraction(interaction: DiscordInteraction): ProfileInput {
  return profileInputSchema.parse({
    productName: stringOption(interaction, "product_name"),
    productSummary: stringOption(interaction, "product_summary"),
    targetCustomers: splitCommaList(stringOption(interaction, "target_customers") ?? ""),
    painPoints: splitCommaList(stringOption(interaction, "pain_points") ?? ""),
    replyStyle: stringOption(interaction, "reply_style"),
    ...(stringOption(interaction, "product_url") ? { productUrl: stringOption(interaction, "product_url") } : {}),
    competitors: splitCommaList(stringOption(interaction, "competitors") ?? ""),
    keywords: splitCommaList(stringOption(interaction, "keywords") ?? ""),
    exclusions: splitCommaList(stringOption(interaction, "exclusions") ?? ""),
  });
}

async function linkedUser(interaction: DiscordInteraction) {
  const context = interactionContext(interaction);
  const user = await getUserForDiscordInteraction({
    discordUserId: context.user.id,
    discordGuildId: context.discordGuildId,
    discordChannelId: context.discordChannelId,
  });
  if (!user) throw new Error("This Discord user and channel are not connected to an Evee workspace. Generate a code in Evee Connections, then run /connect here.");
  return user;
}

async function editInteractionResponse(interaction: DiscordInteraction, message: DiscordMessage) {
  const response = await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!response.ok) console.error("Discord interaction follow-up failed", { status: response.status });
}

async function runDeferred(interaction: DiscordInteraction, operation: () => Promise<DiscordMessage>) {
  try {
    await editInteractionResponse(interaction, await operation());
  } catch (error) {
    await editInteractionResponse(interaction, { content: `Evee could not complete that request: ${error instanceof Error ? error.message : "unknown error"}`, flags: ephemeral });
  }
}

async function handleCommand(interaction: DiscordInteraction, discord: DiscordClient): Promise<InteractionResponse> {
  const command = interaction.data?.name;
  if (command === "connect") {
    try {
      const context = interactionContext(interaction);
      const code = stringOption(interaction, "code");
      if (!code) return errorResponse("Provide the one-time code from Evee Connections.");
      await consumeDiscordLinkCode({
        code,
        discordUserId: context.user.id,
        discordGuildId: context.discordGuildId,
        discordChannelId: context.discordChannelId,
        discordUsername: context.user.username,
        ...(context.user.global_name ? { firstName: context.user.global_name } : {}),
      });
      return response({ content: "Connected. This channel now receives Evee alerts and digests for your workspace.", flags: ephemeral });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Evee could not connect this channel.");
    }
  }

  let user;
  try {
    user = await linkedUser(interaction);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "This channel is not connected.");
  }

  if (command === "profile") {
    const profile = await getProfile(user.id);
    return profile ? response({ ...profileMessage(profile), flags: ephemeral }) : errorResponse("No profile yet. Use /setup to create one.");
  }
  if (command === "setup") {
    try {
      const profile = await saveProfile(user.id, profileInputFromInteraction(interaction));
      await provisionDefaultSources(user.id, defaultRssFeeds);
      return response({ content: `Profile saved for **${profile.productName}**. Use /scan when you are ready.`, flags: ephemeral });
    } catch (error) {
      return errorResponse(`Profile could not be saved: ${error instanceof Error ? error.message : "invalid input"}`);
    }
  }
  if (command === "pause" || command === "resume") {
    const paused = command === "pause";
    await updateUserPreferences(user.id, { alertsEnabled: !paused });
    return response({ content: paused ? "Monitoring alerts paused. Your profile and history remain safe." : "Monitoring alerts resumed.", flags: ephemeral });
  }
  if (command === "settings") {
    const hour = numberOption(interaction, "digest_hour");
    const timezone = stringOption(interaction, "timezone");
    const score = numberOption(interaction, "minimum_score");
    if (hour === undefined && !timezone && score === undefined) {
      const current = await getUser(user.id);
      return response({ content: `Current settings: digest at ${current?.digestHour}:00 (${current?.timezone}); alert threshold ${current?.minScore}/100.`, flags: ephemeral });
    }
    if (hour === undefined || !timezone || score === undefined || !Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(score) || score < 40 || score > 100) {
      return errorResponse("Provide all settings: digest hour (0–23), IANA timezone, and minimum score (40–100).");
    }
    try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); } catch { return errorResponse("Use an IANA timezone such as Asia/Kolkata or America/New_York."); }
    await updateUserPreferences(user.id, { digestHour: hour, timezone, minScore: score });
    return response({ content: `Saved. Digest: ${hour}:00 ${timezone}; alert threshold: ${score}/100.`, flags: ephemeral });
  }
  if (command === "scan") {
    void runDeferred(interaction, async () => {
      const profile = await getProfile(user.id);
      if (!profile) return { content: "Complete /setup before scanning.", flags: ephemeral };
      const result = await monitorUser(user.id);
      const fresh = await getUser(user.id);
      const sent = fresh ? await sendPendingAlerts(discord, fresh) : 0;
      return { content: `Scan complete: ${result.candidatesFound} conversations checked, ${result.opportunitiesCreated} qualified, ${sent} alert${sent === 1 ? "" : "s"} sent.${result.errors.length ? ` ${result.errors.length} source error${result.errors.length === 1 ? "" : "s"} will retry later.` : ""}`, flags: ephemeral };
    });
    return response({ content: "Scanning public sources…", flags: ephemeral }, 5);
  }
  if (command === "digest") {
    void runDeferred(interaction, async () => {
      const sent = await sendDailyDigest(discord, user, true);
      return { content: sent ? `Digest sent with ${sent} ${sent === 1 ? "opportunity" : "opportunities"}.` : "No new qualified opportunities since your last digest.", flags: ephemeral };
    });
    return response({ content: "Preparing your digest…", flags: ephemeral }, 5);
  }
  return errorResponse("Unknown Evee command.");
}

async function handleComponent(interaction: DiscordInteraction): Promise<InteractionResponse> {
  const customId = interaction.data?.custom_id;
  const match = customId?.match(/^fb:(good|bad|replied|rewrite):(.+)$/);
  if (!match) return errorResponse("Unknown Evee action.");
  let user;
  try { user = await linkedUser(interaction); } catch (error) { return errorResponse(error instanceof Error ? error.message : "This channel is not connected."); }
  const [, action, opportunityId] = match;
  if (!action || !opportunityId) return errorResponse("Invalid Evee action.");
  if (action === "rewrite") {
    void runDeferred(interaction, async () => {
      const draft = await rewriteOpportunity(user.id, opportunityId);
      const opportunity = await import("../db/repository").then(({ getOpportunity }) => getOpportunity(opportunityId));
      return opportunity ? opportunityMessage({ ...opportunity, replyDraft: draft }) : { content: "Opportunity not found.", flags: ephemeral };
    });
    return { type: 6 };
  }
  try {
    await recordOpportunityFeedback(user.id, opportunityId, action as "good" | "bad" | "replied");
    return response({ content: action === "good" ? "Saved as useful." : action === "replied" ? "Marked as replied." : "Saved as not a fit.", flags: ephemeral });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Evee could not save that feedback.");
  }
}

function hexBytes(value: string) {
  if (!/^[\da-f]+$/i.test(value) || value.length % 2) throw new Error("Invalid Discord signature encoding.");
  return Uint8Array.from(value.match(/.{1,2}/g)!.map((pair) => Number.parseInt(pair, 16)));
}

async function validSignature(request: Request, body: string, publicKey: string) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signature || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hexBytes(publicKey), "Ed25519", false, ["verify"]);
    return crypto.subtle.verify("Ed25519", key, hexBytes(signature), new TextEncoder().encode(`${timestamp}${body}`));
  } catch {
    return false;
  }
}

export async function handleDiscordInteraction(request: Request, input: { publicKey: string; botToken: string }) {
  const body = await request.text();
  if (!await validSignature(request, body, input.publicKey)) return new Response("Invalid Discord signature", { status: 401 });
  const interaction = JSON.parse(body) as DiscordInteraction;
  if (interaction.type === 1) return Response.json({ type: 1 });
  const discord = new DiscordClient(input.botToken);
  const result = interaction.type === 2
    ? await handleCommand(interaction, discord)
    : interaction.type === 3
      ? await handleComponent(interaction)
      : errorResponse("Unsupported Discord interaction.");
  return Response.json(result);
}

export async function registerDiscordCommands(input: { applicationId: string; botToken: string; testGuildId?: string }) {
  const path = input.testGuildId
    ? `/applications/${input.applicationId}/guilds/${input.testGuildId}/commands`
    : `/applications/${input.applicationId}/commands`;
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    method: "PUT",
    headers: { Authorization: `Bot ${input.botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(discordCommands),
  });
  if (!response.ok) throw new Error(`Discord command registration failed (${response.status}).`);
}
