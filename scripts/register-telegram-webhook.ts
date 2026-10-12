import "@evee/platform/config/env";
import { callTelegramApi } from "eve/channels/telegram";

const publicUrl = process.env.EVE_PUBLIC_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
if (!publicUrl || !secret || !process.env.TELEGRAM_BOT_TOKEN) throw new Error("Set EVE_PUBLIC_URL, TELEGRAM_BOT_TOKEN, and TELEGRAM_WEBHOOK_SECRET_TOKEN first.");
const url = new URL("/eve/v1/telegram", publicUrl);
if (url.protocol !== "https:") throw new Error("Telegram requires a public HTTPS webhook origin.");
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error("The Telegram webhook secret must contain 1–256 letters, digits, underscores, or hyphens.");
const result = await callTelegramApi({ method: "setWebhook", body: {
  url: url.toString(), secret_token: secret, allowed_updates: ["message"],
} });
if (!result.ok || !(result.body as { ok?: boolean } | null)?.ok) throw new Error("Telegram rejected webhook registration. Check the bot credentials and public URL.");
console.log(`Telegram webhook registered at ${url}.`);
