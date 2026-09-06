import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@evee/platform/db/client";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
} from "@evee/platform/db/schema";
import { ensureWorkspaceForAuthUser } from "@evee/platform/db/workspaces";
import { betterAuth } from "better-auth";

function originOf(value: string | undefined) {
  return value ? new URL(value).origin : undefined;
}

const vercelDeploymentURL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

// `BETTER_AUTH_URL` must be the canonical public app URL in production. Vercel
// also supplies VERCEL_URL for each deployment, which keeps a deployment usable
// when the canonical URL has not been configured yet. Do not carry the local
// example URL into a hosted Vercel deployment.
const configuredAuthURL = process.env.BETTER_AUTH_URL;
const configuredAuthOrigin = originOf(configuredAuthURL);
const configuredLocalURL = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/.test(
  configuredAuthURL ?? "",
);
const authBaseURL =
  process.env.NODE_ENV === "production" && vercelDeploymentURL && configuredLocalURL
    ? vercelDeploymentURL
    : configuredAuthOrigin ?? vercelDeploymentURL ?? "http://localhost:3001";

// Better Auth already reads BETTER_AUTH_TRUSTED_ORIGINS itself. Supplying the
// same explicit list here also lets the deployment URL coexist with a custom
// production domain, while retaining an exact allowlist for origin/CSRF checks.
const trustedOrigins = [
  authBaseURL,
  vercelDeploymentURL,
  ...(process.env.WEB_ORIGINS?.split(",") ?? []),
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
]
  .map((origin) => origin?.trim())
  .filter((origin): origin is string => Boolean(origin))
  .map((origin) => originOf(origin)!);

const authSecret =
  process.env.BETTER_AUTH_SECRET ??
  (process.env.NODE_ENV !== "production"
    ? "evee-local-development-secret-not-for-production"
    : undefined);

export const auth = betterAuth({
  appName: "Evee",
  baseURL: authBaseURL,
  trustedOrigins,
  ...(authSecret ? { secret: authSecret } : {}),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await ensureWorkspaceForAuthUser({ id: user.id, name: user.name });
        },
      },
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
