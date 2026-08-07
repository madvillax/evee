import { handleDiscordInteraction, registerDiscordCommands } from "@evee/platform/bot/discord";
import { env } from "@evee/platform/config/env";

const discordConfigured = Boolean(env.DISCORD_APPLICATION_ID && env.DISCORD_PUBLIC_KEY && env.DISCORD_BOT_TOKEN);

if (discordConfigured) {
  try {
    await registerDiscordCommands({
      applicationId: env.DISCORD_APPLICATION_ID!,
      botToken: env.DISCORD_BOT_TOKEN!,
      ...(env.DISCORD_TEST_GUILD_ID ? { testGuildId: env.DISCORD_TEST_GUILD_ID } : {}),
    });
  } catch (error) {
    console.error("Could not register Discord slash commands", error);
  }
}

const server = Bun.serve({
  port: env.PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        discordConfigured,
        geminiConfigured: Boolean(env.GEMINI_API_KEY),
        timestamp: new Date().toISOString(),
      });
    }
    if (url.pathname === "/discord/interactions" && request.method === "POST") {
      if (!discordConfigured) return new Response("Discord is not configured", { status: 503 });
      return handleDiscordInteraction(request, { publicKey: env.DISCORD_PUBLIC_KEY!, botToken: env.DISCORD_BOT_TOKEN! });
    }
    return new Response("Evee", { status: 200 });
  },
});

console.log(`Evee listening on http://localhost:${server.port}`);
if (!discordConfigured) console.warn("Discord credentials are not set; health server only.");
