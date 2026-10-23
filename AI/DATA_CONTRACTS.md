# Data Contracts, Units and Domain Invariants

This document describes **planned** contracts, not implemented database migrations.

## Cross-cutting conventions

- `member_id` is internal/stable; display name is mutable Unicode. Store aliases and unknown-mapping review state.
- Events have `event_id`, type, event occurrence timestamps (UTC), source screenshot IDs and import reviewer.
- `captured_at` (screenshot time), `event_at` (game event time) and `imported_at` (system time) are **distinct**.
- Source values and normalized numbers are stored together (`raw_display`, `normalized_value`, `normalization_precision` or approximation flag).
- Missing value is `NULL` (unknown), **not 0**. Zero only if the UI explicitly displays zero or reviewer verifies it.
- Use `BIGINT` or suitable NUMERIC types for enormous accumulated damage; avoid 32-bit integer overflow.
- Screenshot evidence requires hash/file ID and review status. A single screenshot is allowed to support many player rows; many screenshots can support one player row.
- One member's same-event/battlefield/team stats are consolidated, with per-tab provenance.

## Weekly GR

`weekly_member_snapshots(member_id, week_start, gear_rating_nullable, source_evidence_id, verified_at, correction_history)`.

- Reporting week start configured in Asia/Manila.
- New joiners get snapshot when first observed; unknown weeks do not auto-fill with latest.
- Class/build/role context may vary over time and should be preserved when available.
- In-game roster's **Rating** field requires confirmation before mapping to `gear_rating`.

## Mirror World

```json
{
  "event_type": "MIRROR_WORLD",
  "event_date": null,
  "boss_id": null,
  "duration_seconds": 900,
  "member_id": null,
  "rank": 1,
  "damage_raw": "18.8B",
  "total_damage_estimate": 18800000000,
  "average_dps_estimate": 20888888.89,
  "weekly_gr_snapshot_id": null,
  "review_status": "PENDING"
}
```

All nulls are awaiting actual reference data; example total is **approximate**. Boss attributes: race, size, element and element level. Rate is based on full 900 seconds unless an explicitly verified duration overrides it.

## Guild League

Per match: date, opponent, stage, result. Per battlefield: MAIN/SUB, team-wide participant/kills/objectives. Per player/battlefield/team: kills, assists, deaths, **total** player damage, **total** building damage, healing, damage taken, revives; Sub optionally minion-related count, flag repairs, boss finishers, boss damage.

Unique merge key concept: `(match_id, battlefield_id, team_side, member_id)`; external enemy participants may use a separate stable external identity strategy or nullable member ID with separate source-name key.

Merge DPS + Support/Strategy by identity, **never row index**. Unknown fields nullable. KDA ratio is derived only with known K/D/A, with zero-death convention explicit. Raw game tab label `DPS` must not change data's total-damage meaning.

## Guild Siege

Fields: event/member/guild position; kills, deaths, assists; damage taken, healing, **total damage**, `emperium_metric_raw` + parsed neutral numeric value, points. Don't rename the ambiguous emperium field until semantics confirmed. KDA with zero deaths should be labelled special rather than infinite.

## Attendance

Checkpoint keys: `(event_id, checkpoint: BEFORE|DURING|AFTER, captured_at, evidence_id)`.
Observation keys: `(checkpoint_id, member_id)` with status `ONLINE|OFFLINE|UNKNOWN`.

Final assessments can be `CONFIRMED_PARTICIPATED`, `LIKELY_PRESENT`, `LIKELY_ABSENT`, `NEEDS_REVIEW`; officer outcomes `EXCUSED|UNEXCUSED|RESOLVED` are separately recorded. Store rationale and reviewer. No screenshot absence inference.

## Officer action center

Case types: `ABSENCE_FOLLOWUP|AFK_REPORT|AWOL_REVIEW|GENERAL`. Case statuses: `OPEN|AWAITING_RESPONSE|IN_REVIEW|EXCUSED|UNEXCUSED|ESCALATED|RESOLVED`. Each comment has author, timestamp, privacy/visibility. Separately store member explanation and officer determination, each with source. Immutable audit log of case transitions and amendments.

## Import/export

- Each import batch has identity, source Sheet/screenshot, proposed diff, reviewer and committed record IDs.
- Dedupe screenshot by SHA-256 and import rows by event/member/context. Idempotent retry should not duplicate records.
- CSV/Sheets output escapes formula-leading text (`=`, `+`, `-`, `@`) to protect spreadsheet viewers.
- Public shared exports omit restricted officer notes/reasons and private Drive IDs by default.
