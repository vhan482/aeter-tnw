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

## Server-backed members and weekly GR (Phase 2B)

After signing in with an approved officer account, the default workspace is **Member Registry**, reading/writing `/api/management/members` in PostgreSQL. The original browser-local `App.tsx` prototype remains in source but is deliberately not rendered: it is not safe to confuse browser data with server-owned guild records.

The member API supports create/edit, server-side paging, member name search, stable IDs and historical name aliases. Editing is versioned to reject stale officer updates. No hard delete endpoint exists: members can be marked `LEFT`.

Each member has one weekly GR snapshot per chosen `weekStart`; **do not assume** the game roster `Rating` field is GR. A numeric GR requires an authenticated human reviewer, the source screenshot reference and a checked acknowledgment. Corrections require a reason and append to a dedicated history table. Missing GR is `NULL`, not zero.

**Legacy browser roster import:** only when the server roster is completely empty, press "Preview browser roster import" on the same browser that holds the old `tnw-guild-ops-v1` localStorage key. Inspect **all rows**, confirm that only member profiles will migrate, then import. This maps legacy IDs to new UUIDs and preserves the original browser storage. Gear, event, attendance and screenshot evidence are *not* migrated. If member names/IDs collide or the server roster is nonempty, import fails rather than silently merging characters. Export/backup the original workbook and screenshot evidence separately before any manual cleanup.

Auth, API and migration integration tests run in CI against an isolated PostgreSQL 17 service. The bastion remains out of scope until independently approved.


## Phase 3: Attendance and private officer cases (feature PR)

- Yarn remains pinned. On a fresh development PostgreSQL, apply reviewed `0003` migration with `yarn db:migrate` before starting API. **Never use `yarn db:generate` on the bastion**.
- Sidebar provides Attendance & Evidence for all authenticated staff; Member Action Center only for Guild Leader/Officer. Server also rejects Clerk requests to the private endpoints.
- Attendance events: Guild League, Hazy Forest, Guild Siege. Add Before, During, After checkpoints. Multiple screenshots per phase, each with explicit coverage flag, captured time and filename/source reference.
- Record **only** explicitly observed members as ONLINE/OFFLINE/UNKNOWN. No row means *not observed*. Even an explicit OFFLINE does not establish event absence. Correct wrong observations with versioned audit.
- Reviewed participation assessment is separate; LIKELY_ABSENT requires explicit complete-coverage offline observations in all three phases; CONFIRMED_PARTICIPATED requires recorded direct battle or officer confirmation reference.
- The Action Center is restricted to Leader/Officer. Member-reported explanations and officer comments are separate append-only notes. No automatic AFK/AWOL flag.
- No screenshot upload, OCR or private Drive storage in this phase. Do not treat filenames as proof of file existence.
- User deferred DB backup/restore. Avoid destructive migrations and explicitly acknowledge the possibility of unrecoverable loss; backup/restore remains advisable before real officer cases contain sensitive data.


## Phase 3 screenshot upload & 7-day retention (Multer, local disk)

The feature PR adds authenticated `POST /api/management/attendance/evidence` (multipart `image`), `GET .../evidence/:id/meta` and `GET .../evidence/:id/file`. Only authenticated officer accounts with completed password change can upload or view; mutating routes also require the configured exact browser `Origin`. Captured images are never served directly by Nginx.

- JPEG, PNG, WebP; 5MB maximum per file; verify both declared MIME and magic bytes. Multer **2.5.0**, not versions with 2026 multipart denial-of-service vulnerabilities.
- Private upload path `UPLOAD_DIR` (default `/var/lib/aeter/uploads`), directory mode 0700 and owned by `aeter`. Files get random UUID names; never use user-controlled paths.
- Bounded by 250MB aggregate files and 512MB minimum available disk space. This protects the 20GB bastion but is not a substitute for active disk alerts. Upload limiter: 30/hour/IP per API instance.
- 7 days after upload, HTTP image access returns 410; an hourly timer permanently removes bytes. DB metadata retains original name, SHA-256, uploader, size, MIME, timestamps and linked checkpoint. Evidence UI displays `EXPIRED`, and re-review is impossible without re-upload.
- Database metadata has no stored image bytes. Do not drop `attendance_evidence` or its references when applying migrations.
- The cleanup worker also removes unreferenced UUID-named files older than one hour (aborted/crashed uploads), never unrelated files.

### Bastion configuration after PR is merged and migrations are reviewed

**Do not deploy these instructions until CI is green and the PR is reviewed.** Existing deployed Member Registry remains functional in the meantime.

```bash
sudo install -d -o aeter -g aeter -m 0700 /var/lib/aeter/uploads
sudo chmod 0700 /var/lib/aeter/uploads
```

Set `UPLOAD_DIR=/var/lib/aeter/uploads` in `/etc/aeter-tnw/api.env` (leave secrets untouched). In `/etc/systemd/system/aeter-api.service`, under `[Service]`, add:

```ini
ReadWritePaths=/var/lib/aeter/uploads
```

This is required if `ProtectSystem=strict` is set. The service must not have write permission to `/var/www/aeternum`.

Add the following two units; use a separate cleanup worker with minimal privileges instead of deleting files from each API request.

`/etc/systemd/system/aeter-evidence-cleanup.service`:

```ini
[Unit]
Description=Aeternum Screenshot Retention Cleanup
After=postgresql@17-main.service

[Service]
Type=oneshot
User=aeter
Group=aeter
WorkingDirectory=/opt/aeter-tnw/apps/api
EnvironmentFile=/etc/aeter-tnw/api.env
ExecStart=/opt/node22/bin/node /opt/aeter-tnw/apps/api/dist/cli/cleanup-evidence.js
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/aeter/uploads
UMask=0077
MemoryMax=256M
```

`/etc/systemd/system/aeter-evidence-cleanup.timer`:

```ini
[Unit]
Description=Hourly Aeternum Screenshot Expiry Sweep

[Timer]
OnCalendar=hourly
Persistent=true
RandomizedDelaySec=5m
Unit=aeter-evidence-cleanup.service

[Install]
WantedBy=timers.target
```

Run `sudo systemctl daemon-reload` and `sudo systemctl enable --now aeter-evidence-cleanup.timer`. Review `sudo systemctl list-timers --all | grep aeter`, and test one cleanup using `sudo systemctl start aeter-evidence-cleanup.service` followed by `sudo journalctl -u aeter-evidence-cleanup.service -n 30 --no-pager`. Deletion is irreversible; a retained metadata row does not restore the screenshot.

Nginx default client request limit is commonly 1MB. For the existing Aeternum virtual host only, within the `location /api/` block, set `client_max_body_size 6m;`. Verify `sudo nginx -t` before reloading; don't change other virtual hosts or bastion firewall rules.

Once deployed, verify both 401 (unauthenticated image access), 403 (missing upload origin), 413 (over 5MB), 415 (spoofed content), successful private download, 7-day expiry/410 and a successful one-shot cleanup.
