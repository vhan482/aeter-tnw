# Instructions for coding agents

Before making changes, read in this order:

1. [`NORTH_STAR.md`](NORTH_STAR.md) — product scope, business rules and important unresolved facts.
2. [`AI/AGENTS.md`](AI/AGENTS.md) — coding-agent operating rules.
3. [`AI/ARCHITECTURE.md`](AI/ARCHITECTURE.md) — architectural boundaries and security constraints.
4. [`AI/DATA_CONTRACTS.md`](AI/DATA_CONTRACTS.md) — data model, units and domain invariants.
5. [`AI/SCREENSHOT_EXTRACTION.md`](AI/SCREENSHOT_EXTRACTION.md) — ingestion and OCR rules.
6. [`AI/DECISIONS.md`](AI/DECISIONS.md), [`AI/TASKS.md`](AI/TASKS.md), [`AI/HANDOFF.md`](AI/HANDOFF.md) — decisions, backlog and current state.

**Core rule:** Do not convert assumptions into facts. Preserve screenshot provenance. Avoid expensive infrastructure, silent imports and unreviewed disciplinary automation.
