FROM oven/bun:1.3.14

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bun run --cwd apps/web build

ENV NODE_ENV=production

CMD ["sh", "-c", "cd /app/apps/web && bun run --bun next start -H 0.0.0.0 -p ${PORT:-3001}"]
