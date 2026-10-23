# AI Coding Agent Instructions

## Mission

Build a maintainable, low-cost Ragnarok: The New World guild management app. Follow [`../NORTH_STAR.md`](../NORTH_STAR.md), and preserve distinctions between **agreed requirement**, **proposal**, **unverified game term** and **observed screenshot data**.

## Workflow

1. Inspect existing files/changes before editing, avoid overwriting unrelated work.
2. Identify the relevant North Star module and acceptance criteria.
3. Prefer the smallest workable change. Use modular typed functions, migrations, tests and a concise commit.
4. For schema/API edits, document nullable fields, numerical units and evidence lineage.
5. For OCR, process locally and return a **proposal for human review**; no silent data insertion.
6. Test lint/types/unit/integration cases as available. State clearly which checks ran or were blocked.
7. Update `AI/HANDOFF.md` and, when deciding a new technical direction, `AI/DECISIONS.md`.
8. Never say a file was committed/deployed unless tools verified success.

## Stack boundaries

- Frontend: React + Vite + TypeScript, Tailwind, shadcn/ui.
- Backend: Express + TypeScript, Zod, Drizzle/Postgres.
- Container deployment: Docker Compose and Nginx; no k8s/microservices for MVP.
- Local OCR using OpenCV/Tesseract first; paid APIs are an explicitly opted-in fallback.
- Drive for private screenshot storage, Sheets for controlled reporting; Postgres authoritative.

## Coding and security rules

- No credentials, real member excuses, screenshots or personal data in public GitHub commits, tests or log samples.
- No public PostgreSQL port. Do not alter Zulip containers, volumes, networks, Nginx hosts or other applications inadvertently.
- Strict API auth/authorization, private officer notes, bounded file uploads, allowed MIME types and rate limits.
- Use server-side sessions with secure/HttpOnly cookies and strong password hashing; use CSRF protection when applicable.
- Validate all incoming external spreadsheet/OCR strings. Sanitize data before exporting to Sheets to prevent formula injection (leading `=`, `+`, `-`, `@`).
- Use migration tooling; never silently drop or reinitialize production tables.
- Avoid leaking screenshots through public Google Drive links.
- Preserve raw source values and uncertainty; missing data `null`, **not 0**.
- Separate event date from screenshot capture date and import time.
- Store all event instants in UTC; display/report in Asia/Manila by default.

## Correctness rules

- Mirror World 15-min average DPS ≈ accumulated damage / 900; the screenshot number is **not** DPS.
- Guild League's DPS-tab damage is a **total** unless valid elapsed time is supplied.
- Main/Sub Guild League and DPS/Support/Strategy tabs must merge by player identity/context, not same row index.
- Screenshots can be partial; missing rows are not absentees.
- Online ≠ confirmed participation; officer/battle evidence required for confirmation.
- AFK/AWOL require officer policy/verification, never pure OCR inference.
- Roster `Rating == GR` **unconfirmed**, do not assume.
- Siege Emperium second value **unconfirmed**, preserve neutral name.

## Definition of Done

UI works + API validates + DB migration exists + authorization implemented + evidence/review path + tests pass + docs updated. For OCR modules, additionally require labeled sample benchmark and explicit handling of partial/ambiguous rows.
