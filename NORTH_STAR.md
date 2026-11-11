# Aeternum TNW — Product North Star

> **Status:** Phase 2B running on bastion; Phase 3 code merged (deployment verification pending); WebP class icons approved as future UI work  
> **Updated:** 2026-11-11 (Asia/Manila)  
> **Repository:** https://github.com/vhan482/aeter-tnw  
> **Game:** Ragnarok: The New World (TNW)  
> **Guild:** Aeternum

## 1. Mission

Build a **cost-conscious, self-hosted guild operations and analytics dashboard** that turns Ragnarok: The New World screenshots into reviewed, traceable records. Officers should be able to answer:

- Who is in the guild, how does their weekly Gear Rating (GR) change, and who is new or established?
- Who attended Guild League, Hazy Forest and Guild Siege—and how confident are we?
- How are members contributing to Mirror World, Guild League and Guild Siege, including offense, defense, support and objectives?
- What changed week-over-week or boss-over-boss, relative to player class, build and weekly GR?
- Who needs officer follow-up for absence, AFK, suspected AWOL, or a reported explanation?

**Success means accurate historical data that saves clerks and officers time, rather than a flashy dashboard built on unreliable OCR.** This is a guild hobby project, not an enterprise platform.

## Current project baseline (verified 2026-11-11)

- **GitHub:** `vhan482/aeter-tnw`, public, `main`, with `NORTH_STAR.md`, `AGENTS.md`, and `AI/` documentation. Direct GitHub file writes were **successfully verified** by the 2026-10-23 `AI/HANDOFF.md` commit; the old 403 access issue is closed.
- **Local frontend prototype:** React/Vite/TypeScript `src/App.tsx` with basic Members, Gear, Events, Attendance, Performance and Evidence CRUD, localStorage + IndexedDB, and ExcelJS import/export. **Prototype only**; browser storage is not a shared guild database. Existing import replaces browser records after a warning.
- **Implementation status:** Yarn 4 + Express health/readiness and initial local PostgreSQL roster migrations were merged in PR #1. Officer-only authentication was merged in PR #2. **Deployed:** PR #3 PostgreSQL roster/weekly GR, officer-only login and Nginx/HTTPS on the bastion, verified from live deployment logs and browser screenshot on November 11. **Phase 3 status:** attendance, private Member Action Center and seven-day local screenshot storage code merged via PR #4; production rollout/browser verification of these modules not yet confirmed. **Not implemented:** Drive/Sheets sync, OCR, Team Planner, and WebP job icon integration.
- **Hosting:** Deployed to Debian 13 Bastion/Inspector utility VPS with native PostgreSQL 17, systemd Express and Nginx HTTPS. Existing SSH management role makes network isolation, resource monitoring, MFA/access gate and host hardening outstanding tasks. Zulip is not the hosting target.
- **Reference UI:** The RONW Guild Management Tool screenshots inspired future team planning and dashboard workflows. A further 2026-11-11 screenshot review of Auction, League, Mirror World, Polarity Zone, Siege maps, attendance, history, profile and Discord appears in Section 3.10. These are **UI observations**, not tested app behavior, validated game rules, Aeternum member data, licensed source code or proof that Aeternum ships these features.

