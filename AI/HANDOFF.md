# Agent Handoff / Current Project State

**Last updated:** 2026-11-10 (Asia/Manila); officer-only auth development branch.

## Verified / discussed

- Repository: `vhan482/aeter-tnw` (public). GitHub read/write **verified** with documentation commits, including the initial `1620bdf4` handoff write and November 10 North Star revision.
- North Star has been cleaned up and is authoritative: `../NORTH_STAR.md`.
- Existing code is **React/Vite-only local prototype** with Members/Gear/Events/Attendance/Performance/Evidence CRUD; browser localStorage/IndexedDB; ExcelJS import/export. This is **not** a shared deployed backend.
- Legacy Supabase wording in prototype README has been removed; target is self-hosted PostgreSQL + Express, private Drive evidence and controlled Sheets reporting.
- Six core planned modules: Members/weekly GR, Mirror World, Guild League, Guild Siege, 3-checkpoint Attendance, Member Action Center.
- Future Team Planner: accepted direction from the reference UI review, **not a current MVP implementation**. Auctions and Polarity Zone **deferred**.
- Suggested delivery sequence: local foundation → weekly roster/GR → Attendance/Action Center → performance OCR/analytics → future Team Planner.
- Hosting preference changed to the Bastion/Inspector utility VPS (prior inventory: Debian 13, 1 vCPU / ~2GB / 20GB); SSH jump/inspection role requires review before web hosting. Zulip is **not** the deployment candidate. PR #1 was merged on 2026-11-10 and added local-only Express health/readiness, PostgreSQL Compose, initial Drizzle schema/migration and Yarn 4 lockfile; **no production deployment**. Existing browser UI is still disconnected from the backend.

## Immediate next actions

1. Review officer-only auth PR, generated Yarn lock/migration, CI tests and server-side authorization behavior; do not merge if any check fails.
2. Confirm guild roster `Rating` vs GR, weekly reset, and permissions for officer notes.
3. Complete local auth, then connect roster CRUD with the isolated PostgreSQL API; migrate prototype browser data carefully after backup.
4. Implement roster/weekly snapshots and evidence-review flow.
5. Add BEFORE/DURING/AFTER observations and private officer action cases.
6. Add Mirror World first, then League/Siege screenshot extraction.
7. Before any VPS deploy, check bastion SSH/inspection functions, backups, available disk/RAM, access boundaries and firewall.

## Rules to carry forward

- OCR is untrusted candidate data until clerk review; every saved metric should have provenance.
- Unknown is NULL, not zero or presumed absence. Online does not prove participation.
- Mirror World values and Guild League DPS-tab values are **total damage**, not automatically DPS rate.
- Officer reasons and AFK/AWOL are private and require policy + human confirmation.
- Planned team assignments must never be treated as event participation.
- Do not modify bastion/SSH/inspection or Zulip services during local development.

## Session closeout template

```markdown
### YYYY-MM-DD — <feature/session>
- Changed:
- Verified with commands/tests:
- Pending / blocked:
- Known risks:
- Next action:
```

## Officer-only access decision (2026-11-10)

- Authorized management roles: Guild Leader, Officer and explicitly approved Clerk; no ordinary member login and no public sign-up.
- First Leader account created in a local terminal; Leader manages new accounts. Use Argon2id hashes, opaque DB sessions and strict origin checking.
- The current React screens still read browser localStorage/IndexedDB; the new sign-in gate does **not** migrate, encrypt or share this pre-existing data. Do not deploy this browser prototype for sensitive multi-user operations before the server data migration.
- No changes to bastion/utility VPS or Zulip. Hosting remains pending security review.

## Phase 2B implementation — November 10, 2026

- PR #2 **merged** at `ef595db6`, officer-only login and management accounts present on `main`.
- Next in-flight PR: `feat/server-roster-weekly-gr`, API-backed guild roster and weekly verified GR plus a reviewed one-time legacy member import.
- Legacy browser workspace intentionally **not rendered** once the new roster module is active. Its localStorage/IndexedDB remains on the old browser; never silently merge or delete evidence, gear, attendance or performance.
- Stable member UUIDs, legacy-ID mapping, character name aliases, optimistic record versions and audited GR corrections are new planned fields.
- Only the guild roster can be imported when the server roster is empty. Legacy screenshots and full record migration are **out of scope**.
- The management API must retain the authenticated Officer/Clerk gate and the temporary-password guard.
- Do not deploy or modify the Bastion/Inspector utility server before its separate security/capacity preflight.


