# Decision Register

Each decision has status **Agreed / Proposed / Unverified / Deferred**. Add a date and why it changed.

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
| D-012 | Proposed | Co-host on upgraded OVH Zulip VPS | Panel reports 2 vCores, 8GB RAM, 80GB; post-reboot verification pending |
| D-013 | Proposed | Administrator OAuth for private Drive/Sheets integration | Avoid member-by-member Google auth |
| D-014 | Unverified | Roster `Rating` is actual `Gear Rating` | Must check game UI before using as weekly GR |
| D-015 | Unverified | Siege Emperium number's exact definition | Keep raw neutral field |
| D-016 | Unverified | Sub Strategy first minion metric label | Screenshot header overlaps |
| D-017 | Deferred | Unified cross-role performance score | Unfair and opaque until we gather data/validate methodology |
| D-018 | Proposed | Role-gated local accounts, officer-private action notes | Appropriate access without third-party auth |
| D-019 | Unverified | Guild-specific AFK/AWOL/absence thresholds | Leadership must define, never infer from online status alone |
| D-020 | Proposed | Google Sheets imports require review/diff/approval | Prevent unintended overwrite/data divergence |

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
