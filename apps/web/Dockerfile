FROM oven/bun:1.3.14

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1

# Better Auth is imported while Next collects route data. Use a public,
# build-only placeholder here; Railway supplies the real secret at runtime.
RUN BETTER_AUTH_SECRET=evee-build-placeholder-only-not-for-runtime bun run --cwd apps/web build

ENV NODE_ENV=production

CMD ["sh", "-c", "cd /app/apps/web && bun run --bun next start -H 0.0.0.0 -p ${PORT:-3001}"]
