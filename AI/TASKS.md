# Implementation Backlog

Use this as a working checklist; update checkboxes only after tests/verification. All work is **not started** unless explicitly checked.

## Verified existing baseline (not the target backend)
- [x] React/Vite/TypeScript browser-based CRUD prototype committed (Members, Gear, Events, Attendance, Performance, Evidence).
- [x] ExcelJS import/export and localStorage/IndexedDB behavior implemented in the prototype.
- [x] Root AGENTS / North Star / AI folder committed; GitHub read/write verified with a commit.
- [x] Verify initial Yarn foundation typecheck/build/migration and API readiness in PR #1 CI.

## P0 — Planning cleanup (local work; no VPS changes)
- [x] Update North Star from October 2026 to November 2026, including the future Team Planner and deferred ideas.
- [ ] Confirm roster `Rating` vs GR and weekly reporting reset.
- [ ] Agree officer/member permissions and private export rules.
- [ ] Baseline code/test readiness, then choose incremental backend integration rather than a destructive rewrite.

## P1 — Local backend foundation
- [x] Verify CI's immutable install, migration run and API readiness smoke test for merged PR #1 (local developer setup still needs verification).
- [x] Create Yarn 4 workspace foundation, lockfile, local PostgreSQL Compose definition, API health/readiness scaffold and initial generated Drizzle migration (PR #1 merged).
- [ ] Preserve/reuse working React components as applicable; introduce Tailwind/shadcn only after checking existing behavior.
- [ ] Initialize Express/TS, health endpoint and Zod validation.
- [ ] Local Docker Compose with isolated PostgreSQL + Drizzle/SQL migrations, no public DB port.
- [ ] Review/merge officer-only authentication PR: Argon2id hashes, server-side sessions, bootstrap Leader, Leader-managed accounts, strict origin checks, login tests and audit events.
- [ ] Design per-module permission policy before exposing Member Action Center reasons or exports.
- [ ] Connect authenticated roster CRUD to API and migrate existing browser data through a reviewed import (backup/export first).
- [ ] GitHub Actions lint/typecheck/test and reproducible build.

## P2 — Member roster + weekly GR
- [ ] Unicode member identities, aliases, join/leave history, class and role.
- [ ] Weekly GR snapshot: import proposal, reviewer approval, source evidence, correction history.
- [ ] GR trend and new-versus-established member analysis.
- [ ] Enforce missing/unverified GR as NULL, not a copied or assumed value.

## P3 — Attendance / Member Action Center
- [ ] BEFORE / DURING / AFTER screenshot observations for Guild League, Hazy Forest and Guild Siege.
- [ ] Multi-page roster coverage check; unknown ≠ offline and online ≠ participation.
- [ ] Evidence-based attendance assessment and officer confirmation.
- [ ] Member-reported reasons kept separate from officer comments and decisions.
- [ ] AFK/AWOL follow-up queue, action history, role-gated privacy and handover.
- [ ] Attendance review and private export authorization tests.

## P4 — Performance screenshots (incremental)
- [ ] Mirror World first: boss catalog race/size/element/level, 900s estimate, same-boss GR comparisons.
- [ ] Guild League: Main DPS/Support, Sub DPS/Support/Strategy, match context, player-identity merging.
- [ ] Guild Siege: K/D/A, points, healing/damage and neutral Emperium metric until verified.
- [ ] Clerk OCR candidate review, duplicate detection, source provenance, missing vs zero.
- [ ] Per-role performance reporting; no opaque universal score.

## P5 — Team/Party Planner (future, after core workflows)
- [ ] Confirm event-specific team capacities, healer/role requirements and guild policies.
- [ ] Manual assignments, duplicates/conflicts, locked teams, shareable layout.
- [ ] Suggestion-only auto-fill; never infer attendance from assignments.

## P6 — Integrations, hosting and hardening
- [ ] Private Google Drive OAuth and screenshot evidence storage.
- [ ] Google Sheets approved export and diff/validate/approve import.
- [ ] Benchmark local OpenCV/Tesseract OCR accuracy on real labeled samples; PaddleOCR optional.
- [ ] Encrypted offsite PostgreSQL backups + tested restore.

### Bastion/utility VPS pre-deployment gate — do not skip
- [ ] Verify a recent restorable backup, SSH and OVH console access.
- [ ] Check bastion SSH gateway/inspection timers, Docker if present, IPv4+IPv6 firewall, ports and restart policies.
- [ ] Verify actual Debian 13 host CPU/RAM/disk/filesystem and live memory/disk headroom (prior estimate ~1 vCPU / 2GB / 20GB).
- [ ] Confirm SSH and monitoring functions remain healthy; assess whether adding a web app to a jump host is acceptable.
- [ ] Deploy separate app Compose/network/volumes/DB, HTTPS, smoke tests, rollback strategy.
- [ ] No Aeternum deploy, public port changes or live reboot without explicit operational authorization. Zulip is out of scope.

### Deferred — do not implement without a new decision
- Guild Auction / loot bidding.
- Polarity Zone planning.
- Cross-role universal performance scoring and paid AI OCR by default.

## Definition of Done

For backend-connected features, a feature is done only with UI/API behavior, migration (if needed), server validation, authorized access, source provenance, duplicate/missing-data handling, tests and documentation updates. Mark blocked steps honestly.
