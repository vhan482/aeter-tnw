# Architecture and Deployment Boundaries

## Conceptual flow

```text
Clerk browser (React)
  -> HTTPS/Nginx
    -> Express API (auth, validation, access control)
      -> PostgreSQL (authoritative rows + history)
      -> Google Drive API (private screenshot evidence)
      -> Google Sheets API (approved reports/import preview)

Local clerk OCR worker (OpenCV/Tesseract)
  -> candidate records + confidence -> review UI -> Express API
```

The OCR helper must never need direct PostgreSQL access or shared database credentials. If using local file uploads, do not allow untrusted images to invoke arbitrary shell operations. Never let client-originated OCR data bypass API validation.

## Proposed repo layout

```text
apps/web/               React SPA
apps/api/               Express API
packages/shared/        Zod schemas and shared types
services/ocr/           Optional local OCR utility
db/migrations/           SQL/Drizzle schema changes
infra/docker/            Compose files
infra/nginx/             Nginx site config
docs/                    Operational docs
AI/                      Agent instructions/context
```

## Deployment model

- One isolated Aeternum Compose project beside Zulip on OVH, **only after** reboot/capacity/backup checks.
- Reverse proxy for dashboard + API over HTTPS.
- API and Postgres on internal bridge network, Postgres has **no host `ports:` binding**.
- Separate DB user, volume, project, backup schedule, secrets and Compose files from Zulip.
- Resource constraints and security settings set after measuring actual memory/CPU.
- App and DB restart policies chosen/tested independently of Zulip.
- Real database backups plus **off-VPS encrypted** backups; periodic restore drill.
- Apply DB schema migrations transactionally when feasible and back up before destructive operations.

## Authentication and data access

Local accounts only: proposed Guild Leader, Officer, Clerk and Member roles. Backend checks authorization on every endpoint. Private case notes are visible only to designated officers. No public member reasoning in exported Sheets. Use CSRF protection, restricted OAuth scopes, secret encryption/rotation, bounded upload sizes and secure cookies.

## Google services

Admin-consented OAuth 2.0 on backend for personal Drive account; restrict scopes to app-use cases; never put refresh tokens in client code. Google Drive files private; store **file ID**, not public share URL, in DB. Google Sheets exports are snapshots/reports. Sheet imports require diff + approval. Retain PostgreSQL backups independently of Google Sheets.

## VPS preflight (not yet completed)

Control panel on 2026-10-23 shows OVH VPS **2 vCores, 8GB RAM, 80GB disk** (Debian 12, Singapore), shared with Zulip. A reboot was planned to reflect upgrade; **guest OS and existing service health still need verification**.

Checklist: backup/recovery; `nproc`, `free -h`, `lsblk`, `df -h /`; Docker container health/usage; Nginx, PM2, Zulip external HTTPS; IPv4/IPv6 firewall; PostgreSQL not published; disk device vs filesystem resize requirements; available resource headroom.

## Operational non-goals

No Supabase Auth, managed cloud DB, paid OCR dependency, Kubernetes, distributed queues or production autoscaling requirements for MVP.
