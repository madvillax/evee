import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
loadEnvConfig(repoRoot);
const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
process.env.EVEE_REPO_ROOT ??= repoRoot;

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@evee/auth", "@evee/platform"],
  outputFileTracingRoot: repoRoot,
  experimental: {
    // Keep build concurrency predictable on small deployment machines.
    cpus: 2,
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  // Let Turbopack resolve from this app directory. `outputFileTracingRoot`
  // intentionally remains the repository root for deployment tracing.
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${apiOrigin}/api/auth/:path*` },
      { source: "/api/copilot", destination: `${apiOrigin}/api/copilot` },
      { source: "/api/backend/:path*", destination: `${apiOrigin}/api/:path*` },
    ];
  },
};

export default nextConfig;
