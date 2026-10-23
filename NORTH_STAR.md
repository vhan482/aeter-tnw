# Aeternum TNW — Product North Star

> **Status:** Requirements baseline / not yet implemented  
> **Updated:** 2026-10-23 (Asia/Manila)  
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

## 2. Non-negotiable principles

1. **PostgreSQL is source of truth.** Google Drive stores private screenshots; Google Sheets is controlled import/export and reporting—not a competing primary database.
2. **Evidence first.** Every extracted stat and attendance observation retains a reference to the screenshot, capture context and verification status.
3. **Review before save.** OCR proposes values; authorized clerks approve or correct them before committing final records.
4. **Never mistake unknown for zero.** Cropped leaderboards, missing roster pages and obscured values must not produce fake scores or absences.
5. **Context matters.** Compare same boss where possible; keep match opponent, stage, battlefield, class/role and weekly GR. No automatic accusations based on rankings.
6. **Fair to different roles.** Recognize DPS, tanks, supports, revivers and strategy/objective players separately; no opaque universal performance score in MVP.
7. **Simple and inexpensive.** React + Express + Postgres on existing VPS if resources permit; OCR runs locally initially; no mandatory paid AI API, Supabase, Kubernetes or microservices.
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

**Example screenshot context (historical, not automatic import):** Aeternum vs MasaraTown, Finals, 2026-10-22, Defeat; Main Aeternum 60 participants / 167 kills versus MasaraTown 60 / 954; Sub Aeternum 71 participants / 484 kills, 2 flag repairs, 0 boss kills versus opponent 83 / 985, 29 flag repairs, 4 boss kills. All examples require review before persisted as actual records.

### 3.4 Guild Siege: City Report / Guild Ranking

Capture selected **event date**, player, guild position, **K/D/A**, **Damage Taken/Healing**, **Damage/Emperium**, and **Points**. The two compound columns should be parsed into separate numeric fields **and retain original raw strings**.

- Deaths are visible; keep zero deaths as a genuine input. Display KDA ratio as `N/A (0 deaths)` and present K+A if desired, rather than infinity or a hidden custom denominator.
- Treat damage as **total**, not DPS unless valid duration is available.
- **Unverified:** the exact meaning of the second number in `Damage/Emperium`. Store it neutrally as `emperium_metric_raw/value` until confirmed—not as emperium damage or kills.
- Example source screenshot selected date **2026-10-18**, showing only five visible rows; this is a partial report, not the whole guild.
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

**Low-cost choice:** OCR initially runs **locally on the clerk machine**, not the production VPS; no mandatory paid AI API. Benchmark real OCR quality before considering paid fallbacks. Workload may include long/scrolled screenshots and multilingual usernames.

## 5. Technology & hosting

**Proposed stack (subject to implementation review):**

| Layer | Design |
|---|---|
| Web | React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| API | Express + Node.js + TypeScript + Zod |
| Database | PostgreSQL, Drizzle ORM + SQL migrations |
| Authentication | Local accounts (no Supabase Auth); server-side sessions, secure cookies |
| Evidence | Google Drive API (private), server-side administrator OAuth |
| Reporting | Google Sheets API: manual/controlled export and reviewed import |
| OCR | OpenCV + Tesseract, PaddleOCR evaluation; local processing |
| Deployment | Docker Compose, Nginx reverse proxy, HTTPS |
| Automation | GitHub Actions for lint/tests/build; conservative deploy |

**Hosting:** existing **htg-zulip OVH VPS, Singapore**, alongside Zulip; upgrades shown in panel on 2026-10-23 as **2 vCores / 8 GB RAM / 80 GB disk**. The upgrades and free headroom **are not yet verified from within the OS after reboot**.

**Deployment gates:** perform backups first; inspect current services, Docker restart policies, firewall and SSH/console recovery. Reboot only in an approved window. Check Linux sees CPU/RAM/disk (filesystem may require independent expansion); confirm Zulip, PM2, Nginx, HTTPS, firewall and other sites recover. Only then deploy Aeternum as **separate Docker Compose project/volumes/database**.

**Safety:** keep Postgres 5432 private on IPv4 **and IPv6**, application secrets outside Git, least privilege, HTTPS, backup+restore rehearsals and protected OAuth refresh credentials. No OCR-heavy background worker on the shared 2-vCore VPS at MVP stage.

