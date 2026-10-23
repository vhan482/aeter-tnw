# AI Workspace — Aeternum TNW

This directory holds **instructions and context for ChatGPT, Codex, Claude, Copilot, and human contributors**. It is not a runtime AI service and does not imply that a paid AI model is required.

| File | Purpose |
|---|---|
| `AGENTS.md` | Rules for AI-powered coding assistants and contribution workflow |
| `ARCHITECTURE.md` | Monorepo, deployment, Google integrations, reliability/security boundaries |
| `DATA_CONTRACTS.md` | Canonical domain entities, units, validation and missing-data policy |
| `SCREENSHOT_EXTRACTION.md` | Known screenshots and local OCR, review, dedup and quality checklist |
| `DECISIONS.md` | Agreed, proposed, unverified technical/product decisions and ADR log |
| `TASKS.md` | Phase backlog with checkable work and acceptance checks |
| `HANDOFF.md` | Working session checkpoint, blockers and next actions |

The root [`NORTH_STAR.md`](../NORTH_STAR.md) is the authoritative requirements source. Read it first.

For a new AI session, ask the agent to read `NORTH_STAR.md`, root `AGENTS.md`, and this directory before writing code. Update `HANDOFF.md` at the end of significant work.
