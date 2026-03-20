# Temporal Self

Temporal Self is a map-based memory journal for capturing moments by location and date, then revisiting them through timeline and recall views.

It runs as:

- Web app (React + Vite)
- PWA (web mode)
- Desktop app (Electron)

---

## Core features

- **Map-first journaling**: click map to add memories with title, date, notes, location, photos, tags, links, and icon/emoji label.
- **Calendar-first history entry**: click any date in Calendar view, then add memories to that selected date.
- **Date visibility cues**: Calendar dates with memories show dot/count indicators.
- **Organization**: groups, collapse/hide groups, drag reorder, default group, starred favorites, and bulk actions.
- **Map layers and filters**: search, date filter, favorites filter, timeline path, heatmap, marker visibility toggle.
- **Recall practice (SM-2)**: due-based spaced repetition with session stats (`I remember` / `Show me` / skip flow).
- **Stats dashboards**:
  - General stats (totals, places, starred, photos, by year/month, date-wise memories)
  - Recall stats (score, due/scheduled, cycle performance)
- **Styled screenshot export**: rounded card frame, theme-aware border/text, timestamp, timeline+markers forced on, map controls hidden.
- **PDF report generation**: branded cover with logo and timestamp, plus overview, date/group distribution, and recall analytics.
- **First-visit splash screen**: branded splash shown once per browser profile, dismiss on click.
- **Right-rail controls with hover tooltips**: quick-access icons for theme/recall/reset/layers/export/import/screenshot/report/contact.
- **Research study support (Study panel)**: optional study logging in the Stats tab (participant ID + checkpoint tag + completion time) and an exportable event log for longitudinal analysis.

---

## Backup and portability

### JSON backup (recommended)

Use JSON export/import when moving data to another machine (for example a research computer).  
JSON is designed to preserve full data and app state, including:

- Memories, groups, map coordinates, dates, notes
- Images (embedded data URLs)
- Custom labels/icons, tags, links, starred
- Visibility/order/group assignment
- Recall scheduling fields and recall session history
- App preferences (theme, map view, start-location preference, sidebar width, etc.)
- Research study fields (when used):
  - `studyParticipantId` and current `studyCheckpointTag`
  - `studyCheckpointCompletedByParticipant` (per participant ID: which checkpoints were completed, and when; older backups may use the legacy flat `studyCheckpointCompletedAt`, which is merged on import)
  - `studyEvents` (append-only log of key actions like memory creation/updates, recall answers, and date-filter changes)

### CSV backup (limited)

CSV is for tabular memory data only and is **not** full-fidelity.  
It does not preserve images and many rich metadata fields.

---

## Research workflow (optional)

If you are running a longitudinal study (for example at 2 days, 2 weeks, and 40 days), you can use the optional **Study panel** inside the **Stats** tab:

1. Enter a **Participant ID** (e.g. `P01`).
2. Select the **Checkpoint** (Baseline / 2D / 2W / 40D).
3. Use the app normally (create memories, run recall practice).
4. When that checkpoint session is complete, click **Mark done**.
5. Export a **JSON** backup and analyze it externally using:
   - `studyCheckpointCompletedByParticipant` (what checkpoints were completed for each participant ID, and when)
   - `studyEvents` (the append-only event log)

---

## Privacy and storage

- No account and no backend required.
- Local persistence uses Zustand + IndexedDB (`idbStorage`).
- Includes migration from older localStorage-based persistence.

---

## Tech stack

- React 19 + TypeScript
- Vite 7
- Zustand (persist middleware)
- Leaflet + React-Leaflet + marker clustering + heatmap
- Tailwind CSS 4
- `html-to-image` + canvas post-processing (styled screenshot export)
- `jsPDF` (report generation)
- `vite-plugin-pwa` (web mode)
- Electron + electron-builder (desktop packaging)

---

## Project structure

- `src/App.tsx` - app shell, overlays/modals, splash behavior
- `src/components/` - map, sidebar, calendar, stats, recall, controls, export/import
- `src/store/memoryStore.ts` - global state, persistence, recall/session logic, preferences
- `src/utils/spacedRepetition.ts` - SM-2 recall scheduling
- `src/utils/exportImport.ts` - JSON/CSV backup and restore
- `src/utils/generateReport.ts` - PDF report generator
- `src/utils/idbStorage.ts` - IndexedDB adapter and migration utilities
- `electron/main.cjs` - desktop window/app lifecycle
- `vite.config.ts` - web/electron build config and PWA setup

---

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Run (web dev)

```bash
npm run dev
```

### Build and preview (web)

```bash
npm run build
npm run preview
```

---

## Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - TypeScript build + Vite production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint
- `npm run build:pages` - build and copy `dist` into `docs`
- `npm run electron:dev` - run Vite + Electron in development
- `npm run electron:build` - build desktop app via electron-builder

---

## Electron

```bash
npm run electron:dev
npm run electron:build
```

Artifacts are written to `release/` (including unpacked app and Windows installer/portable outputs, per config).

---

## PWA and deployment notes

- PWA is enabled only in web mode.
- Current GitHub Pages base path is `/Memory-Atlas/`.
- If publishing under a different repo/path, update `base`, `start_url`, and `scope` in `vite.config.ts`.

---

## Notes

- Branding is Temporal Self, but some internal technical identifiers still use legacy names for compatibility.
