# Yarn + API Foundation (local only)

**Branch:** `feat/yarn-api-foundation`. This is a foundation PR, **not a deployed guild application**.

## Prerequisites

- Node.js 22, Corepack, Docker Engine + Compose.
- Yarn pinned via the root `packageManager` field; `nodeLinker: node-modules` for existing Vite/TypeScript compatibility.
- The existing Vite frontend remains at the repository root for now. `apps/api` is the first Yarn workspace.

## Quick start

```bash
corepack enable
yarn install
cp infra/.env.example infra/.env
cp apps/api/.env.example apps/api/.env
# Set the SAME unique, local-only PostgreSQL password in both files; encode special URL characters.
yarn db:up
yarn db:generate
yarn db:migrate
# Terminal 1:
yarn dev:api
# Terminal 2:
yarn dev:web
```

Windows PowerShell: use `Copy-Item infra/.env.example infra/.env` and `Copy-Item apps/api/.env.example apps/api/.env` instead of `cp`. Docker Desktop should be running.

`http://127.0.0.1:3001/api/health` reports application liveness.
`http://127.0.0.1:3001/api/ready` reports PostgreSQL connectivity; returns 503 when DB is unavailable.

### Important first-install gate

This PR does **not** include a generated Yarn lockfile or Drizzle migration bundle, because dependencies could not be installed in the authoring environment. After first successful `yarn install`, commit `yarn.lock`; after `yarn db:generate`, inspect and commit `apps/api/drizzle/`. **Neither CI reproducibility nor DB migrations are complete until those tracked files exist.** Never generate/apply migrations on production before review. No data has been migrated out of the browser prototype.

### Security and limits

- `infra/compose.dev.yaml` publishes PostgreSQL only to **127.0.0.1:55432** on the developer machine. It is **not a production deployment file**.
- `apps/api` currently exposes only health/readiness, **no unauthenticated roster CRUD**.
- The browser prototype still stores its own records locally and is **not connected to this API**.
- Do not expose `.env`, database port, officer reasons, OAuth tokens, or guild screenshots via GitHub.
- No changes to Zulip or the Bastion/Inspector host have been made.

## Bastion/utility VPS candidate (review required)

Aeternum's new **proposed deployment candidate** is the existing HTG Bastion/Inspector utility VPS, **not the Zulip host**. Recent context describes it as Debian 13, approximately **1 vCPU / 2 GB RAM / 20 GB disk**, with SSH gateway + inspection timers. This footprint is tight; keep OCR off-server, measure actual disk/RAM and existing task load first, and make a separate security decision about hosting a web app on an SSH bastion. Do not open 5432 or alter its SSH/firewall setup casually. If this host is genuinely a jump host, prefer isolating public web ingress from its management role. Production placement stays **unapproved pending preflight**.

## Suggested validation

```bash
yarn typecheck
yarn test
yarn build
docker compose --env-file infra/.env -f infra/compose.dev.yaml config
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3001/api/ready
```

## Next implementation slice

Define local account sessions and role permissions, then wire the roster and weekly Gear Rating API. Do **not** translate guild roster's unverified `Rating` into GR.
