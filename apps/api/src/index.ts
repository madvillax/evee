import { serve } from "@hono/node-server";
import { app } from "./app";

const deploymentPort = process.env.NODE_ENV === "production" ? process.env.PORT : undefined;
const port = Number(process.env.API_PORT ?? deploymentPort ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("API_PORT must be a valid TCP port.");
}

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Evee Hono API listening on http://localhost:${info.port}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; stopping Evee Hono API.`);
  server.close((error) => {
    if (error) {
      console.error("Evee Hono API shutdown failed", error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
