# Screenshot Extraction Playbook

## Processing model

OCR is **candidate data**, not truth. Prefer zero-cost local computer-vision processing for known fixed UI. Use OpenCV for row detection/regions; Tesseract for text; trial PaddleOCR for difficult/Unicode names. Don't pay for a vision API until a real benchmark demonstrates need.

1. Identify screen/template, event, screenshot size and capture context.
2. Normalize image geometry; crop fixed or template-located columns; avoid avatar and class-icon overlaps.
3. Extract row text/numbers and preserve raw fields.
4. Normalize quantities (`K`, `M`, `B`), calculate estimates, and record uncertainty.
5. Match names against weekly roster + aliases; never auto-merge ambiguous names.
6. Deduplicate screenshot hashes and overlapping/scrolled rows.
7. Display editable candidates with source crops and confidence flags for clerk approval.
8. Save approved event rows, then archive source file privately in Drive.

## Known templates

| ID | Screenshot screen | Expected columns/fields | Watchouts |
|---|---|---|---|
| `MW_RANKING_V1` | Mirror World Individual Guild Ranking | Rank, member, accumulated damage | Highlighted player separate; cropped ranks; `B` units; boss not visible |
| `GL_MAIN_DPS_V1` | Guild League Main / DPS | Member, kill, assist, player damage, building damage | Both teams on full screen; sorting changes; total damage, not DPS |
| `GL_MAIN_SUPPORT_V1` | Guild League Main / Support | Member, healing, damage taken, deaths, revives | Sorting changes; text overlaps headers |
| `GL_SUB_DPS_V1` | Guild League Sub / DPS | Member, kill, assist, player damage, building damage | Partial rows; both teams |
| `GL_SUB_SUPPORT_V1` | Guild League Sub / Support | Member, healing, damage taken, deaths, revives | Scroll; low-opacity text |
| `GL_SUB_STRATEGY_V1` | Guild League Sub / Strategy | Member, minion count(?), flag repair, boss finisher, boss damage | First label obscured; confirm exact meaning |
| `GS_GUILD_RANKING_V1` | Guild Siege City Report / Guild Ranking | Date, member, position, K/D/A, damage taken/healing, damage/Emperium, points | Split compound numbers; Emperium semantics unknown; scrolling |
| `GUILD_ROSTER_V1` | Guild member list | Member, guild position, Rating, activity, online/offline | **Rating != verified GR**; all pages needed; icons/avatar occlusion |

## Required test cases

- 1 sample from each layout at a minimum, then additional real screenshots at varied scroll offsets, resolution/compression, and UI scale.
- Roster screenshots with both online and offline statuses, and multi-page coverage.
- Player names with Latin and non-Latin scripts; class icon overlay; names like visually similar lowercase-L/uppercase-I.
- Player same event appearing in multiple tabs but different sort order.
- Main vs Sub battlefield, both teams, screenshot overlap and repeated row hashes.
- Zero values vs missing values vs cropped columns; `K/M/B` and decimal rounding.
- Same screenshot imported twice; event date corrected; weekly GR not available.

## Quality metrics (collect; don't invent)

- Field-level exact match: names, ranks, statuses, K/D/A and points.
- Numeric normalization correctness and percentage of manual review.
- Duplicate prevention, wrong-member matching, wrong-team/battlefield association.
- Track per-template OCR precision on a human-labeled holdout set before enabling batch import.

## Example source cases from our discussions

- Mirror World: `kimutaku 18.8B`, `MuddyBear 18.5B`, `Vanderveen 14.3B`, and highlighted `Velorium` rank 14 `8.7B` shown while ranks 7–13 are omitted.
- Guild League Finals 2026-10-22 vs MasaraTown contains MAIN and SUB, with five distinct screenshot tab layouts.
- Guild Siege City Report dated 2026-10-18 has compound columns and restricted visible rows.
- Roster screen shows five Online rows and `Rating` values; it cannot establish how many offline members were off-screen.

**All screenshot examples are inspection reference data**, not automatically verified historical records in PostgreSQL. Do not seed any real member data without consent/review.
