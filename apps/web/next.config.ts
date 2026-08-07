import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
loadEnvConfig(repoRoot);
process.env.EVEE_REPO_ROOT ??= repoRoot;

const nextConfig: NextConfig = {
  transpilePackages: ["@evee/agents", "@evee/auth", "@evee/platform"],
  outputFileTracingRoot: repoRoot,
  experimental: {
    // Railway exposes many virtual CPUs. Keeping this small avoids a Bun
    // worker-cleanup crash after Next finishes collecting page data.
    cpus: 2,
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  // Let Turbopack resolve from this app directory. `outputFileTracingRoot`
  // intentionally remains the repository root for deployment tracing.
};

export default nextConfig;
