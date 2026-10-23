# Agent Handoff / Current Project State

**Last updated:** 2026-10-23

## Verified / discussed

- Repository: `vhan482/aeter-tnw` (public; source and project documentation now present on `main`; read and write connectivity checked 2026-10-23).
- GitHub connector write test: this handoff change was committed after installing the connector for the personal repository. Keep documenting connection failures if they recur.
- Product requirements and five Guild League screenshot layouts, Mirror World leaderboard, Guild Siege report and roster screenshot were discussed; details in `../NORTH_STAR.md`.
- Infrastructure: upgraded OVH VPS panel shows 2 vCores/8GB/80GB next to running Zulip. Upgrade still needs OS-level post-reboot verification.
- No live PostgreSQL deployment, OCR engine or operational React/Express system is confirmed in this project.

## Next session checklist

1. Docs are present on GitHub. Keep this handoff and `../NORTH_STAR.md` synchronized with future decisions.
2. Verify VPS post-reboot system resources and **all Zulip/existing services**.
3. Confirm game roster `Rating` is GR and choose week start.
4. Agree minimal membership/auth access controls.
5. Bootstrap monorepo + local Compose PostgreSQL; implement member/weekly GR first.
6. Build Mirror World OCR extraction/review as first template before League/Siege/attendance.

## Rules to carry forward

- Never persist OCR without review; always attach evidence.
- Unknown is NULL, not zero, not inferred absent.
- Total damage is not automatically DPS.
- Officer reasons and AFK/AWOL judgments are private and require human confirmation.
- Avoid altering running Zulip infrastructure until upgrade checks are complete.

## Session closeout template

```markdown
### YYYY-MM-DD — <feature/session>
- Changed:
- Verified with commands/tests:
- Pending / blocked:
- Known risks:
- Next action:
```
