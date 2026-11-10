# Agent Handoff / Current Project State

**Last updated:** 2026-11-10 (Asia/Manila); Yarn/API foundation branch started.

## Verified / discussed

- Repository: `vhan482/aeter-tnw` (public). GitHub read/write **verified** with documentation commits, including the initial `1620bdf4` handoff write and November 10 North Star revision.
- North Star has been cleaned up and is authoritative: `../NORTH_STAR.md`.
- Existing code is **React/Vite-only local prototype** with Members/Gear/Events/Attendance/Performance/Evidence CRUD; browser localStorage/IndexedDB; ExcelJS import/export. This is **not** a shared deployed backend.
- Legacy Supabase wording in prototype README has been removed; target is self-hosted PostgreSQL + Express, private Drive evidence and controlled Sheets reporting.
- Six core planned modules: Members/weekly GR, Mirror World, Guild League, Guild Siege, 3-checkpoint Attendance, Member Action Center.
- Future Team Planner: accepted direction from the reference UI review, **not a current MVP implementation**. Auctions and Polarity Zone **deferred**.
- Suggested delivery sequence: local foundation → weekly roster/GR → Attendance/Action Center → performance OCR/analytics → future Team Planner.
- Hosting preference changed to the Bastion/Inspector utility VPS (prior inventory: Debian 13, 1 vCPU / ~2GB / 20GB); SSH jump/inspection role requires review before web hosting. Zulip is **not** the deployment candidate. No confirmed Aeternum API/PostgreSQL deployment.

## Immediate next actions

1. Verify starter builds locally and preserve working prototype behavior.
2. Confirm guild roster `Rating` vs GR, weekly reset, and permissions for officer notes.
3. Build isolated local PostgreSQL + Express API and migrate prototype CRUD carefully.
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
