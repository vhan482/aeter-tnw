# Aeternum TNW Guild Operations — frontend prototype v0.1

React + TypeScript **local/browser-only prototype** for Ragnarok: The New World guild tracking.

> **Important:** This is not the final shared guild application. The requirements and target architecture live in [NORTH_STAR.md](NORTH_STAR.md), with AI coding instructions in [AGENTS.md](AGENTS.md) and the [AI/](AI/) folder. The current implementation does **not** contain PostgreSQL, Express, a shared login, Google integration, OCR, Member Action Center or Team Planner.

## Development foundation (Yarn)

This repo uses Yarn workspaces and a local Express/PostgreSQL foundation. Officer-only authentication is being added on a feature branch. Start with [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md). **No shared backend is deployed; the original browser prototype still stores its data locally. The new login gate does not change this.** Production hosting is now being evaluated on the Bastion/Inspector utility VPS (not Zulip), pending security and capacity review.

## Run locally

```bash
corepack enable
yarn install
yarn dev
```

Open `http://localhost:5173`. Production build: `npm run build`.

## Currently working

- Guild roster and combat roles (members have stable IDs)
- Dated equipment slot snapshots, refinements, skills, cards, runes, resonance
- Event log, per-member attendance, per-event metric records
- Screenshot evidence registry with optional image storage in this browser (IndexedDB)
- Search, add, edit, delete (referenced members/events protected against accidental removal)
- Excel `.xlsx` import and export using `ExcelJS`
- Dashboard KPIs and attendance breakdown; blanks are **not** absences

## Workflow with ChatGPT screenshots

1. Upload in-game screenshots to your ChatGPT project.
2. Extract/verify names, gear, event attendance and scoreboard data **in chat**, and update `TNW_Guild_Ops_Tracker_v1.xlsx`.
3. Click **Import Excel** in the web app. This **replaces** its existing browser data (export a backup first).
4. Review data and export .xlsx after further edits.

**Important:** ChatGPT does not automatically write screenshots or records into the locally running browser app. This MVP has no AI extraction route or server-side synchronization.

## Data model and privacy

Excel tabs: `Dashboard` (summary), `Members`, `Gear`, `Events`, `Attendance`, `Performance`, `Evidence`.

Records are persisted in browser `localStorage`; uploaded evidence images are persisted in browser `IndexedDB` **only**. Excel export contains image filename/source references but **does not embed image binaries**. Imported Excel does not transfer screenshot images. Clearing your browser storage will lose local data without a backup.

Do **not** use this local demo for shared guild access, or assume officers can see the same data. The **planned** shared deployment is a self-hosted Express/TypeScript API with PostgreSQL, local credentials/role-scoped sessions, private Google Drive evidence storage, and controlled Google Sheets import/export — **no Supabase dependency**. OCR will be local/free-first, with human review and authorization before saving. See [NORTH_STAR.md](NORTH_STAR.md) for the current delivery roadmap. The current Excel import replaces the prototype's browser records after confirmation; export a backup first.

## Reliability notes

- The import expects the tab/header names above. Matching member/event IDs is required for linked records.
- Attendance rate = `(Present + Late) / (Present + Late + Absent)`; Excused, Unconfirmed and unrecorded are excluded.
- This version does not invent cross-class DPS/performance rankings.
- Locally stored screenshot files must be backed up separately. Avoid sensitive real-world information in screenshots.
- To deploy shared access safely, do not simply publish this demo: implement authenticated backend access first.