## Phase 3 development in progress (2026-11-11)

- PR #3 merged and verified live: `aeternum.eleven22.io` exposes HTTPS, officer login, server-backed Member Registry and PostgreSQL 17 locally on the bastion.
- Phase 3 feature branch: `feat/phase3-attendance-action-center`; **do not deploy until generated SQL migration + integration CI pass and PR is reviewed**.
- New attendance types: GUILD_LEAGUE, HAZY_FOREST, GUILD_SIEGE; checkpoints BEFORE/DURING/AFTER; evidence coverage COMPLETE/PARTIAL/UNKNOWN; member statuses ONLINE/OFFLINE/UNKNOWN, no missing-row inference.
- Leader/Officer may review assessments and confidential member-action cases; CLERK records raw checkpoints only. Never automatically assign AFK, AWOL or absence dispositions.
- Screenshot/file evidence is a text reference only; no OCR or image upload in this PR.
- User opted to skip backup/restore on the personal deployment, so **warn about potential irrecoverable data loss without blocking local development**. No destructive migrations and no unapproved VPS changes.


## Screenshot retention direction — 2026-11-11

- User selected **local Multer uploads**, **7-day retention** (not Google Docs); Google Drive remains optional later.
- Upload is behind officer session + exact Origin validation. Use Multer >=2.5.0 (patched 2026 vulnerabilities), strict 5MB JPEG/PNG/WebP size/signature limits, 250MB total private storage budget, and at least 512MB free-disk buffer. No upload files under Nginx `/var/www`.
- API private evidence records store SHA-256, original name, uploader, size, MIME, upload/expiry/deletion times. Files physically removed after seven days by a **separately installed systemd hourly timer**; historical metadata/checkpoint links remain.
- On bastion: create `/var/lib/aeter/uploads` (owned by `aeter`, mode 0700); update aeter-api unit with `ReadWritePaths=/var/lib/aeter/uploads` if ProtectSystem=strict; set `UPLOAD_DIR=/var/lib/aeter/uploads` in API env; Nginx upload route limit >=6m. Install new cleanup unit/timer from docs. No live changes made during PR authoring.
- Legacy filename-only references do not create a stored image or prove file existence. OCR/Drive uploads not implemented.

## November 11, 2026 — RONW Guild Tool reference review and continuation

- User shared screenshots of external RONW Guild Management Tool: dashboard countdown, auction queue, Guild League Main/Sub team cards, League Plan, Polarity Zone, Mirror World, Siege/copying, Siege Plan multi-step maps, LOA, audit/history, settings, read-only code and Discord scheduling.
- North Star **Section 3.10** now distinguishes reference UI observations from verified TNW mechanics and Aeternum functionality. **No copied assets, credentials, member records, code, game-rule assumptions or new MVP commitments**.
- Approved-future team planning remains a separate milestone; proposed map editor and Discord are later; Auction/Polarity deferred. Manual-first assignments, reviewable auto-fill, controlled lineup import, private LOA, separate observed attendance and safe share/audit are required design boundaries.
- PR #4 confirmed **merged** in GitHub; passing isolated CI is reported on PR. Its **live deployment and acceptance tests remain unverified**. Next technical work: check live commit/migration, private image upload/expiry/timer, role separation and browser workflows before claiming Phase 3 is deployed.
- This documentation change does not authorize SSH/Nginx/systemd/production modifications. Bastion security responsibilities and deferred backups remain known risks. Job-class icon assets also remain licensing-gated and not implemented.

## Job class icon visual direction — 2026-11-11

- The North Star now includes **Section 3.9**, an agreed future class-icon registry derived from a user-provided screenshot with 38 class labels and individually downloadable WebP icons.
- Build one centralized TypeScript class-to-icon/family/color mapping. Apply it incrementally to roster, attendance, GR, performance and planned team cards. Keep job class, combat role and guild rank as separate fields.
- **Asset rights are unverified**: downloadable third-party WebP icons must not be copied into the public repo until redistribution rights are confirmed. Use original/licensed alternatives if needed. Icons are permanent static assets, **not** seven-day attendance evidence.
- Docs-only North Star enhancement was committed directly to main. No icon image files, production UI, database schema or bastion deployment were changed by this update.
- Note: Phase 3 PR #4 is now **merged** in GitHub, but its deployment to the bastion has not been verified. Older handoff text describing PR #4 as in development is historical.

