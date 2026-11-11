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
- [x] Officer-only authentication merged in PR #2: Argon2id hashes, server-side sessions, bootstrap Leader, Leader-managed accounts, strict origin checks, login tests and audit events.
- [ ] Design per-module permission policy before exposing Member Action Center reasons or exports.
- [x] PR #3 merged: authenticated server-backed roster CRUD, optimistic locking, aliases and GR correction history.
- [x] PR #3 merged: reviewed, one-time legacy roster-only import (manual browser testing still needed before actual imports).
- [ ] Migrate other browser data (Gear/Events/Attendance/Performance/Evidence) through separately designed, reviewed flows; no silent import or cross-member mapping.
- [ ] GitHub Actions lint/typecheck/test and reproducible build.

## P2 — Member roster + weekly GR
- [ ] Unicode member identities, aliases, join/leave history, class and role.
- [ ] Weekly GR snapshot: import proposal, reviewer approval, source evidence, correction history.
- [ ] GR trend and new-versus-established member analysis.
- [ ] Enforce missing/unverified GR as NULL, not a copied or assumed value.

## P3 — Attendance / Member Action Center

**PR #4 merged; code exists but production/role-based browser acceptance is still unverified.** The older unchecked checklist items below require runtime confirmation before being marked complete.
- [ ] Check deployed commit and 0003 migration, private directory, Multer limits/content signatures, 401/403/410 file behavior and hourly systemd cleanup timer. No unapproved bastion changes.
- [ ] Run officer/clerk browser acceptance, verify confidential reasons/assessments are role-restricted and no availability signal is interpreted as participation.

- [ ] Phase 3 PR: BEFORE / DURING / AFTER checkpoint references and explicit reviewed ONLINE/OFFLINE/UNKNOWN observations; migration/tests pending.
- [ ] Phase 3: multiple screenshot references per phase, coverage labels; unknown ≠ offline and online ≠ participation.
- [ ] Add 7-day local image retention with private authenticated viewing, size/format limits, content signature validation, hourly cleanup timer and expiry state.
- [ ] Phase 3 PR: evidence-constrained participation assessment and officer confirmation; tests pending.
- [ ] Phase 3 PR: distinct member reports and officer notes with source/time and immutable audit.
- [ ] Phase 3 PR: manually initiated AFK/AWOL follow-up queue, audit, officer-only access and manual handover.
- [ ] Attendance review and private export authorization tests.

## P3.5 — Class icons and visual design (approved future work; not implemented)
- [ ] Verify the 38 reference class labels against actual TNW naming and expansions; support aliases and unknown classes.
- [ ] Verify WebP icon redistribution/licensing; otherwise use original or properly licensed alternatives.
- [ ] Build one typed class registry with family color tokens, accessible icon alt text, fallback, and optimized permanent static assets.
- [ ] Integrate class icon + class label in Member Registry and Attendance first; extend to weekly GR, Guild League, Guild Siege, charts and Team Planner.
- [ ] Ensure class, combat role and guild rank remain independent; images must never be written to the seven-day attendance screenshot directory.

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

## RONW Guild Tool reference review — November 11, 2026

- [x] Map user-provided screenshots to observed modules and classify future/proposed/deferred features in North Star Section 3.10; **no code or third-party assets added**.
- [ ] Verify official/current TNW team-size/arena/lane rules (League Main/Sub, Siege, Mirror World) and guild-approved class/role requirements.
- [ ] Draft event-specific team planning contracts with leader slot, roles, locks, reserve, availability/LOA conflicts, revisions and publish state.
- [ ] Implement manual, touch/keyboard-accessible assignments before suggestion-only auto-fill; human review/undo required.
- [ ] Specify preview/approve plus versioned provenance when copying League squads to Siege.
- [ ] Scope tactical-map editor independently: original/licensed art, step sequencing, normalized marker positions and audit.
- [ ] Plan sanitized print/view outputs; any Discord integration needs server-held webhook, opt-in destination, constrained mentions, idempotency and time-zone validation.
- [ ] Keep Auction and Polarity deferred and prevent public copy of any user-shared view code or identifiable details.

## P6 — Integrations, hosting and hardening
- [ ] Private Google Drive OAuth and screenshot evidence storage.
- [ ] Google Sheets approved export and diff/validate/approve import.
- [ ] Benchmark local OpenCV/Tesseract OCR accuracy on real labeled samples; PaddleOCR optional.
- [ ] Deferred by user for personal use: encrypted offsite PostgreSQL backups and tested restore. Data-loss risk remains.

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

## In progress — Mirror World functional capture (2026-11-11)
- [x] Create separate feature branch for Mirror World reviewed workflow; production VPS stays unchanged.
- [x] Add typed large-number damage normalization, approximate 900-second average, and parser tests.
- [x] Develop initial boss/session/result schema, authenticated API, edited-result audit and browser forms for manual capture.
- [ ] Verify PR CI typecheck, fresh isolated migration, integration tests and manual browser flow before merging.
- [ ] Benchmark OCR on actual in-game Mirror World ranking screenshots (including highlight row, partial/scroll views, Unicode names and cropped ranks).
- [ ] Add OCR candidate table/crops and roster alias matching; no automatic final saves, no guessed missing ranks.
- [ ] Add editable boss race/size/element-level metadata and same-boss/GR comparison reports.
- [ ] Deploy only after Phase 3 runtime migration and cleanup timer readiness; keep production isolated.

## Mirror World OCR review milestone — feature branch (2026-11-11)

- [x] Verify PR #5 merged and reuse its server-backed Mirror World sessions and private evidence uploads.
- [x] Build a deterministic OCR text-to-candidate parser with partial/highlighted rank handling, duplicate warnings and Unicode-safe strict matching.
- [x] Expose approved-member alias index and transactional reviewed-batch API; reject duplicate member/rank and ambiguous identity guesses.
- [x] Add local image preview, experimental device TextDetector hook and paste-text fallback; editable candidate review before save.
- [ ] Verify TypeScript/build/API tests in GitHub Actions; keep feature PR in draft until validated.
- [ ] Obtain unmodified genuine in-game Mirror World screenshots and benchmark accuracy / Latin+non-Latin names / scroll and highlighted rows.
- [ ] Integrate self-hosted Tesseract.js WASM/language assets for broad browser support only after bundle-size/privacy/accuracy evaluation; do not silently pull runtime code or image data from third-party CDNs.
- [ ] Browser acceptance: native detection availability, preview, manual text fallback, alias collisions, no implicit member selection on ambiguous OCR, one-upload batch save.
- [ ] Production remains unchanged. Do not activate this branch before required Phase 3 screenshot storage/migration/timer and Mirror World migration.
