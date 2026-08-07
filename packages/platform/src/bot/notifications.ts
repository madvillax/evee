import { getUnalertedOpportunities, listDigestOpportunities, markAlerted, markDigestSent } from "../db/repository";
import type { UserRow } from "../db/repository";
import { digestMessage, opportunityMessage, type DiscordMessage } from "./messages";

export class DiscordClient {
  constructor(private readonly token: string) {}

  async send(channelId: string, message: DiscordMessage) {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error(`Discord message delivery failed (${response.status}).`);
  }
}

export async function sendPendingAlerts(discord: DiscordClient, user: UserRow) {
  if (!user.alertsEnabled) return 0;
  const items = await getUnalertedOpportunities(user.id, user.minScore, 5);
  let sent = 0;
  for (const item of items) {
    await discord.send(user.discordChannelId, opportunityMessage(item));
    await markAlerted(item.id);
    sent += 1;
  }
  return sent;
}

export async function sendDailyDigest(discord: DiscordClient, user: UserRow, force = false) {
  const since = user.lastDigestAt ?? Date.now() - 24 * 60 * 60 * 1_000;
  const items = await listDigestOpportunities(user.id, since);
  if (!items.length) {
    if (force) await discord.send(user.discordChannelId, { content: "No new qualified opportunities since your last digest." });
    return 0;
  }
  await discord.send(user.discordChannelId, digestMessage(items));
  await markDigestSent(user.id, items.map((item) => item.id));
  return items.length;
}
