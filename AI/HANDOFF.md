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