**Delivered:** [PR #1](https://github.com/vhan482/aeter-tnw/pull/1) was merged on 2026-11-10: Yarn 4, Express health/readiness, local PostgreSQL and tracked initial roster migrations. **Delivered:** Officer-only authentication PR #2 merged 2026-11-10. **Delivered:** PR #3 merged; server-backed Member Registry and weekly GR running at https://aeternum.eleven22.io. **Merged:** [PR #4](https://github.com/vhan482/aeter-tnw/pull/4) includes Phase 3 event/checkpoint recording, officer casework and seven-day local screenshot retention. Live deployment of PR #4 is not yet verified. OCR, Google Drive integration and Sheets sync are not implemented.

**Scope convention:** Sections 3.1–3.6 are the **core planned product**. Section 3.7 is the approved-future Team Planner. Section 3.8 lists **deferred ideas**, not commitments. Section 3.9 is an **agreed visual enhancement**, not shipped functionality or approved reuse of third-party artwork. Section 3.10 is a **reference-app review and future design proposal**, not added MVP scope. Exact implementation choices remain subject to tests and user review.

## 2. Non-negotiable principles

1. **PostgreSQL is source of truth.** Google Drive stores private screenshots; Google Sheets is controlled import/export and reporting—not a competing primary database.
2. **Evidence first.** Every extracted stat and attendance observation retains a reference to the screenshot, capture context and verification status.
3. **Review before save.** OCR proposes values; authorized clerks approve or correct them before committing final records.
4. **Never mistake unknown for zero.** Cropped leaderboards, missing roster pages and obscured values must not produce fake scores or absences.
5. **Context matters.** Compare same boss where possible; keep match opponent, stage, battlefield, class/role and weekly GR. No automatic accusations based on rankings.
6. **Fair to different roles.** Recognize DPS, tanks, supports, revivers and strategy/objective players separately; no opaque universal performance score in MVP.
7. **Simple and inexpensive.** Reuse the local React prototype where sensible; add Express + PostgreSQL; co-host on existing VPS only after health/capacity checks; run OCR locally initially. No mandatory paid AI API, Supabase, Kubernetes or microservices.
8. **Security proportional to risk.** Private officer explanations, least-privilege access, no public DB port, HTTPS, secrets outside Git, auditable changes and restorable backups.
9. **Preserve history.** Weekly GR and event results are dated snapshots; changes are corrections with audit history, not destructive overwrites.

## 3. Core product modules

### 3.1 Weekly roster and GR baseline

At the **start of each guild reporting week**, the clerk captures member list screenshots and records member identity, class/role where known, online/offline state, guild position and **weekly GR**, if available.

- One weekly GR reference per member per week; all that week's events use the same verified baseline.
- Member IDs remain stable through character-name changes; track names/aliases to help OCR matching.
- Support join/leave dates, returning players, and a configurable new-versus-established threshold.
- Track weekly GR delta and percentage change; show missing GR as `NULL`/Unknown.
- A midweek significant GR change can be recorded as a verified amendment, without erasing the week's original snapshot.
- **Unverified:** the roster screenshot's **Rating** column (examples ~49,910–66,686) may or may not be the actual Gear Rating. Confirm in game before using it as GR.
- Reporting week start/timezone must be configurable; initial timezone Asia/Manila.

### 3.2 Mirror World: total damage, average DPS, bosses

One session captures **date/time, boss, rotation (if applicable), duration, screenshots and player rows**. Boss catalog fields: **name, race, size, element and element level**. Boss metadata must be editable in case the game changes.

Per visible player row: **rank, member ID/name, class icon if reliably known, accumulated damage, raw displayed damage, weekly GR snapshot reference**.

**Confirmed by user:** Mirror World leaderboard values such as `18.8B` are **accumulated total damage**, and the event normally lasts **15 minutes / 900 seconds**.

- `average_dps_estimate = normalized_total_damage / duration_seconds` (900 by default).
- Keep `18.8B` as the raw screenshot string; normalize to **approximately** 18,800,000,000 because the displayed value is rounded.
- This is **15-minute average DPS**, not necessarily active-combat DPS.
- Calculate same-boss run-to-run changes, personal bests, boss-specific trends, and GR-relative efficiency. `average_dps / GR` is exploratory, not a fair cross-class ranking.
- Use race/size/element as matchup context. Don't assume boss conditions are equivalent.
- A separate highlighted player row and skipped ranks mean the screenshot is partial; do not fabricate rank 7–13, for example.

### 3.3 Guild League: main, sub, damage, support, strategy

**One match** has opponent guild, match date, tournament stage (preliminary/semifinal/final), match result, team information, and **two battlefields** (`MAIN`, `SUB`). Each battlefield may have multiple screenshot tabs; those tabs must be **joined by player identity + match + battlefield + team, never by row position**, because sorting differs.

| Battlefield | Tab | Individual fields |
|---|---|---|
| Main | DPS | Kills, assists, **total player damage**, **total building damage** |
| Main | Support | Healing done, damage taken, deaths, revives |
| Sub | DPS | Kills, assists, **total player damage**, **total building damage** |
| Sub | Support | Healing done, damage taken, deaths, revives |
| Sub | Strategy | Minion-related count, flag repairs, boss finishers, boss damage |

**Team-wide stats** (separate from individual stats): participants, kills, and, where shown, Main towers destroyed; Sub flag repairs and boss kills. Keep opponent/team summary numbers distinct from Aeternum players.

**Metric rules:**
- The game's **DPS tab** displays **total player damage**, not a per-second rate; don't label it DPS unless duration is known and rate explicitly computed.
- Full KDA can be assembled by merging kills/assists from DPS and deaths from Support. Preserve raw K/D/A and document the chosen ratio convention; zero deaths must not cause divide-by-zero.
- Preserve screenshots of scrolled rows and deduplicate overlaps.
- Some names contain non-Latin characters; OCR/name matching must handle Unicode and low-confidence cases.
- **Unverified:** exact text/meaning of Sub Strategy's partially obscured minion heading.

Guild League analysis should be segmented by offensive output, healing/revives, damage taken/survivability, building and strategic contributions, opponent and stage, and weekly GR. Damage comparisons without matchup/role context may mislead.

### 3.4 Guild Siege: City Report / Guild Ranking

Capture selected **event date**, player, guild position, **K/D/A**, **Damage Taken/Healing**, **Damage/Emperium**, and **Points**. The two compound columns should be parsed into separate numeric fields **and retain original raw strings**.

- Deaths are visible; keep zero deaths as a genuine input. Display KDA ratio as `N/A (0 deaths)` and present K+A if desired, rather than infinity or a hidden custom denominator.
- Treat damage as **total**, not DPS unless valid duration is available.
- **Unverified:** the exact meaning of the second number in `Damage/Emperium`. Store it neutrally as `emperium_metric_raw/value` until confirmed—not as emperium damage or kills.
- Position labels such as Member, Elite or Main Command are guild roles, not player performance ranks.

### 3.5 Guild Activity Attendance: BEFORE / DURING / AFTER

Events: **Guild League, Hazy Forest, Guild Siege**. At each event, clerk captures guild roster status at **three checkpoints:** `BEFORE`, `DURING`, `AFTER`.

Every checkpoint records capture timestamp, screenshot evidence, observed member identity and status `ONLINE`, `OFFLINE` or `UNKNOWN`.

**Assessments:**
- `CONFIRMED_PARTICIPATED`: direct participation evidence (battle report or officer verification).
- `LIKELY_PRESENT`: online at relevant checkpoint(s), no independent participation proof.
- `LIKELY_ABSENT`: consistently offline in captured checkpoints, no participation evidence.
- `NEEDS_REVIEW`: mixed or incomplete screenshots, ambiguity or conflict.
- Additional officer dispositions: `EXCUSED`, `UNEXCUSED`, as later reviewed.

**Crucial:** online does not guarantee event attendance; offline at one point does not prove absence; **not visible on a screenshot never means offline**. Support multiple roster pages and coverage checks. Keep observed statuses separate from final officer judgments. Attendance rates must declare whether denominator is complete/eligible members or observations only.

### 3.6 Member Action Center

Officer queue for **absence reasons**, follow-up comments, AFK reports and AWOL concerns.

Cases should support: member, related event (optional), case type, status, original observations, reported reason/source/time, assigned officer, notes/comments, follow-up date, decision and audit history.

Suggested states: `OPEN`, `AWAITING_RESPONSE`, `IN_REVIEW`, `EXCUSED`, `UNEXCUSED`, `ESCALATED`, `RESOLVED`.

- Separate **member-reported reasons** from **officer assessments**.
- AFK and AWOL should be **officer-confirmed according to guild policy**, never auto-assigned based on simple offline screenshots.
- Preserve who wrote each note and when, with history of edits/corrections.
- Add officer handover view, outstanding cases and notes.
- **Privacy:** absence explanations/disciplinary notes are restricted to authorized officers and must **not** appear in public/shared Sheets by default.
- **Unverified:** exact AWOL thresholds, valid excuses and escalation rules; confirm with guild leadership.

### 3.7 Team and Party Planner (future milestone; not part of core MVP)

Use the existing roster, **weekly GR**, class/role, and member availability to help officers assemble and share event teams. Ideas drawn from the reference UI:

- Five-player party cards **only where the event rules confirm that size**; configurable team capacities, battlefield assignments and role requirements.
- Manual drag/drop or accessible click-to-assign, team locks, duplicate/conflict warnings, healer/role composition alerts, and an optional **suggestion-only** auto-fill mode.
- Display roster context, likely availability and reported absence, but **never convert a planned assignment into confirmed attendance**.
- Save planned rosters by event, distinguish `DRAFT` from `FINAL`, and export a safe print/share view without private officer notes.
- Proposed targets: Guild League Main/Sub and Guild Siege party organization. Polarity Zone composition is **not yet an approved module**.
- The exact squad capacities, class rules, eligibility, and conflict semantics must be confirmed before implementing auto-fill.

### 3.8 Deferred ideas (not approved for MVP)

- **Guild Auction / loot bidding:** item lots, quantity, bids, and award history. Needs actual guild demand and rules first.
- **Polarity Zone:** optional Elite Battlefield / Dungeon team planning. Confirm event rules, roster requirements and officer interest before scheduling.
- **Universal cross-role performance score:** defer; raw class/role-aware metrics are more trustworthy.
- **Live OCR AI API, full automation or advanced optimization:** defer until a local OCR benchmark demonstrates need.

### 3.9 Job class icon registry and class colors (agreed future UI enhancement)

**Reference:** The user supplied a screenshot of a job-class icon grid and noted that the icons are individually downloadable WebP images. That screenshot is a **visual/taxonomy reference**, not proof of asset licensing or a definitive in-game class roster. The reference shows **38 class labels**, including newly marked Sage, Scholar, Rogue and Stalker. Do not treat the site's "NEW" badges as our own release information without verification.

**Reference labels to support initially** (verify spelling and availability against TNW itself when building the registry):

| Visual family / suggested color | Class labels shown in reference |
|---|---|
| Swordman / red | Swordman, Knight, Lord Knight, Crusader, Paladin |
| Mage / blue | Mage, Wizard, High Wizard, Sage, Scholar |
| Archer / amber-orange | Archer, Hunter, Sniper, Bard, Clown, Dancer, Gypsy |
| Acolyte / green | Acolyte, Priest, High Priest, Monk, Champion |
| Thief / violet | Thief, Assassin, Assassin Cross, Rogue, Stalker |
| Merchant / orange | Merchant, Blacksmith, Whitesmith, Alchemist, Creator |
| Gunslinger / brown-red | Gunslinger, Rebel, Night Watch |
| Druid / teal | Druid, Kanos, Alithea |

**Design and implementation contract:**

- Store individually optimized icons as **static, version-controlled** WebP assets, e.g. `public/assets/job-icons/creator.webp`, **only after confirming the files are legally redistributable**. Being downloadable does not authorize copying into a public GitHub repository. If rights are unclear, create original compatible icons or use licensed alternatives; never hotlink private/untrusted third-party artwork.
- Use a single typed mapping, e.g. `jobClassId -> { displayName, family, iconPath, colorToken, aliases }`, with normalized/Unicode-safe lookup and a graceful **Unknown Class** fallback. The registry is presentation metadata, not an authority for member identity.
- Use consistent class-family accent colors, but never rely on color alone: include class text and accessible `alt` labels. Keep status colors (success/warning/error) separate from class colors; retain adequate contrast in the existing dark command-center theme.
- Make icons small, optimized and lazy-loaded where useful. Keep stable intrinsic dimensions to avoid roster/table layout shifts. Avoid adding 38 external network requests to unrelated pages or doing on-the-fly image processing on the low-resource bastion.
- Show class icons and names in **Member Registry, Attendance, weekly GR/member cards, Guild League/Guild Siege results, performance filters and future Team Planner slots**. Reuse the same registry throughout; don't hardcode separate paths/colors in each screen.
- **Do not infer combat role, guild rank, performance or participation from class alone.** In particular, Creator/Alchemist can have different builds; member `jobClass`, `combatRole` and `guildRole` remain independent.
- Preserve an **original Aeternum emblem** and a consistent navigation icon vocabulary. Use functional, licensed iconography for roster, event calendar, league, siege, evidence, analytics and restricted actions; do not copy another site's logo or proprietary layout wholesale.
- These permanent frontend assets are **not** attendance evidence. Never store them under `/var/lib/aeter/uploads` or subject them to the seven-day screenshot cleanup.

**Done when:** rights/licensing are reviewed; the 38 reference labels and real TNW naming differences are audited; each supported class has a tested icon/fallback and consistent responsive styling; Member Registry and Attendance render icons without regressing CRUD or screen readers. Other modules can adopt the same registry incrementally. No schema migration is required merely to render icons.

### 3.10 Detailed RONW Guild Tool review (2026-11-11) — future planning reference

**Source boundary:** Based on the user-provided screenshots, not hands-on functional testing or game documentation. The screenshots demonstrate UI patterns, not official TNW party limits, asset licenses, server capabilities or Aeternum data. Use the workflows as a reference; do **not** copy proprietary artwork, map images, logos, code or share codes.

| Module shown | Observed interface | Aeternum direction and status |
|---|---|---|
| Dashboard | Event countdown, roster summary, quick lineup navigation | Future improvement: verified roster/readiness, event calendar, outstanding authorized actions and honest empty states |
| Auction / Loot | 22 items, ordered reservations, repeat queue entries and random pick when eligible | **Deferred** until guild loot/fairness rules are explicitly approved |
| Guild League | Main 12 five-slot teams plus Sub 18 five-slot teams, leader slot, lane, member pool, filters and auto-fill | **Agreed-future Team Planner reference**, not validated in-game roster capacities |
| Guild League Plan | Lineup planning separated from battle-map placement | **Proposed** tactical editor: map positions and annotated plans are not attendance evidence |
| Polarity Zone | Elite and Dungeon lineups, up to 250 UI slots | **Deferred**; screenshot counts do not establish actual event requirements |
| Mirror World | 30 five-slot parties, healer-priority auto-fill | **Proposed future** event party planning, separate from existing *performance/total-damage* analytics |
| Siege | 30 five-slot parties; explicit 'Copy Parties from Guild League' action | Future import with preview, independent snapshot, source provenance and confirmation |
| Siege Plan | Target castle, attack/defense/custom plan, three illustrated map stages, step titles, pins/arrows/boxes/text and draggable parties | **Proposed future** multi-step tactical planning with original/licensed maps and version history |
| Attendance | Event-specific leave of absence (LOA), per-week reporting, auto-removal from planned lineups in the reference UI | **Do not clone auto-removal:** member-reported availability is separate from evidence-based participation; officer approves any replacement |
| History | Search, per-actor category changes and CSV export, with a stated latest-500-item limit | Persistent server-side role-filtered audit, with explicit retention policy; no automatic 500-record cap |
| Profile / Settings | IGN/class, leader/co-leader/member invitation, read-only view code, Discord webhook and event reminder options | Preserve **current officer-only access**; external read-only sharing and Discord are **proposed later**, pending privacy/security review |

**Forward design contract (for future Team Planner only):**

1. Reuse the canonical PostgreSQL member identities, class icon registry, independently recorded combat roles, weekly *verified* GR and explicit availability. Job class or GR never proves role, strength, or event attendance.
2. Event-scoped plan schema should support team ID/name, battlefield and lane where applicable, team leader, manually assigned slots, locks, eligibility flags, reported LOA, reserve/substitute candidates, owner and `DRAFT / REVIEWED / PUBLISHED` state. Record revisions in append-only history.
3. Build accessible mouse/touch/keyboard manual assignments first. Validate duplicate membership, unassigned/overbooked players, unavailable members and team-role gaps. Any healer requirement must be explicitly configured per event; do not infer healer solely from class icons.
4. **Suggestion-only auto-fill:** transparent ranking by approved rules/availability and role needs; never change locked teams or silently publish. Officers review all proposed changes. No opaque GR-based universal score.
5. **League-to-Siege copy:** destination roster is a dated snapshot, copied only after diff/preview/confirmation. Later changes to the source must not silently update Siege; preserve the original revision and rollback history.
6. **Tactical maps:** separate lineups from map arrangements; support multiple named/ordered stages, map reference, party markers and annotated arrows/boxes/text/pins. Store marker positions relative to the map canvas, support responsive use and audited editing. Map art must be original or licensed. These maps are not scoreboards, OCR evidence or proof of participation.
7. **LOA is not attendance.** Treat a member-submitted explanation as an availability signal with restricted reason visibility. Show a flagged lineup conflict; only an authorized officer may confirm substitution. Preserve prior lineup and keep the existing BEFORE/DURING/AFTER observations and officer-reviewed assessments independent.
8. **Safe sharing:** future printable/read-only plans must omit member reasons, officer notes, private evidence URLs, sensitive identifiers and authentication tokens. The screenshot's view-code design is **not** adopted under existing officer-only auth. Discord webhook publishing is optional later, with webhook secrets on the API only, allowlisted mentions/destinations, explicit publish confirmation, rate limits/idempotency and audit.
9. **Scheduling:** verify the game's event clock and Asia/Manila conversion independently before adopting any recurring reminder times. Preserve event instances across Monday weekly reset instead of erasing or auto-overwriting prior plans.
10. **Performance and cost:** keep UI compact with meaningful empty states, lazy-load oversized battle maps and large grids; preserve accessibility and avoid CPU-heavy automation on the sensitive small Bastion/Inspector host.

**Before implementing these future modules:** confirm actual party counts and event rules from TNW; obtain guild leader's approval of composition and substitute policy; validate read-only visibility boundaries; confirm rights to every tactical map/class asset; test mobile + keyboard UX. Auction and Polarity remain **deferred**. Nothing in this reference review changes Phase 3 release readiness or permissions.

## 4. Extraction and data workflow

1. Clerk creates or selects event/weekly snapshot with required date, boss/opponent and battlefield as appropriate.
2. Upload screenshot(s); derive hash and assign type (`MIRROR_WORLD`, `LEAGUE_MAIN_DPS`, etc.).
3. Local extractor identifies rows/regions using OpenCV plus Tesseract OCR; evaluate PaddleOCR for difficult text.
4. Normalize quantities (`K`, `M`, `B`); preserve the original display and mark normalized numbers as estimates if rounded.
5. Match OCR names to member identities, including Unicode/aliases; flag collisions and uncertain fields.
6. Show **review/edit/approve** screen. Never treat incomplete/obscured rows as absent or zero.
7. Save approved records in PostgreSQL and upload raw evidence to **private Google Drive**.
8. Export approved records/reports into Google Sheets; import sheet edits through **preview → validate/diff → approve → commit**.

Each evidence item stores file checksum, event ID, original filename, capture time (if known), Drive file ID, OCR template/version, reviewer and verification state. Per-stat provenance should be traceable.

**Low-cost choice:** OCR initially runs **locally on the clerk machine**, not the production VPS; no mandatory paid AI API. Browser-only OCR vs a local Python helper is **an implementation choice still to be tested**. Benchmark real OCR quality before considering paid fallbacks. Workload may include long/scrolled screenshots and multilingual usernames.

## 5. Technology & hosting

**Target stack (subject to implementation review; distinct from the existing React-only prototype):**

| Layer | Design |
|---|---|
| Web | React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| API | Express + Node.js + TypeScript + Zod |
| Database | PostgreSQL, Drizzle ORM + SQL migrations |
| Authentication | Local accounts (no Supabase Auth); server-side sessions, secure cookies |
| Evidence | **Current:** authenticated Multer private disk uploads, 7-day byte expiry. **Later optional:** private Google Drive API and admin OAuth |
| Reporting | Google Sheets API: manual/controlled export and reviewed import |
| OCR | OpenCV + Tesseract, PaddleOCR evaluation; local processing |
| Deployment | Docker Compose, Nginx reverse proxy, HTTPS |
| Automation | GitHub Actions for lint/tests/build; conservative deploy |
| Charts | Recharts (proposed; not in starter yet) |

**Current deployed host (verified 2026-11-11):** the existing **HTG Bastion/Inspector utility VPS**, not Zulip. Prior inventory indicates **Debian 13 / 1 vCPU / ~2 GB RAM / 20 GB disk** with SSH gateway/inspection duties. This is materially smaller and has a sensitive management role: **deployment requires a fresh capacity/security assessment and explicit approval**. Keep OCR local, do not expose PostgreSQL, and avoid weakening bastion SSH controls. Develop/test locally first. Zulip stays untouched.

**Deployment gates:** back up and inspect the actual bastion host (CPU/RAM/disk, workloads, SSH gateway role, watchdog/inspection timers, firewall, available ports, swap and recovery). Assess whether running a web app on the bastion weakens the jump-host boundary; if so, choose another isolated target. Production needs private database networking, HTTPS, separate credentials/volumes, rollback and monitoring. **Do not modify Zulip or assume bastion deployment is approved.**

**Safety:** keep Postgres 5432 private on IPv4 **and IPv6**, application secrets outside Git, least privilege, HTTPS, backup+restore rehearsals and protected OAuth refresh credentials. No OCR-heavy background worker on the shared 2-vCore VPS at MVP stage.

**Agreed access model (2026-11-10):** management app logins are **officers only**: `GUILD_LEADER`, `OFFICER`, `CLERK` (clerk is an explicitly approved guild-operations role). Ordinary guild members do **not** have management access or a self-registration path. First Guild Leader account is created securely via console/bootstrap; the Leader provisions, resets and disables officer accounts. Private explanations remain limited to authorized roles; fine-grained permissions require review before Member Action Center rollout.

## 6. Logical data entities (design targets; not migrations yet)

| Entity | Stores |
|---|---|
| `members`, `member_aliases`, `member_changes` | Stable identity, aliases, in-game role, join/leave status and audited edits |
| `weekly_gear_ratings`, `weekly_gr_corrections` | Member/week verified GR, source filename/reference, reviewer and append-only correction history |
| `bosses` | Name, race, size, element, element level; versioned corrections |
| `event_instances` | Type, start time, duration, boss/opponent/stage and capture metadata |
| `mirror_world_results` | Rank, total damage raw/normalized, approximate DPS, weekly GR FK |
| `guild_league_matches`, `league_battlefields` | Match result, teams, MAIN/SUB, team aggregate stats |
| `league_player_stats` | K/D/A, player/building damage, healing, damage taken, revives, strategy metrics |
| `siege_player_stats` | K/D/A, damage, healing, damage taken, Emperium raw, points |
| `attendance_checkpoints`, `attendance_observations` | Before/during/after image/time/member statuses |
| `attendance_assessments` | Confirmed/likely/unknown participation with rationale and overrides |
| `member_action_cases`, `action_comments`, `action_audit` | Private officer investigations, member reasons and resolution history |
| `evidence`, `import_batches` | Source images, hashes, extraction metadata, reviewed changes |
| `users`, `sessions`, `audit_log` | Auth, role access and audit tracking |
| `team_plans`, `team_plan_slots` (future) | Event-specific planned squad assignments; separate from observed participation |

Use sufficiently wide numeric types for billion-scale damage; `NULL` for missing, never `0`. Define uniqueness around event/member/battlefield/team and upserts only after review.

## 7. Analytics and reports

- Guild roster overview: counts, new/established players, roster movements, weekly GR history.
- Mirror World: boss-specific rankings, total damage, approximate average DPS, same-boss progression, GR vs DPS and element/race/size filters.
- Guild League: compare Main/Sub, enemy and stage, player damage, building damage, healing/revives, damage taken, KDA and strategy metrics.
- Guild Siege: KDA, points, damage, healing, damage taken and defined Emperium metric.
- Attendance: checkpoint evidence, completeness, recurring offline observations, confirmed participation and reason/action follow-up.
- Member Profile: individual chronology of GR, event contribution, attendance and **restricted** officer case history.
- Google Sheets: reviewed exports and audit-friendly reports with private notes excluded.
- **Future:** team/party planner view and shareable assignments, without conflating planned roster with actual participation.

**Do not infer player skill purely from GR/DPS.** Different bosses, opponents, roles, uptime, buffs and objectives complicate comparison.

## 8. Delivery roadmap (revised 2026-11-10)

**Sequence:** Local foundation → member baseline → attendance/action workflow → event performance → optional team planning. VPS preflight is a **gate before deployment**, not a blocker to local development. Google evidence/reporting work can be integrated incrementally when the core records are stable.

| Phase | Scope | Exit criterion |
|---|---|---|
| **0 — Align repo / local baseline** | Update North Star, AI backlog/decisions/handoff, correct prototype README, inspect existing code and test build | Documentation matches decisions; existing prototype understood without promising backend functionality |
| **1 — Shared foundation (local)** | Keep reusable React code; add Express/TS, PostgreSQL/Drizzle migrations, auth/roles, API validation, tests | Local API + private Postgres + web CRUD tested; no live Zulip changes |
| **2 — Members + weekly GR** | Member IDs/aliases, class/role, roster import/review, verified weekly GR, history, new/old comparison | Can create, review and retrieve a full weekly roster baseline without overwriting history |
| **3 — Attendance + Member Action Center** | BEFORE/DURING/AFTER capture, completeness, careful assessments, officer reasons/comments, audit and permissions | Real checkpoint set can be reviewed; unknown ≠ absent; sensitive explanations stay private |
| **3.5 — Class icons / UI polish (future)** | Build a licensed WebP class icon registry, family colors, reusable roster/attendance cards and consistent navigation iconography | Names/colors centrally mapped, fallback accessible, assets permission-reviewed and optimized |
| **4 — Event performance** | Mirror World first (boss metadata, 900s rate), then Guild League's five tabs and Guild Siege; evidence review and trends | Screenshots correctly map to reviewed rows, with units, duplicates and team/player separation tested |
| **5 — Team Planner (future)** | Accessible manual League/Siege lineups, reviewed copy/import, availability and composition alerts, optional suggestion-only auto-fill; separate optional tactical map steps | Saved/versioned plans do not change attendance; sensitive notes never publish; capacities and image rights verified first |
| **6 — Integrations/hardening + deployment** | Private Drive evidence, controlled Sheets import/export, local OCR benchmark, encrypted offsite backups, VPS preflight and deployment | Recovery tested, permissions enforced, existing Zulip services healthy |

**VPS pre-deployment gate:** inspect the Bastion/Inspector server's actual capacity, SSH security boundary, inspection services, backup and console access, firewall (IPv4/IPv6), and resource headroom. An isolated deployment is contingent on explicit approval; the small bastion may be unsuitable. Zulip is out of scope.

Every feature must include basic validation, authorization where relevant, duplicate protection, usable UI, and sufficient tests/documentation. The initial React-only browser demo is **not** proof these exit criteria are met.

## 9. Open questions and explicit uncertainties

1. Does the guild **Rating** field equal the desired **Gear Rating**? Do not map automatically until confirmed.
2. What weekday/time defines the reporting week's GR baseline?
3. Complete Mirror World boss rotation and boss race/size/element-level reference list?
4. Does 900 seconds always reflect the full Mirror World damage measurement window?
5. Exact wording of Sub battlefield's minion-related Strategy field?
6. Guild League duration if actual DPS-rate is desired?
7. What exactly is the Guild Siege `Emperium` column's second value?
8. How should we define required attendance, excused absence and AWOL/AFK policy? Which cases need officer approval?
9. Who may read officer case notes, edit records and export membership data?
10. Which Google account will authorize private Drive/Sheets, and what scopes are appropriate?
11. Actual VPS resources/OS filesystem size and Zulip's steady-state load before hosting Aeternum?
12. OCR accuracy with mixed-language names, alternate resolutions and scrolling screens?
13. Team planner: capacity per event, healer/class rules, competing assignments, manual overrides and whether officers want auto-fill?
14. Are Guild Auction and Polarity Zone features truly needed by Aeternum? They remain deferred.
15. Which League Main/Sub, Siege and Mirror World party counts/lanes and healer requirements are actual TNW rules, versus reference UI design?
16. Would an original/licensed multi-stage tactical map board be valuable after basic team planning?
17. How do officer-approved substitutions and reported LOA alter planned squads without changing event evidence/attendance?
18. Would future read-only plan sharing be appropriate given existing officer-only authentication, and what is never exportable?
19. Which event start times are authoritative for the game, and should Discord reminders/publishing be opt-in?

## 10. Immediate next actions

- [x] Commit North Star, agent instructions, Yarn/Express/PostgreSQL foundation and officer-only auth (PRs #1–#2).
- [x] Merge server-backed Member Registry / reviewed weekly GR (PR #3); this portion was verified at https://aeternum.eleven22.io.
- [x] Merge Phase 3 attendance/Member Action Center and 7-day private evidence code (PR #4); **live Phase 3 rollout remains unverified**.
- [x] Document the 38-class WebP design and this RONW reference screenshot review; **no third-party images were imported**.
- [ ] **Immediate release gate:** determine deployed bastion commit vs PR #4 merge; validate additive migration, officer/clerk permission checks, private upload size/signature controls, seven-day expiry/410 and hourly cleanup timer; do not modify VPS without approval.
- [ ] Complete browser acceptance of BEFORE/DURING/AFTER attendance, assessment restrictions, confidential cases, file uploads and expired evidence.
- [ ] Verify roster Rating vs GR, week reset and guild policy on private casework/exceptions.
- [ ] In a separate small UI change, develop typed class icon registry/fallbacks with licensed/original assets; never store icons in ephemeral screenshot directory.
- [ ] Next substantive metrics slice: Mirror World, then Guild League/Siege screenshot review. Keep tactical maps/auto-fill future until rules/permissions are verified.
- [ ] Review bastion disk/security/backup risk before deploying further changes; the user has deferred off-server backup work.
---

**Change log**
- **2026-11-11:** Reviewed full RONW Guild Tool screenshot tour, categorized observed modules vs future/deferred Aeternum work, and specified manual-first lineups, audited snapshots, LOA separation, map/licensing boundaries, safe sharing and Discord/clock safeguards. Refreshed Phase 3 deployment-verification checkpoint.
- **2026-11-11:** Added agreed future 38-class WebP icon registry and class-family color system from user-supplied visual reference; preserved role/GR separation, asset-licensing gate and permanent-vs-expiring file distinction. Updated Phase 3 status to merged code, not confirmed live deployment.
- **2026-11-10:** Audited against verified repository state and later reference UI discussion; closed stale GitHub 403 note; acknowledged React-only prototype; added **future** Team Planner, deferred Auction/Polarity Zone, moved Attendance/Member Actions before complex performance OCR, and moved screenshot examples out of product policy.
- **2026-10-23:** Initial requirements North Star consolidated from screenshot analysis, agreed workflows, cloud integration approach and VPS planning. Documenting plans **does not mean the application has been deployed**.


## Phase 3 implementation note — 2026-11-11

- `feat/phase3-attendance-action-center` records separate occurrence, checkpoint, explicit member observations and officer assessments. **No automatic inference of absence from missing screenshot rows.**
- Roles: Clerks may record event checkpoints and reviewed online/offline/unknown observations. Only Guild Leaders and Officers can read/write final assessment rationale and private Member Action Center cases, reports and audit history.
- Phase 3 PR #4 now includes private Multer image upload, SHA-256 metadata and seven-day retention as merged code. Its live deployment is **not verified**; OCR and Google Drive integration remain future work.
- Cases, notes and officer decisions are **manual and private**, with append-only change timelines. AWOL/AFK policy remains unverified.
- The user intentionally deferred backup/restore setup for this personal deployment. This is a risk acceptance, **not** assurance of recoverability; avoid destructive migrations and keep SSH/bastion operations untouched during feature development.


### Phase 3 screenshot retention (agreed 2026-11-11)

Use temporary local screenshot storage instead of Google Docs or immediately building Google Drive OAuth. The private upload directory is outside Nginx's web root. HTTP uploads use Multer 2.5.0 or newer patched release, 5MB/file, JPEG/PNG/WebP signature validation, ~250MB aggregate limit, and an explicit disk-space safety buffer. Authorized officers/clerks can view images only through authenticated API endpoints. Files **automatically expire seven days after upload**; an hourly cleanup service removes bytes, while event links, filenames, checksums and review records remain in PostgreSQL with an "expired" status. Filenames are not proof that an upload exists. No OCR extraction and no public direct image URL.

Privacy trade-off: loss of screenshot bytes after a week removes later re-review capability; keep this visible in the UI. User deferred database backup/restore for this personal project; therefore a VPS failure can still irreversibly lose record metadata and private casework. Google Drive can be reconsidered if longer audit retention becomes necessary.
