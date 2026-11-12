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

| D-032 | Proposed | Server-backed roster is the default officer workspace | Do not present browser-only CRUD as the shared database |
| D-033 | Proposed | One-time reviewed legacy roster-only import into an empty PostgreSQL roster | Preserve legacy-ID mapping; no automatic merging with existing members or migration of gear/evidence |
| D-034 | Proposed | Optimistic version checks and audit trails for roster and weekly GR corrections | Avoid lost edits and retroactive history loss when officers work concurrently |
| D-035 | Proposed | No inferred Gear Rating from unverified roster Rating column | GR requires an explicit reviewer acknowledgment and source filename/reference |

| D-036 | Agreed | Phase 3 captures event-specific BEFORE/DURING/AFTER screenshot observations manually before OCR | Multiple captures per phase, explicit observations only; partial visibility does not equal offline |
| D-037 | Proposed | Clerks capture raw observations; Leader/Officer alone can assess participation and access private action cases | Least privilege for personal explanations and disciplinary decisions; review with guild if permissions change |
| D-038 | Agreed | AFK/AWOL follow-up cases are opened and decided manually, never generated from online/offline indicators | Respect unverified guild policy and evidence quality |
| D-039 | Deferred by user | Off-server database backup/restore work on personal deployment | User chose to skip for now; server loss can permanently destroy attendance, cases and roster data |

| D-040 | Agreed | Attendance screenshots use private Multer upload storage on the bastion, with seven-day byte retention | Simple, no Google API/OAuth; retain checksum/metadata and event references after deleting bytes |
| D-041 | Agreed | Google Drive remains an optional later integration; Google Docs is not the media repository | Drive is purpose-built for private image objects; no immediate need for cloud integration |
| D-042 | Proposed | Private file download requires officer session, file type signature verification and server-side quotas | Limit upload abuse and prevent a small 20 GB bastion disk from filling |

| D-043 | Agreed future | Introduce a centralized class-icon/color registry for Aeternum | User-supplied reference shows 38 job labels and downloadable WebP artwork; use consistent visual families across roster/attendance/GR/league/siege/team plans, but verify actual class names and redistribution rights before committing assets; class does not determine combat role |

| D-044 | Agreed future | Reuse a single canonical roster in event-specific team plans | League/Siege composition is useful; exact game capacities/lanes still require verification |
| D-045 | Proposed future | Build separate versioned multi-step tactical maps after basic team planning | Use original/licensed map art, normalized positions, team markers and annotations |
| D-046 | Agreed principle | Reported LOA does not prove absence or automatically remove a member from an approved lineup | Flag conflicts; officer approves an audited substitution; attendance evidence stays independent |
| D-047 | Proposed later | Discord publishing/reminders via server-held webhook, approved destinations and verified event clocks | Do not leak webhook/mention secrets to browsers or auto-post without explicit approval |
| D-048 | Agreed | Maintain officer-only accounts; external read-only guild viewing is a separate future security proposal | The screenshot reference's view-code pattern is not implemented or approved for Aeternum |
| D-049 | Agreed | Reference screenshots' team counts and feature claims are observations, not game-rule proof | 12+18 League teams, 30 Siege/Mirror World parties, 250 Polarity slots need independent confirmation |
| D-050 | Proposed | Copy-preview-approve for lineup reuse across League/Siege | Snapshot provenance, independent revision history, no silent source-to-destination sync |
| D-051 | Proposed | Durable role-filtered audits and sanitized printable/shared plans | Don't import the reference's stated 500-entry cap or reveal private cases/LOA/evidence links |

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

| D-052 | Agreed implementation sequence | Prioritize useful Mirror World capture and reviewed results before further production release ceremony | Phase 3 has passed isolated build and nine integration tests; production remains on older compiled API, no live migration done |
| D-053 | Implemented on feature branch; OCR pending | Mirror World manual-first screenshot-backed results reuse authenticated 7-day local image storage; recognition returns candidate data for human review before saving | Tiny VPS should not run unbounded CPU OCR; fixed-layout browser/local OCR to be benchmarked against actual TNW screenshots; no paid service required |
| D-054 | Implemented on feature branch; browser acceptance pending | Ship the OCR engine as lazy-loaded, same-origin Tesseract.js v7 with pinned offline worker/WASM/English model assets | Keep recognition on the user's device, not bastion or paid APIs; include contrast preprocessing, memory limits and human review; validate multi-browser CSP, English-only accuracy and Unicode name handling before production |

| D-055 | Implemented on feature branch; acceptance pending | Track Mirror World boss metadata corrections with version and immutable officer audit; provide same-boss, same-member approximate DPS run-over-run insights | Keep unknown/missing rows as absent data, not zero; label best as within displayed 40-session window, do not infer unverified weekly GR or compare across boss types |

| D-056 | Implemented on feature branch; acceptance pending | Implement Guild League manual-first screenshot tab capture for Aeternum members in Main/Sub; preserve per-tab metadata, identity-based consolidation and audited corrections | Avoid false player matches across differently sorted DPS/Support/Strategy tabs; no enemy roster merge, automatic OCR, fake zeros or unsupported DPS conversion |

| D-057 | Implemented on feature branch; calibration pending | Reuse same-origin browser Tesseract for tab-aware Guild League OCR **candidate** capture, followed by mandatory reviewed atomic batch import | English-only, unbenchmarked field recognition; explicit Main/Sub + DPS/Support/Strategy labels, exact alias suggestions, no guessed rows, no external OCR service or VPS CPU load |

| D-058 | Implemented on feature branch; no real-image benchmark yet | Gate Guild League OCR calibration behind independently labeled in-game screenshots; freeze raw engine output and report exact-name recall, candidate precision, per-field matched accuracy and end-to-end coverage | Prevent synthetic fixtures or manually corrected OCR text from inflating claimed accuracy; all calibration stays local/private, no production rollout |
