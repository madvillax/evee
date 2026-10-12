import type { RouteHandlerArgs } from "eve/channels";
import { telegramChannel, type TelegramChannelState } from "eve/channels/telegram";
import { consumeTelegramLink, getTelegramCaller } from "@evee/platform/services/telegram";

const telegram = telegramChannel({
  ...(process.env.TELEGRAM_BOT_USERNAME ? { botUsername: process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "") } : {}),
  turnPolicy: "queue",
  async onMessage(ctx, message) {
    // Workspace information is private: only the linked user's private chat.
    if (message.chat.type !== "private" || !message.from || message.from.isBot) return null;
    const start = message.text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/);
    if (start) {
      if (!start[1]) { await ctx.telegram.post("Link this bot from Evee → Connections → Telegram. Then use /scan, /digest, /pause, /resume, or send a question."); return null; }
      try {
        await consumeTelegramLink(start[1], message.from.id, message.chat.id, message.from.username);
        await ctx.telegram.post("Telegram is linked to your Evee workspace. Use /scan, /digest, /pause, /resume, or ask a question.");
      } catch (error) {
        await ctx.telegram.post(error instanceof Error ? error.message : "This link could not be completed. Create a new link in Evee Connections.");
      }
      return null;
    }
    const linked = await getTelegramCaller(message.from.id, message.chat.id);
    if (!linked) { await ctx.telegram.post("Link Telegram from Evee Connections before asking about your workspace."); return null; }
    return { auth: {
      authenticator: "evee-telegram", principalType: "user", principalId: linked.connection.authUserId,
      attributes: { workspaceId: linked.connection.workspaceId, connectionId: linked.connection.id, telegramUserId: message.from.id, telegramChatId: message.chat.id },
    } };
  },
  events: {
    async "message.completed"(event, channel, ctx) {
      if (event.finishReason === "tool-calls" || !event.message) return;
      const caller = ctx.session.auth.current;
      const telegramUserId = caller?.attributes.telegramUserId;
      if (typeof telegramUserId !== "string") return;
      const linked = await getTelegramCaller(telegramUserId, channel.telegram.chatId);
      if (linked?.connection.id !== caller?.attributes.connectionId) return;
      await channel.telegram.post(event.message);
    },
  },
});

// Include the connection identity in the continuation address. Relinking a
// chat to another workspace must never reuse that chat's earlier history.
function isolateConnection(args: RouteHandlerArgs<TelegramChannelState>): RouteHandlerArgs<TelegramChannelState> {
  return {
    ...args,
    from(address) {
      const denied = args.from(address);
      return {
        ...denied,
        async send(message, options) {
          const connectionId = options.auth?.attributes.connectionId;
          if (typeof connectionId !== "string") throw new Error("A linked Telegram account is required.");
          return args.from(`${address}:link:${connectionId}`).send(message, options);
        },
        async respond() { throw new Error("Telegram callbacks are not enabled for this bot."); },
      };
    },
  };
}

const channel: typeof telegram = {
  ...telegram,
  routes: telegram.routes.map((route) => route.transport === "websocket" ? route : {
    ...route,
    handler: (request: Request, args: RouteHandlerArgs<TelegramChannelState>) => route.handler(request, isolateConnection(args)),
  }),
};
export default channel;
