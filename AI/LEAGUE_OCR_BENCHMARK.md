# Guild League OCR accuracy calibration

**Status:** tooling implemented on a development branch; no valid accuracy benchmark has been run on real *Ragnarok: The New World* Guild League result screenshots.

## Source requirements

Use original, unedited in-game screenshots (not screenshots of the Aeternum web app). For each Guild League layout:

| Template | Game screen | First sample | Additional critical sample |
| --- | --- | --- | --- |
| GL_MAIN_DPS_V1 | Main battlefield / DPS | Full player ranking | Scrolled or highlighted player |
| GL_MAIN_SUPPORT_V1 | Main battlefield / Support | Full ranking | Different sort order |
| GL_SUB_DPS_V1 | Sub battlefield / DPS | Full ranking | Low-opacity/cropped damage |
| GL_SUB_SUPPORT_V1 | Sub battlefield / Support | Full ranking | Scroll and non-Latin name |
| GL_SUB_STRATEGY_V1 | Sub battlefield / Strategy | Full ranking | Obscured minion heading |

Collect at least one screenshot per template, then expand coverage by resolution, compression, UI scale, scroll position, highlighted players, and alphabet/script. **Never fabricate missing rows or label enemy players as our own guild members.**

## How to capture diagnostic metrics

1. Start a local/dev Aeternum with the feature branch. Select a Guild League match and the exact Main/Sub battlefield + DPS/Support/Strategy tab.
2. Select the original screenshot. Click **Read screenshot locally with Tesseract**. This produces an immutable copy of the original OCR text for calibration. The regular editable OCR text area is only for the actual import review.
3. Expand **OCR accuracy lab**. Independently read the screenshot and transcribe each visible player as one row of five pipe-separated fields:

   ```text
   Player Name | metric 1 | metric 2 | metric 3 | metric 4
   Alpha | 8 | 12 | 18.8B | 1.2M
   Bravo | 0 | 2 | 5B | ?
   ```

   Use the selected tab's displayed field order. A bare `0` is a verified zero. `?` or an empty cell means unreadable/unverified and is excluded from field scoring. **Never construct ground truth by correcting OCR text**; use the actual screenshot.
4. Click **Compare original OCR with verified rows**. Observe name recall, candidate precision, per-field correctness among matched names, overall end-to-end coverage, and every mismatch or missed/unmatched player.
5. Optionally download a diagnostic JSON containing exact original OCR output, independent labels and the report. **The JSON contains character names and OCR text**; handle as private guild material and share only with authorized reviewers. The screenshot bytes are not embedded. No calibration data is posted to the API.
6. For a tuning pass, use a *separate holdout screenshot set*. Do not benchmark a parser against only the samples used to tune it.

## Interpretation

- **Player name recall** = unique exact-name OCR matches / independently labeled visible players. Alias and fuzzy matching are intentionally not counted as OCR success.
- **Candidate precision** = those matches / all parsed candidate rows. Duplicate OCR names do not earn matches.
- **Compared field accuracy** = correct displayed metric cells / labeled metric cells of matched names. High accuracy alone can hide missing players.
- **End-to-end field coverage** = correct displayed metric cells / all independently labeled visible metric cells. Missing players reduce this metric.
- **Field scores** are broken out by Kills/Assists/Player damage/Building damage, Deaths/Revives/Healing/Damage taken, or Sub Strategy's still-unverified minion-related metric/Flag repairs/Boss finishers/Boss damage.
- Numeric comparisons are case/space/comma-insensitive for formatting only. In-game display units (`K/M/B/T`) and values are preserved.
- All results are **single-sample diagnostics** until multiple annotated real screenshots have been tested. Do not imply production-grade OCR accuracy from synthetic parser tests.

## Failure-driven tuning plan

- If a player is missing, inspect text line boundaries and per-row segmentation before loosening the numeric parser.
- If names are wrong, investigate column crops, UI overlays, language model support and character-confusables; never fuzzy-write a guild member ID.
- If values shift columns, use template-specific column geometry and bounding boxes on calibrated screenshots rather than guessing from token position.
- If numbers and suffixes are wrong, preserve the raw display, flag uncertainty and require human correction; do not silently turn unknown into zero.
- If a screenshot is scrolled or partial, report only the visible source rows. Do not infer participation or reconstruct unseen ranks.
- Measure locally on desktop/mobile hardware and check worker/WASM/lang requests are same-origin with no third-party OCR traffic.

This calibration lab does not change the existing human-review + transactional batch-save security model or the seven-day private evidence policy.
