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
8. Save approved event rows in PostgreSQL with source file IDs/hashes and reviewer identity. Current Phase 3 images are private local uploads with seven-day byte retention; metadata survives expiry. Drive is optional future storage, not the current active path.

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

## Mirror World OCR entry point — planned, not implemented

- Try client-side, self-hosted browser Tesseract for fixed leaderboard screenshots first; keep recognition off the 1-vCPU bastion. No external OCR provider receives raw screenshots by default.
- Use the current authenticated image endpoint for a temporary private evidence reference when a clerk chooses to upload. Actual OCR candidates should be generated from the selected local image before commit; expire bytes after seven days.
- Parse displayed `K/M/B/T` cumulative damage using exact integer arithmetic. Treat the suffix as rounded/approximate; estimate average DPS only after confirming duration (default 900 seconds).
- Preserve unmatched or ambiguous names without guessing member IDs. Resolve against current member identities and aliases, then review before saving.
- Required before shipping OCR: representative genuine Mirror World screenshots (standard/scroll/highlighted rows; mixed Latin/non-Latin names), labeled baseline, precision/error and timeout measurements on ordinary client devices.
- No automatic insert from OCR; current Mirror World core PR is manual-entry-first with private screenshot attachment.

## Phase 4 OCR candidate screen (development branch)

- Browser-only `src/lib/mirror-ocr.ts` parses recognized or manually pasted text into proposals. It does not send raw recognized text to the API. `TextDetector` is optional native/browser-dependent and should not be claimed as universally available.
- Recognize explicitly visible `rank + name + cumulative damage` lines, preserving gaps and allowing unknown rank. Test overlaps and ambiguous aliases. Candidate name matching is **exact normalized** against canonical name + prior aliases, not fuzzy.
- Officers/clerks select/edit rows and review the original local image. POST batch to the authenticated server only on explicit confirmation. The optional screenshot is uploaded once, with metadata shared by all saved rows and seven-day byte retention.
- Future mainstream browser OCR option: evaluate self-hosted Tesseract.js (worker/core/traineddata), including licensing, CPU/RAM/bundle size and zero outbound image requests. No live external code or training files are added by this branch.
- **Accuracy is unmeasured** until real user screenshots and a manually labeled comparison set are provided. Existing tests validate parsing, database constraints and review mechanics, not image-recognition quality.

## Self-hosted browser OCR engine — development branch

- Tesseract.js v7 is loaded only on demand by `src/lib/tesseract-reader.ts`; `scripts/copy-ocr-assets.mjs` copies the locked npm worker, WebAssembly variants and `eng.traineddata.gz` into `public/ocr` for the same-origin Vite build.
- The screenshot is decoded, bounded to 5 MB and 12 megapixels, optionally grayscaled/contrast enhanced, and read in the browser. No third-party runtime OCR API/CDN receives the image. Check CSP `worker-src` and `wasm-unsafe-eval` policies at deployment.
- Native TextDetector and manually pasted OCR text are fallbacks. The OCR confidence score is not evidence of correctness; all candidate rows remain unchecked and must be reviewed.
- The English-only model can misread Unicode/CJK, icons, decorated fonts, dark UI outlines and K/M/B suffixes. Keep aliases and manual correction. Do not report extraction accuracy until benchmarked on labeled original TNW screenshots.
- OCR assets are permanent application static files, **not** seven-day screenshot evidence. Screenshot bytes only go to private Aeternum storage after approved save.

## Guild League candidate batch import (2026-11-12 branch)

- Select the actual match, **MAIN** or **SUB**, and source tab **DPS**, **SUPPORT**, or Sub-only **STRATEGY** before reading. Five independent screenshot layouts share the existing local Tesseract engine; current column parsing is provisional, not calibrated.
- The parser proposes lines with a name and exactly four rightmost metric tokens in the selected tab order; it can skip wrapped rows, alternate UI scales, composite icons and partial text. Neither unseen rows nor missing tab metrics are invented. Visible rank is display-only, never an identity join key.
- Review candidates next to the original local image and raw OCR line. Roster/alias exact matches are suggestions; ambiguous/unmatched names demand manual member selection. Include boxes start unchecked. Raw text and edited values remain provisional until the reviewer explicitly confirms.
- Treat dash/unknown placeholders as `NULL` not 0; a literal 0 survives. Verify count vs cumulative amount units and DPS-tab total vs actual DPS. The Sub minion statistic remains neutrally labeled as its screenshot heading is not independently confirmed.
- On approval, optionally upload the image once to private seven-day evidence and transactionally save at most 50 selected verified tab rows; duplicate match/battlefield/tab/member identities reject the **whole batch**. No arbitrary OCR string enters an audited record without review.
- This implementation has no labeled in-game screenshot benchmark. Its parser/integration tests use synthetic text only. **Do not claim accurate screenshot-to-columns OCR yet.** Request at least one full and scrolled sample for each layout; record per-field accuracy, identity collisions and browser device memory before production use.
