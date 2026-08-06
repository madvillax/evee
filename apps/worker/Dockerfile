FROM oven/bun:1.3.14

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

ENV NODE_ENV=production
ENV MASTRA_WORKER=true
CMD ["bun", "apps/worker/src/index.ts"]
