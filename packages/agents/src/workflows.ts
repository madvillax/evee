import { createStep, createWorkflow } from "@mastra/core/workflows";
import { createTelegramBot } from "@evee/platform/bot/bot";
import { sendDailyDigest, sendPendingAlerts } from "@evee/platform/bot/notifications";
import { env } from "@evee/platform/config/env";
import { claimScheduledRun, getUser, listActiveUsers, releaseScheduledRun } from "@evee/platform/db/repository";
import { monitorUser } from "@evee/platform/services/monitor";
import { z } from "zod";

const monitorSchedule = z.object({});
const monitorOutput = z.object({ queued: z.number(), completed: z.number(), failed: z.number(), alertsSent: z.number() });
const digestOutput = z.object({ usersChecked: z.number(), opportunitiesSent: z.number(), failed: z.number() });

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function retry<T>(operation: () => Promise<T>, maxAttempts: number, maxDelayMs: number) {
  let failure: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      failure = error;
      if (attempt === maxAttempts) break;
      const exponentialDelay = Math.min(2_000 * (2 ** (attempt - 1)), maxDelayMs);
      await sleep(Math.round(exponentialDelay * (0.75 + Math.random() * 0.5)));
    }
  }
  throw failure instanceof Error ? failure : new Error(String(failure));
}

async function withConcurrency<T, R>(items: T[], concurrency: number, operation: (item: T) => Promise<R>) {
  const remaining = [...items];
  const groups = await Promise.all(Array.from({ length: Math.min(concurrency, remaining.length) }, async () => {
    const results: R[] = [];
    for (let next = remaining.shift(); next !== undefined; next = remaining.shift()) {
      results.push(await operation(next));
    }
    return results;
  }));
  return groups.flat();
}

function localParts(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { hour: Number(value("hour")), date: `${value("year")}-${value("month")}-${value("day")}` };
}

const monitorAllStep = createStep({
  id: "monitor-active-workspaces",
  inputSchema: monitorSchedule,
  outputSchema: monitorOutput,
  execute: async () => {
    const activeUsers = await listActiveUsers();
    const bucket = Math.floor(Date.now() / 1_200_000);
    let alertsSent = 0;
    let completed = 0;
    let failed = 0;

    await withConcurrency(activeUsers, 8, async (user) => {
      const claimed = await claimScheduledRun("monitor", user.id, bucket);
      if (!claimed) return;
      try {
        const result = await retry(async () => {
          const monitorResult = await monitorUser(user.id);
          const freshUser = await getUser(user.id);
          const sent = freshUser && env.TELEGRAM_BOT_TOKEN
            ? await sendPendingAlerts(createTelegramBot(env.TELEGRAM_BOT_TOKEN), freshUser)
            : 0;
          return { monitorResult, sent };
        }, 5, 60_000);
        alertsSent += result.sent;
        completed += 1;
      } catch (error) {
        failed += 1;
        await releaseScheduledRun("monitor", user.id, bucket);
        console.error("Mastra monitoring workflow failed", { userId: user.id, error });
      }
    });

    return { queued: activeUsers.length, completed, failed, alertsSent };
  },
});

const dailyDigestStep = createStep({
  id: "send-daily-digests",
  inputSchema: monitorSchedule,
  outputSchema: digestOutput,
  execute: async () => {
    if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required to send digests.");
    const activeUsers = await listActiveUsers();
    const timestamp = Date.now();
    const bucket = Math.floor(timestamp / 3_600_000);
    const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);
    let opportunitiesSent = 0;
    let failed = 0;

    for (const user of activeUsers) {
      const localNow = localParts(timestamp, user.timezone);
      const lastLocal = user.lastDigestAt ? localParts(user.lastDigestAt, user.timezone) : undefined;
      if (localNow.hour !== user.digestHour || lastLocal?.date === localNow.date) continue;

      const claimed = await claimScheduledRun("digest", user.id, bucket);
      if (!claimed) continue;
      try {
        opportunitiesSent += await retry(() => sendDailyDigest(bot, user), 4, 30_000);
      } catch (error) {
        failed += 1;
        await releaseScheduledRun("digest", user.id, bucket);
        console.error("Mastra digest workflow failed", { userId: user.id, error });
      }
    }

    return { usersChecked: activeUsers.length, opportunitiesSent, failed };
  },
});

export const monitorAllWorkflow = createWorkflow({
  id: "schedule-opportunity-monitoring",
  description: "Checks active workspace monitors every twenty minutes and sends pending Telegram alerts.",
  inputSchema: monitorSchedule,
  outputSchema: monitorOutput,
  schedule: { id: "every-twenty-minutes", cron: "*/20 * * * *", inputData: {} },
})
  .then(monitorAllStep)
  .commit();

export const dailyDigestWorkflow = createWorkflow({
  id: "schedule-daily-telegram-digests",
  description: "Checks each active workspace's local time hourly and sends its daily Telegram digest when due.",
  inputSchema: monitorSchedule,
  outputSchema: digestOutput,
  schedule: { id: "hourly-timezone-check", cron: "5 * * * *", inputData: {} },
})
  .then(dailyDigestStep)
  .commit();
