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
yarn db:migrate
# Terminal 1:
yarn dev:api
# Terminal 2:
yarn dev:web
```

Windows PowerShell: use `Copy-Item infra/.env.example infra/.env` and `Copy-Item apps/api/.env.example apps/api/.env` instead of `cp`. Docker Desktop should be running.

`http://127.0.0.1:3001/api/health` reports application liveness.
`http://127.0.0.1:3001/api/ready` reports PostgreSQL connectivity; returns 503 when DB is unavailable.

### Tracked dependency and migration baseline

`yarn.lock` is committed and CI installs using `yarn install --immutable`. The initial Drizzle SQL migration plus metadata are committed under `apps/api/drizzle/`. **For first-time local setup, run `yarn db:migrate` only; do not generate a new migration for an unchanged schema.** For future schema changes, run `yarn db:generate`, inspect the diff, then apply and commit migrations. Never run unreviewed migrations on a production database. No data has been migrated out of the browser prototype.

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

## Officer-only local authentication (in development)

The first Guild Leader account must be created from an interactive local terminal **after migrations**:

```bash
yarn db:migrate
yarn workspace @aeter/api bootstrap:leader guildleader
```

The bootstrap prompts for a password **without echoing it**. No passwords should be passed as CLI arguments, committed, or stored in shell history. First-account bootstrap refuses to run once any officer exists.

Open `http://127.0.0.1:5173` after starting web/API. Sign in as the bootstrapped Leader. Use **Manage officers** to add approved Officers or Clerks with temporary 12+ character passwords; they must change passwords at first sign-in. The Leader can reset or disable accounts. No public sign-up or regular-member login is available.

`APP_ORIGIN` in `apps/api/.env` must exactly equal the browser origin. Auth mutations without the matching `Origin` header are rejected. In production `APP_ORIGIN` must be HTTPS; set `NODE_ENV=production` for secure cookies behind a correctly configured HTTPS reverse proxy. No server secrets are sent to the browser.

**MVP limitation:** This wraps the existing browser-only frontend in officer authentication. The localStorage/IndexedDB data has **not yet moved into PostgreSQL** and remains present in the local browser even after signing out. Do not use shared devices or treat this phase as production-ready authorization for guild records. Secure server-backed CRUD and controlled import will follow.

### Security and deployment considerations

Officer access is API-enforced, not simply a hidden React route. There is no self-service `/register` endpoint. Management API endpoints must use the `authenticate` middleware and, for sensitive changes, explicit role checks. Expired/disabled account sessions are rejected.

- Passwords: Argon2id (19 MiB, 2 iterations, 1 lane); 12–128 character policy.
- Sessions: random 256-bit opaque cookie, only its SHA-256 digest is stored in PostgreSQL; 12-hour absolute lifetime. `HttpOnly`, `SameSite=Strict`, `Secure` in production.
- CSRF: state changes require an exact matching `Origin` equal to `APP_ORIGIN`. Do not enable wildcard CORS or weaken this to accommodate different dev URLs; instead configure the origin.
- Login rate limit: 10 attempts / 15 minutes per client IP in the API process (in-memory; not shared across processes). Behind Nginx, the API trusts only loopback-proxy forwarding headers. Keep backend access loopback/private and have the proxy set correct `X-Forwarded-For`; do not expose the API directly to the internet.
- Disabling or resetting an officer immediately deletes existing sessions. Never share credentials through the public repo, logs, or Google Sheets.
- Production requires TLS, tested reverse-proxy rules, account recovery procedures, backups, and a bastion suitability review. This branch is **local-only and not a production deployment**.

After login, the current browser-local `localStorage`/`IndexedDB` records remain on that device; signing out clears the server session but **does not erase browser-local prototype data**. Do not use shared devices or store private officer explanations in this prototype until the PostgreSQL CRUD migration is complete.
