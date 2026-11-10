# Decision Register

Each decision has status **Agreed / Proposed / Unverified / Deferred**. Add a date and why it changed. **Agreed future** means direction accepted, but not scheduled for MVP.

| ID | Status | Decision | Rationale / caveat |
|---|---|---|---|
| D-001 | Agreed | One small self-hosted app, no Supabase | Guild hobby project; minimize cost |
| D-002 | Agreed | PostgreSQL authoritative; Google Drive evidence; Sheets reporting/import | Keep structured data correct and allow familiar reporting |
| D-003 | Agreed | Weekly member roster/GR baseline | GR changes relatively slowly, reduce event OCR cost |
| D-004 | Agreed | Mirror World total damage divided by 900s for 15-minute average DPS | Screenshot represents accumulated damage, not rate |
| D-005 | Agreed | Boss race/size/element/element level tracked | Fairer matchup-based performance interpretation |
| D-006 | Agreed | Guild League Main/Sub, DPS/Support, plus Sub Strategy | Role-aware metrics and actual UI layouts |
| D-007 | Agreed | Guild Siege K/D/A, points, damage and healing | UI exposes compound results |
| D-008 | Agreed | Attendance BEFORE/DURING/AFTER for League, Hazy Forest, Siege | Three observations capture more context; not proof alone |
| D-009 | Agreed | Member Action Center for reasons, officer notes, AFK/AWOL follow-up | Officer workflows beyond monitoring |
| D-010 | Agreed | OCR local/free first + clerk review | Lower API costs and fewer silent extraction mistakes |
| D-011 | Proposed | React/Vite/TS + Express + Drizzle + PostgreSQL, Docker Compose | Fits preferred stack and small server |
| D-012 | Superseded | Co-host on upgraded OVH Zulip VPS | Replaced by bastion/utility candidate; Zulip must remain untouched |
| D-013 | Proposed | Administrator OAuth for private Drive/Sheets integration | Avoid member-by-member Google auth |
| D-014 | Unverified | Roster `Rating` is actual `Gear Rating` | Must check game UI before using as weekly GR |
| D-015 | Unverified | Siege Emperium number's exact definition | Keep raw neutral field |
| D-016 | Unverified | Sub Strategy first minion metric label | Screenshot header overlaps |
| D-017 | Deferred | Unified cross-role performance score | Unfair and opaque until we gather data/validate methodology |
| D-018 | Proposed | Role-gated local accounts, officer-private action notes | Appropriate access without third-party auth |
| D-019 | Unverified | Guild-specific AFK/AWOL/absence thresholds | Leadership must define, never infer from online status alone |
| D-020 | Proposed | Google Sheets imports require review/diff/approval | Prevent unintended overwrite/data divergence |
| D-021 | Agreed future | Team/party planner for League and Siege | Use roster, role and likely availability; manual assignment first, auto-fill as optional suggestion |
| D-022 | Deferred | Guild Auction and Polarity Zone tools | Reference UI ideas; no confirmed Aeternum requirement or game rules yet |
| D-023 | Proposed | Prioritize Attendance + Member Action Center before complex performance OCR | Delivers immediate clerk value on top of roster/GR |
| D-024 | Agreed | Planned squad assignment does not prove event participation | Keep party planning separate from observed/confirmed attendance |

| D-025 | Proposed | Host on existing Bastion/Inspector utility VPS | User preference on 2026-11-10; 1 vCPU/~2 GB/20 GB and sensitive SSH role require suitability/security check |
| D-026 | Agreed | Yarn 4 via Corepack (node-modules linker) | Consistent package manager for React + Express; commit yarn.lock after first online install |
| D-027 | Agreed | Develop locally first; no VPS changes in foundation PR | Protect existing bastion/inspection services and allow isolated testing |

| D-028 | Agreed | Management app has officer-only accounts; no public user registration | Guild Leader, Officer and Clerk can sign in; ordinary guild members have no dashboard account |
| D-029 | Agreed | Guild Leader provisions/disables officer accounts | First leader via console bootstrap; no open signup; temporary passwords changed at first login |
| D-030 | Proposed | Password login uses Argon2id + opaque PostgreSQL-backed HttpOnly sessions | Low-cost local auth with revocation; 12-hour absolute sessions, per-IP login limits and strict origin checks |
| D-031 | Agreed | Prototype browser data must not be mistaken for shared/private server records | Login gate is UI access; migrate existing localStorage/IndexedDB data after authenticated CRUD and review exist |

## New decision template

```markdown
### D-XXX — <name> (YYYY-MM-DD)
- **Status:** Proposed / Agreed / Rejected / Superseded
- **Context:** ...
- **Choice:** ...
- **Alternatives:** ...
- **Tradeoffs and risks:** ...
- **Evidence / follow-up:** ...
```
