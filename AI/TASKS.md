# Implementation Backlog

Use this as a working checklist; update checkboxes only after tests/verification. All work is **not started** unless explicitly checked.

## P0 — Before touching live OVH VPS
- [ ] Verify a recent recoverable backup and console/SSH access.
- [ ] Review existing Docker policies, Zulip containers, Nginx/PM2 and firewall (IPv4 + IPv6).
- [ ] Controlled reboot after resource upgrade; verify actual 2 vCores / ~8GB RAM / 80GB device/filesystem.
- [ ] Verify every existing hosted app, Zulip HTTPS, ports and baseline resource usage.
- [ ] Decide non-conflicting Nginx hostname and private container networking.

## P1 — Repository/bootstrap
- [ ] Add application files, package manager and typecheck/lint/test scripts.
- [ ] Initialize React/Vite/TS, Tailwind and shadcn/ui UI shell.
- [ ] Initialize Express/TS, health endpoint and Zod validation.
- [ ] Docker Compose for isolated PostgreSQL and API, DB migrations.
- [ ] Local authentication, role matrix and audit logging.
- [ ] GitHub Actions CI with no production secrets in logs.

## P2 — Member roster
- [ ] Confirm meaning of roster `Rating` and weekly reset day.
- [ ] Member CRUD with Unicode aliases, join date and status.
- [ ] Weekly snapshots with verified GR and editable evidence.
- [ ] Weekly GR change chart and new-versus-established member comparison.

## P3 — Mirror World
- [ ] Boss catalog with race/size/element/level.
- [ ] Event session creation: date, boss, duration.
- [ ] Fixed-row OCR candidate extraction for screenshot type.
- [ ] Clerk review, dedup, save and source evidence link.
- [ ] Same-boss total damage, 900s average DPS, GR relationship analytics.

## P4 — Guild League / Guild Siege
- [ ] Main DPS + Support; Sub DPS + Support + Strategy template extraction.
- [ ] Match context, opponent, stage, result; merge tabs per player/battlefield/team.
- [ ] Player-vs-team stat separation and zero/unknown behavior.
- [ ] Siege compound-column parser with unresolved Emperium metric neutral.
- [ ] Role-specific damage, support, defense, objectives and points trends.

## P5 — Attendance / action center
- [ ] Before/During/After roster capture and multi-page completeness check.
- [ ] Attendance inference distinct from confirmed event participation.
- [ ] Reasons, comments, officer ownership and escalation cases.
- [ ] Per-member history, case activity/audit, handover queue.
- [ ] Authorization tests preventing private explanations in member/public reporting.

## P6 — Integrations and hardening
- [ ] Private Drive integration: OAuth, upload and authorized read.
- [ ] Google Sheets export and preview/validate/diff/approve import.
- [ ] Automated post-review OCR quality benchmark and Unicode coverage.
- [ ] Encrypted external DB backups and restore drill.
- [ ] Security review, performance and deployment smoke tests.

## Definition of Done

A feature is done only with UI/API behavior, migration (if needed), server validation, authorized access, source provenance, duplicate/missing-data handling, tests and documentation updates. Mark blocked steps honestly.
