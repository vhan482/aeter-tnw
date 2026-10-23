# TNW Guild Operations — v0.1

React + TypeScript web MVP for Ragnarok: The New World guild tracking.

## Run locally

```bash
npm install
npm run dev
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

Do **not** use this local demo for shared guild access, or assume guild officers can see the same data. For production, migrate to Supabase Auth + Postgres + private Storage + Row Level Security; make Postgres authoritative, treat Excel as import/export/backup, and hold OpenAI API keys only in protected server functions. Automated screenshot extraction should produce a draft validated against the current roster/event/gear schema and require clerk approval before saving. Add audit logs and scoped guild permissions.

## Reliability notes

- The import expects the tab/header names above. Matching member/event IDs is required for linked records.
- Attendance rate = `(Present + Late) / (Present + Late + Absent)`; Excused, Unconfirmed and unrecorded are excluded.
- This version does not invent cross-class DPS/performance rankings.
- Locally stored screenshot files must be backed up separately. Avoid sensitive real-world information in screenshots.
- To deploy shared access safely, do not simply publish this demo: implement authenticated backend access first.