## 2026-11-11 — Mirror World core development branch (not deployed)

- User redirected attention from repeated VPS release checks to core guild functionality; Phase 3 remains compiled/tested/staged on VPS but NOT activated. Do not silently migrate production or change Nginx/systemd.
- Branch `feat/mirror-world-capture-core` introduces additive `0004_mirror_world_core` schema for boss catalog, sessions, reviewed results and audit history; new API routes and React Mirror World tab, manual damage entry with optional existing private 7-day evidence upload.
- Screenshot reading/OCR is **not yet implemented**. Build a browser or local OCR candidate layer after collecting labeled real game screenshots; reject silent saves and preserve raw strings, missing rows and member matching review.
- Boss race/size/element/level may remain unknown; member IDs must come from shared roster, never row position. A 900s session computes approximate average DPS from cumulative damage, not game DPS.
- Existing `attendance_evidence` store is reused for screenshot bytes; it requires Phase 3 migration, upload directory and hourly cleanup before live deployment. No third-party assets/real guild data added.
- PR/CI must pass and the user must approve actual production rollout. Class icon registry remains separate future work.

## 2026-11-11 — Mirror World OCR candidate/review branch

- PR #5 merged at `54dc70e`: server-backed manual Mirror World boss/session/leaderboard, private attachment and audit.
- Branch `feat/mirror-ocr-review-pipeline` implements **client-only candidate processing** (pure parser + optional browser-native TextDetector), exact canonical-name/alias matching, duplicate/unknown warnings, source preview, editable rank/damage, per-row selection, explicit human approval, and server-side transactional batch save.
- No third-party OCR scripts or language data are fetched; native TextDetector availability varies by browser. A paste-from-trusted-local-OCR fallback and original manual entry remain available. **Do not claim broad browser OCR recognition yet.**
- Screenshot file bytes stay in the user's browser until final approve/save; then existing private Phase 3 upload stores one image reference for the entire result batch, with seven-day deletion. No unreviewed data enters PostgreSQL.
- Roster index/aliases are authenticated and read-only. New batch API enforces CSRF, human-reviewed flags, valid member IDs, duplicate member/rank rejection, damage validation and one SQL transaction (no partial save).
- No schema, infrastructure, npm dependency or production VPS change in this branch. CI and real image/browser benchmark remain required.

## 2026-11-11 — Cross-browser Mirror World OCR development branch

- PR #6 confirmed merged into `main` at `0cd07f3`. The human-reviewed OCR candidate UI and transactional batch save are in code, not on production VPS.
- Branch `feat/mirror-selfhosted-tesseract` adds pinned Tesseract.js 7 and English model from npm. Build script copies worker, WASM variants and language data to same-origin `public/ocr` (ignored in Git); CI checks built `dist/ocr`. Browser lazy-loads the engine after user clicks Read and never sends screenshot bytes to external OCR providers/CDNs.
- Contrast-enhanced local Canvas processing caps source image at 12 megapixels/5 MB; native TextDetector and paste-text/manual workflows remain fallback options. OCR confidence is advisory, never an approval.
- Known limitation: English model may not read non-Latin names accurately. OCR quality against real in-game screenshots has **not** been measured; request unedited varied resolution/scroll/highlighted screenshots for benchmark before broad feature acceptance.
- No GitHub PR is production deployment authorization. The bastion is still serving Phase 2B code; Phase 3 and Mirror World migrations/storage/timer are not activated. User asked to prioritize application features over more VPS deployment steps.

## 2026-11-11 — Mirror World boss context and same-boss progression (PR pending)

