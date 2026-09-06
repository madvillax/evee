import { mastra, mastraStorage } from "@evee/agents";

async function start() {
  // This is deliberate deployment-time initialization. The web process uses
  // disableInit and therefore cannot create or migrate Mastra tables.
  await mastraStorage.init();
  await mastra.startWorkers();
  console.log("Evee worker started on Node: web workspace monitoring runs every 20 minutes.");
}

let keepAlive: ReturnType<typeof setInterval> | undefined;

async function stop(signal: string) {
  console.log(`Received ${signal}; stopping Evee Mastra worker.`);
  if (keepAlive) clearInterval(keepAlive);
  await mastra.stopWorkers();
}

await start();
keepAlive = setInterval(() => undefined, 24 * 60 * 60 * 1_000);
process.once("SIGINT", () => void stop("SIGINT"));
process.once("SIGTERM", () => void stop("SIGTERM"));
