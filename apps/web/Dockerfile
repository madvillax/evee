FROM oven/bun:1.3.14 AS dependencies

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY --from=dependencies /app /app

ENV NEXT_TELEMETRY_DISABLED=1

# Better Auth is imported while Next collects route data. Use a public,
# build-only placeholder here; Railway supplies the real secret at runtime.
RUN cd /app/apps/web && BETTER_AUTH_SECRET=evee-build-placeholder-only-not-for-runtime node node_modules/next/dist/bin/next build

FROM oven/bun:1.3.14 AS runner

WORKDIR /app

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["sh", "-c", "cd /app/apps/web && bun run --bun next start -H 0.0.0.0 -p ${PORT:-3001}"]