- PR #7 (self-hosted Tesseract browser OCR) confirmed merged into `main` at `391e239`; current user direction is to continue developing practical guild functions instead of repeatedly touching production.
- Feature branch `feat/mirror-boss-insights` adds additive migration `0005` with a boss record version and append-only officer correction history; no changes to existing reviewed damage records.
- Authenticated `PATCH /api/management/mirror-world/bosses/:id` requires Guild Leader/Officer, strict Origin/CSRF, a reason, optimistic version and audit; Clerk can read boss context but cannot edit.
- Authenticated `GET /api/management/mirror-world/insights?bossId=&memberId=` shows up to 100 reviewed results (UI: latest 40), same-boss member only. It calculates duration-aware approximate average DPS and signed run-over-run changes with BigInt-safe exact ratios, and marks the *best within the displayed window*, not an all-time best.
- Explicitly do **not** infer missed sessions as zero performance, invent members, cross-compare bosses/classes, or silently equate roster Rating with verified GR. Current boss metadata revisions do not imply all prior events were fought under that revised taxonomy.
- No VPS, systemd, Nginx, runtime deployment or production SQL changes. CI and browser acceptance gates are pending; Phase 3 upload/timer and Mirror World `0004` remain prerequisites before production rollout of `0005`.

## 2026-11-11 — Guild League reviewed capture (PR pending; no production changes)

- PR #8 merged into main at `79d7e1c`. Core Guild League feature branch `feat/guild-league-reviewed-results` now builds on the existing auth/roster/evidence foundations.
- Additive migration `0006_guild_league_core`: match metadata, per-guild-member screenshot-tab observations, immutable corrections; Drizzle snapshot and journal included.
- Guild League match: opponent guild, event instant (UTC), nullable stage and reviewed result. Main and Sub battlefields are distinct. Per-tab stats are strict-validated DPS (kills/assists/total player/building damage), Support (deaths/revives/total healing/damage taken), Sub-only Strategy (unverified minion metric, flag repairs, boss finishers, total boss damage).
- DPS/Support/Strategy screenshot rows are **never merged by visual row index**. Uniqueness is (match,battlefield,tab,canonical member ID); the GET view consolidates by (battlefield,member ID). Unknowns remain null; explicit verified zero remains zero. Damage strings retain K/M/B/T raw display and are cumulative totals, not DPS rates.
- Manual-first screenshot review UI uses optional existing private screenshot upload; requires human approval and source reference. Each correction requires a reason, optimistic record version and an append-only audit trail. One member can appear in Main and Sub independently.
- Opponent-side individual statistics, team-wide objective summaries, screenshot OCR template calibration and bulk tab import are *not* implemented. Do not infer opponents as guild members or unseen players as absentees. Real TNW League screenshot benchmark remains pending.
- New route `/api/management/league` is protected by existing officer session and Origin CSRF middleware; clerks may record and correct reviewed scores, while confidential officer cases remain separately restricted.
- Production bastion still serves older compiled release; no production SQL migrations or restart authorized. Runtime prerequisites: Phase 3 evidence storage/timer and Mirror World migrations 0004/0005 before League 0006.

## 2026-11-12 — Guild League OCR candidate batch review (feature branch; NOT DEPLOYED)

- PR #9 was confirmed merged into main as `f504cac`. Guild League now has a validated per-match/per-battlefield/per-tab manual capture model, separate provenance per screenshot tab, and audited corrections.
- Feature branch `feat/league-ocr-batch-review` adds **experimental** browser-only Tesseract screenshot OCR, text parsing and a human-reviewed batch importer across Main DPS, Main Support, Sub DPS, Sub Support and Sub Strategy (same four-field parser with explicitly selected tab-specific mappings).
- Each OCR screenshot is explicitly labeled with match, battlefield and tab by the user; no automatic screen classification, no claimed real-image accuracy. Parser only proposes lines with name plus 4 rightmost metric tokens. Wrapped/partial/obscured rows can be missed; no inference of hidden players. Source lines and original image remain visible for side-by-side correction.
- Existing local worker/WASM/English model and seven-day private evidence are reused. Screenshots stay in the browser while reading; upload occurs only after approval. English-only OCR and real screenshot calibration remain open acceptance gates.
- Candidate rows default unchecked; exact roster/alias matches are suggestions, never evidence. Unknown values stay NULL and explicit zero stays zero; weird numeric glyphs cannot be saved until corrected. Main/Sub and five tabs are never mixed within one batch.
- New authenticated `POST /api/management/league/matches/:id/tab-results/batch` allows 1–50 reviewed rows under one explicit battlefield/tab/source. Strict Zod per-tab validation, roster membership verification, duplicate-member detection, CSRF origin, and single SQL transaction/unique-key rejection prevent partial or duplicate imports.
- No schema or dependency changes and NO changes to production Bastion/Inspector VPS. Test in CI and real browser, including actual TNW screenshots and mixed sort/scroll views, before merging/activating.
