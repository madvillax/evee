import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "@evee/platform/config/env";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// Eve owns HTTP delivery, durable runs and production schedules. Keep its
// supported CLI lifecycle instead of embedding a second scheduler in Hono.
const development = process.argv.includes("--dev");
const child = spawn(process.execPath, [
  path.join(repoRoot, "node_modules/eve/bin/eve.js"),
  development ? "dev" : "start",
  "--host", development ? "127.0.0.1" : "0.0.0.0",
  "--port", process.env.EVE_PORT ?? "4001",
  ...(development ? ["--no-ui", "--no-default-extensions"] : []),
], { cwd: path.join(repoRoot, "packages/agents"), env: { ...process.env, EVEE_REPO_ROOT: repoRoot }, stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => child.kill(signal));
child.once("error", (error) => { console.error("Eve service failed to start", error); process.exitCode = 1; });
child.once("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1); });
