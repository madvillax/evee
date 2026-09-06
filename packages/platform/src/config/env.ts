import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

const runtimeCwd = process.cwd();
const runtimeParent = path.basename(path.dirname(runtimeCwd));
if (runtimeParent === "apps" || runtimeParent === "packages") {
  dotenv.config({ path: path.resolve(runtimeCwd, "../../.env"), override: false, quiet: true });
}

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().optional(),
);

const databaseUrl = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().default("file:local.db"),
);

const geminiModel = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().default("gemini-2.5-flash"),
);

const schema = z.object({
  BETTER_AUTH_SECRET: optionalString,
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: geminiModel,
  TURSO_DATABASE_URL: databaseUrl,
  TURSO_AUTH_TOKEN: optionalString,
  EVEE_REPO_ROOT: optionalString,
  GITHUB_TOKEN: optionalString,
  REDDIT_USER_AGENT: z.string().default("evee/0.3 (web opportunity monitoring)"),
  DEFAULT_RSS_FEEDS: z.string().default(""),
});

// Direct Gemini calls require a Google AI Studio key. Vercel AI Gateway keys
// are intentionally not accepted because they cannot authenticate with Google.
export const env = schema.parse(process.env);

export const defaultRssFeeds = env.DEFAULT_RSS_FEEDS.split(",")
  .map((feed) => feed.trim())
  .filter(Boolean);
