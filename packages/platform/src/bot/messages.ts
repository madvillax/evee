import type { StoredOpportunity } from "../domain/types";
import { truncate } from "../utils/text";

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export interface DiscordComponent {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5;
  label: string;
  custom_id?: string;
  url?: string;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: Array<{ type: 1; components: DiscordComponent[] }>;
  flags?: number;
}

const sourceNames = { reddit: "Reddit", hackernews: "Hacker News", github: "GitHub", rss: "RSS" } as const;
const discordBlurple = 0x5865f2;

export function opportunityMessage(opportunity: StoredOpportunity): DiscordMessage {
  const fields = [
    ...(opportunity.signals.length ? [{ name: "Signals", value: truncate(opportunity.signals.map((signal) => `• ${signal}`).join("\n"), 1_000) }] : []),
    ...(opportunity.risks.length ? [{ name: "Watch for", value: truncate(opportunity.risks.join("; "), 1_000) }] : []),
    { name: "Suggested reply", value: truncate(opportunity.replyDraft, 1_000) },
  ];
  return {
    embeds: [{
      title: `${opportunity.score}/100 opportunity · ${sourceNames[opportunity.candidate.source]}`,
      description: truncate(`${opportunity.candidate.title}\n\n${opportunity.reason}`, 3_000),
      url: opportunity.candidate.url,
      color: discordBlurple,
      fields,
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 5, label: "Open conversation", url: opportunity.candidate.url },
        { type: 2, style: 3, label: "Useful", custom_id: `fb:good:${opportunity.id}` },
        { type: 2, style: 4, label: "Not a fit", custom_id: `fb:bad:${opportunity.id}` },
        { type: 2, style: 2, label: "Rewrite", custom_id: `fb:rewrite:${opportunity.id}` },
        { type: 2, style: 1, label: "I replied", custom_id: `fb:replied:${opportunity.id}` },
      ],
    }],
  };
}

export function digestMessage(opportunities: StoredOpportunity[]): DiscordMessage {
  const entries = opportunities.map((item, index) =>
    `**${index + 1}. ${item.score}/100 · ${sourceNames[item.candidate.source]}**\n` +
    `[${truncate(item.candidate.title, 140)}](${item.candidate.url})\n` +
    truncate(item.reason, 220),
  );
  return {
    embeds: [{
      title: "Your opportunity digest",
      description: truncate(`${opportunities.length} new conversation${opportunities.length === 1 ? "" : "s"} worth reviewing.\n\n${entries.join("\n\n")}`, 4_000),
      color: discordBlurple,
    }],
  };
}

export function profileMessage(profile: {
  productName: string;
  productUrl?: string | undefined;
  productSummary: string;
  targetCustomers: string[];
  painPoints: string[];
  competitors: string[];
  replyStyle: string;
  keywords: string[];
  exclusions: string[];
}): DiscordMessage {
  return {
    embeds: [{
      title: profile.productName,
      ...(profile.productUrl ? { url: profile.productUrl } : {}),
      description: truncate(profile.productSummary, 1_000),
      color: discordBlurple,
      fields: [
        { name: "Customers", value: truncate(profile.targetCustomers.join(", "), 1_000) },
        { name: "Pain points", value: truncate(profile.painPoints.join(", "), 1_000) },
        { name: "Competitors", value: truncate(profile.competitors.join(", ") || "—", 1_000), inline: true },
        { name: "Reply style", value: truncate(profile.replyStyle, 1_000), inline: true },
        { name: "Keywords", value: truncate(profile.keywords.join(", ") || "Inferred from profile", 1_000) },
        { name: "Exclusions", value: truncate(profile.exclusions.join(", ") || "—", 1_000) },
      ],
    }],
  };
}
