import { claimScheduledRun, listAutomatedUsers, releaseScheduledRun } from "@evee/platform/db/repository";
import { monitorUser } from "@evee/platform/services/monitor";

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

export async function monitorAllWorkspaces() {
  const activeUsers = await listAutomatedUsers();
  const bucket = Math.floor(Date.now() / 1_200_000);
  let opportunitiesCreated = 0;
  let completed = 0;
  let failed = 0;

  await withConcurrency(activeUsers, 8, async (user) => {
    const claimed = await claimScheduledRun("monitor", user.id, bucket);
    if (!claimed) return;
    try {
      const result = await retry(() => monitorUser(user.id), 5, 60_000);
      opportunitiesCreated += result.opportunitiesCreated;
      completed += 1;
    } catch (error) {
      failed += 1;
      await releaseScheduledRun("monitor", user.id, bucket);
      console.error("Eve monitoring schedule failed", { userId: user.id, error });
    }
  });

  return { queued: activeUsers.length, completed, failed, opportunitiesCreated };
}