**Suggested roles:** `GUILD_LEADER`, `OFFICER`, `CLERK`, `MEMBER` (final access matrix TBD). Do not expose sensitive officer comments to all roles.

## 6. Logical data entities (design targets; not migrations yet)

| Entity | Stores |
|---|---|
| `members`, `member_aliases` | Stable identity, characters, class/build, join/leave dates, position, status |
| `weekly_member_snapshots` | Member, week, verified GR, roster metadata, evidence, superseded/updated state |
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

Use sufficiently wide numeric types for billion-scale damage; `NULL` for missing, never `0`. Define uniqueness around event/member/battlefield/team and upserts only after review.

## 7. Analytics and reports

- Guild roster overview: counts, new/established players, roster movements, weekly GR history.
- Mirror World: boss-specific rankings, total damage, approximate average DPS, same-boss progression, GR vs DPS and element/race/size filters.
- Guild League: compare Main/Sub, enemy and stage, player damage, building damage, healing/revives, damage taken, KDA and strategy metrics.
- Guild Siege: KDA, points, damage, healing, damage taken and defined Emperium metric.
- Attendance: checkpoint evidence, completeness, recurring offline observations, confirmed participation and reason/action follow-up.
- Member Profile: individual chronology of GR, event contribution, attendance and **restricted** officer case history.
- Google Sheets: reviewed exports and audit-friendly reports with private notes excluded.

**Do not infer player skill purely from GR/DPS.** Different bosses, opponents, roles, uptime, buffs and objectives complicate comparison.

## 8. Delivery roadmap

| Phase | Scope | Exit criterion |
|---|---|---|
| **0 — Infra preflight** | Safe reboot / post-upgrade Zulip health; port/firewall, storage, backup review | Existing services confirmed healthy; real capacity measured |
| **1 — Foundation** | Monorepo, React, Express, private PostgreSQL, schema migrations, local credentials | App works locally; auth + CRUD + tests |
| **2 — Members** | Roster import, aliases, weekly GR, membership tracking | Weekly snapshot with validation/history |
| **3 — Mirror World** | Boss catalog, session, screenshot parsing/review, DPS & trends | Real screenshot can be reviewed/imported and charted |
| **4 — League/Siege** | Five League layouts, Siege compound columns, team context | Multi-tab merging and accurate result history |
| **5 — Attendance/Actions** | 3 checkpoints, assessments, explanations, officer notes | Audit-backed cases and attendance review |
| **6 — Integrations** | Private Drive evidence; Sheets import/export; OCR quality testing | Traceable evidence, controlled sync, recoverable backup |

Every feature must include basic validation, authorization where relevant, duplicate protection, usable UI, and sufficient tests/documentation.

## 9. Open questions and explicit uncertainties

1. Does the guild **Rating** field equal the desired **Gear Rating**?
2. What weekday/time defines the reporting week's GR baseline?
3. Complete Mirror World boss rotation, and boss race/size/element-level reference list?
4. Does 900 seconds always reflect the full Mirror World damage measurement window?
5. Exact wording of Sub battlefield's minion-related Strategy field?
6. Guild League duration if actual DPS-rate is desired?
7. What exactly is the Guild Siege `Emperium` column's second value?
8. How should we define required activity attendance, excused absence and AWOL/AFK policy?
9. Who may read officer case notes and who may export membership data?
10. Which Google account will authorize private Drive/Sheets and which scopes are needed?
11. Actual VPS resources/OS filesystem size after reboot and Zulip's steady-state load?
12. OCR accuracy with real mixed-language names and scrolling screens?

## 10. Immediate next steps

- [ ] Keep this document updated through deliberate decisions and small PRs.
- [ ] Confirm GitHub integration permissions; current read works but attempted content write returned 403.
- [ ] Backup/check/reboot the upgraded OVH host safely, then verify Zulip and live resources before adding the app.
- [ ] Confirm guild Rating vs GR and reporting week definition.
- [ ] Implement app skeleton + roster snapshots before automating complex OCR.
- [ ] Use Mirror World as the first measured extraction template; iterate through Guild League, Guild Siege, attendance.

---

**Change log**
- **2026-10-23:** Initial requirements North Star consolidated from screenshot analysis, agreed workflows, cloud integration approach and VPS planning. Documenting plans **does not mean the application has been deployed**.
