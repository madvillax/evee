# Evee

Evee is a full-stack AI GTM workspace. It finds relevant public conversations, explains why they matter, drafts useful replies, and keeps the same opportunities, monitors, feedback, and alerts synchronized between a web dashboard and Telegram.

Evee never posts a public reply on a user's behalf.

## Product surfaces

- Web dashboard for business profiles, monitors, opportunities, the GTM copilot, integrations, analytics, billing state, and settings
- Telegram companion for instant alerts, reply drafts, quick feedback, manual scans, and daily digests
- Secure, expiring, one-time codes for linking a Telegram identity to an authenticated web workspace
- Light and dark themes with a responsive application shell
- Shared Turso data model so web, Telegram, and the Mastra worker operate on the same workspace

## Stack

| Technology | Purpose |
| --- | --- |
| Next.js + Tailwind CSS | Web application and design system |
| Bun + TypeScript | Monorepo runtime, scripts, and type-safe application code |
| Better Auth | Email/password authentication and sessions |
| Turso + Drizzle ORM | Multi-tenant application data and migrations |
| Mastra | Multi-agent GTM copilot, durable conversation memory, workspace-scoped tools, and scheduled workflows |
| Google provider | Direct Gemini 2.5 Flash access for Mastra |
| Google Gen AI SDK + Zod | Structured opportunity analysis in the monitoring pipeline |
| grammY | Telegram bot transport and commands |

## Monorepo layout

```text
apps/
  web/                 Next.js dashboard and API routes
  bot/                 Telegram bot process
  worker/              standalone Mastra scheduler and workflow process
packages/
  agents/              Mastra coordinator, specialist agents, tools, and workflows
  auth/                Better Auth configuration
  platform/            database, collectors, analysis, and services
drizzle/                generated SQL migrations
```

## Local setup

Prerequisites:

- Bun 1.3+
- Node.js 24
- A Telegram bot token from BotFather
- A direct Gemini API key from Google AI Studio
- A Turso database, or `file:local.db` for local-only development

Install dependencies and create your local environment file:

```bash
fnm use 24
bun install
cp .env.example .env
bun run db:migrate
```

If `.env.example` is intentionally ignored in your clone, create `.env` with these values:

```dotenv
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_LINK_SECRET=replace-with-a-long-random-secret
BOT_MODE=polling
PORT=3000

BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3001

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=

GITHUB_TOKEN=
REDDIT_USER_AGENT=evee/0.2 opportunity monitor

DEFAULT_RSS_FEEDS=
```

Generate the two application secrets with `openssl rand -base64 32`. Use the same `TELEGRAM_LINK_SECRET` in the web and bot runtimes. Do not reuse an AI Gateway key as `GEMINI_API_KEY`; Evee calls Google directly.

## Start the project

Run each long-lived process in its own terminal:

```bash
# Terminal 1: dashboard and embedded Mastra copilot route
bun run dev:web

# Terminal 2: Telegram bot
bun run bot

# Terminal 3: Mastra schedules and deterministic background workflows
bun run dev:worker
```

Open [http://localhost:3001](http://localhost:3001), create an account, then connect Telegram from **Dashboard > Integrations**. In Telegram, send the generated command:

```text
/link YOUR_CODE
```

The code expires after ten minutes, is stored only as a hash, can be used once, and is invalidated when a replacement code is created.

For a production-like local run, build the app and start the web and worker processes. The web process serves the authenticated copilot; the worker owns Mastra storage initialization and cron schedules:

```bash
fnm use 24
bun run build

# Terminal 1: web
bun --cwd apps/web start

# Terminal 2: Mastra worker
bun run worker
```

## Telegram commands

- `/start` - welcome and command guide
- `/link CODE` - connect Telegram to a web workspace
- `/setup` - create or update the business profile
- `/profile` - view the business context known by Evee
- `/scan` - scan enabled public sources now
- `/digest` - receive the current opportunity digest
- `/settings 9 Asia/Kolkata 70` - set digest hour, timezone, and score threshold
- `/pause` and `/resume` - control automated alerts
- `/help` - show all commands

The bot registers these commands with Telegram so they appear in the command menu.

## AI and automation boundaries

Mastra runs the GTM copilot as a coordinator with four scoped specialists: intelligence, monitoring, notification settings, and draft/feedback. Its server route resolves the Better Auth session and workspace before every request, derives the conversation thread server-side, and passes only the verified runtime user ID to tools. Specialists receive that verified context, not a model-selected workspace ID.

Authentication, workspace authorization, billing state, CRUD operations, collection, analysis, and notification delivery remain deterministic application code. The standalone Mastra worker schedules monitoring every twenty minutes and checks hourly for timezone-aware daily digests. It retains bounded concurrency, exponential retries, and database-backed per-user run claims to avoid duplicate work during a scheduler replay or deployment overlap.

The worker is a required production service. Deploy it before the web app on a new environment: it explicitly initializes Mastra's storage tables, while the web runtime has automatic schema initialization disabled.

Collectors are implemented for Reddit, Hacker News, GitHub, and RSS. Telegram is implemented as the companion channel. Slack, email, and X are represented as workspace integrations and require their provider credentials and authorization flows before delivery or collection can be enabled. X capabilities also depend on the API access granted to the account.

## Useful commands

```bash
bun run typecheck
bun run test
bun run build
bun run db:generate
bun run db:migrate
bun run worker
```

## Production checklist

- Use strong, different production values for Better Auth and Telegram linking secrets.
- Set the same Turso credentials in the web, bot, and Mastra worker environments.
- Set `BETTER_AUTH_URL` to the canonical public HTTPS origin, with no path (for example, `https://app.example.com`). This is required for login.
- If users can open the app from another allowed hostname (for example a custom domain plus a Vercel deployment or preview URL), add each exact HTTPS origin to `BETTER_AUTH_TRUSTED_ORIGINS` as a comma-separated list, then redeploy. Do not use a wildcard or disable origin checks.
- Run the Telegram bot in webhook mode and validate Telegram's secret-token header.
- Configure provider authorization before marking Slack, email, or X as connected.
- Treat source content as untrusted and keep public posting behind explicit human approval.
- Apply committed Drizzle migrations before serving production traffic.
