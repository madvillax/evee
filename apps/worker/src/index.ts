import { mastra, mastraStorage } from "@evee/agents";

async function start() {
  // This is deliberate deployment-time initialization. The web process uses
  // disableInit and therefore cannot create or migrate Mastra tables.
  await mastraStorage.init();
  await mastra.startWorkers();
  console.log("Evee Mastra worker started: monitoring every 20 minutes; digest checks hourly.");
}

async function stop(signal: string) {
  console.log(`Received ${signal}; stopping Evee Mastra worker.`);
  await mastra.stopWorkers();
  process.exit(0);
}

await start();
process.once("SIGINT", () => void stop("SIGINT"));
process.once("SIGTERM", () => void stop("SIGTERM"));

await new Promise<never>(() => undefined);
