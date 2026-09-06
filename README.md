# Evee

Evee is a web-first AI GTM workspace. It finds relevant public conversations, explains why they matter, drafts useful replies, and keeps monitoring, review, feedback, and Copilot workflows inside one authenticated web application.

Evee never posts a public reply on a user's behalf.

## Product surfaces

- Next.js web app for business profiles, monitors, opportunities, analytics, settings, and the GTM Copilot
- Node + Hono API for authentication, Copilot streaming, scan execution, opportunity reads, and feedback writes
- Node worker for recurring workspace scans
- Shared Turso data model across the API, web app, and worker
- Light and dark themes with a responsive application shell

## Stack

| Technology | Purpose |
| --- | --- |
| Next.js + React + Tailwind CSS | Web application and design system |
| Node.js + Hono + TypeScript | Backend HTTP API |
| npm workspaces + Turborepo | Monorepo dependency and task management |
| Better Auth | Email/password authentication and sessions |
| Turso + Drizzle ORM | Multi-tenant application data and migrations |
| Mastra | Workspace-scoped Copilot agents and scheduled monitoring workflow |
| Google provider | Direct Gemini access for Mastra |
| Google Gen AI SDK + Zod | Structured opportunity analysis in the monitoring pipeline |

## Monorepo layout

```text
apps/
  api/                 Node + Hono backend
  web/                 Next.js web application
  worker/              Node process for scheduled monitoring
packages/
  agents/              Mastra coordinator, specialists, tools, and workflow
  auth/                Better Auth configuration
  platform/            database, collectors, analysis, and services
drizzle/                generated SQL migrations
docs/                   architecture and migration notes
```

## Local setup

Prerequisites:

- Node.js 24 (the repository includes `.node-version`)
- npm 11+
- A direct Gemini API key from Google AI Studio
- A Turso database, or `file:local.db` for local-only development

Install dependencies and create the local environment file:

```bash
npm install
cp .env.example .env
npm run db:migrate
```

Configure the required values:

```dotenv
API_PORT=4000
API_INTERNAL_URL=http://localhost:4000
WEB_ORIGINS=http://localhost:3001

BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3001

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=
```

Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`. `BETTER_AUTH_URL` is the public web origin because Next.js proxies `/api/auth/*` to Hono, keeping browser authentication same-origin.

## Start the project

Run the complete web-first stack:

```bash
npm run dev
```

This starts:

- Web app: [http://localhost:3001](http://localhost:3001)
- Hono API: [http://localhost:4000/api/health](http://localhost:4000/api/health)
- Node monitoring worker

You can also run each process separately:

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
```

Create an account, complete the business profile, review the default monitors, and use **Scan now** on the Monitors page. Qualified results appear in the web opportunity queue. The worker repeats enabled scans every twenty minutes when automated scans are enabled.

## API boundary

The Next.js app proxies these same-origin browser paths to Hono:

- `/api/auth/*` → Better Auth on Hono
- `/api/copilot` → authenticated Copilot stream
- `/api/backend/opportunities` → workspace-scoped opportunity data
- `/api/backend/monitors/scan` → on-demand scan
- `/api/backend/feedback` → opportunity feedback

Hono resolves the Better Auth session and workspace server-side before protected routes run. Clients never choose a runtime user or workspace identifier.

Some dashboard reads and form actions still execute inside Next.js during the migration window. They are listed in [the web-first migration plan](docs/web-first-migration.md) and will move behind Hono in the next slice.

## AI and automation boundaries

Mastra runs the GTM Copilot as a coordinator with scoped intelligence, monitoring, automation, and drafting specialists. The Hono route resolves the authenticated workspace and injects only the verified runtime user ID into agent tools.

Authentication, workspace authorization, billing state, CRUD operations, collection, analysis, and persistence remain deterministic application code. The standalone Node worker schedules monitoring every twenty minutes with bounded concurrency, exponential retries, and database-backed run claims to avoid duplicate work during replays or deployment overlap.

Collectors currently cover Reddit, Hacker News, GitHub, and RSS. All discovery is read-only. Public posting, direct messages, likes, follows, and automatic replies remain disabled.

## Useful commands

```bash
npm run typecheck
npm test
npm run build
npm run db:generate
npm run db:migrate
npm run worker
```

## Production checklist

- Use a strong production value for `BETTER_AUTH_SECRET`.
- Set the same Turso and Gemini credentials in the Hono API and worker environments.
- Set `BETTER_AUTH_URL` to the canonical public web HTTPS origin.
- Set `API_INTERNAL_URL` in the Next.js environment to the private or public Hono origin.
- Add every exact web origin to `WEB_ORIGINS`; do not use `*` with credentialed requests.
- Apply committed Drizzle migrations before serving production traffic.
- Deploy the API before the web app so proxied auth and application routes are available.
- Keep the worker as a separate long-lived Node process.
- Treat source content as untrusted and keep public posting behind explicit human approval.
