# Temporal Self

Temporal Self is a map-based memory journal for capturing moments by location and date, then revisiting them through timeline and recall views.

It runs as:

- Web app (React + Vite)
- PWA (web mode)
- Desktop app (Electron)

---

## For developers on GitHub

Use this section if you are **cloning the repo**, **continuing development**, or **deploying your own fork**.

### Clone and install

```bash
git clone https://github.com/<your-username>/Temporal-Self.git
cd Temporal-Self
npm install
```

Use **Node.js 20+** and **npm 10+** (matches the GitHub Actions workflow).

### Daily workflow

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server (default `http://localhost:5173`) |
| `npm run lint` | ESLint on `*.ts` / `*.tsx` — run before opening a PR |
| `npm run build` | `tsc -b` then production Vite build into `dist/` |
| `npm run preview` | Serve the production build locally |

`npm run build` runs the TypeScript project build first; fix compiler errors before relying on a green Vite-only build.

### Electron locally

- **Development**: `npm run electron:dev` — starts Vite and opens Electron against `http://localhost:5173` (DevTools enabled while `ELECTRON_DEV=1`).
- **Packaging**: `npm run electron:build` — sets `ELECTRON=1` for a relative-asset build, then runs `electron-builder`. Installers and portable builds land under `release/`.

### GitHub Pages and the `base` path

The Vite **`base`** and PWA **`start_url` / `scope`** are set to **`/Memory-Atlas/`** in `vite.config.ts`. That must match the path segment where the app is hosted.

- If your live URL is `https://<user>.github.io/Temporal-Self/`, change every `/Memory-Atlas/` in `vite.config.ts` to **`/Temporal-Self/`** (or your repo name), then rebuild.
- The workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) runs `npm ci` and `npm run build`, then uploads **`dist/`** as the Pages artifact. In the repo’s **Settings → Pages**, use **GitHub Actions** as the source (not a legacy `docs/` branch).

### Optional: `docs/` copy for manual Pages

`npm run build:pages` runs the full build and copies `dist/` into `docs/` via `scripts/copy-to-docs.cjs`. Use this only if you prefer publishing from a `docs/` folder instead of the Actions artifact; the current CI path does **not** use this script.

### Contributing

1. Create a branch from `main`.
2. Make focused changes; keep the diff scoped to the feature or fix.
3. Run `npm run lint` and `npm run build` locally.
4. Open a pull request with a short description of behavior changes.

There is **no automated test script** in `package.json` today; rely on lint, typecheck, and manual exercise of map, sidebar, recall, and export/import flows.

### Legacy vs display names

Some identifiers predate the **Temporal Self** product name. When aligning branding or forks, you may want to update these together:

| Location | Current note |
|----------|----------------|
| `package.json` → `name` | `memory-atlas` |
| `vite.config.ts` → PWA `manifest` | `name` / `short_name` may still say “Memory Atlas” |
| `vite.config.ts` → `base` / PWA paths | `/Memory-Atlas/` |

User-facing copy and the Electron window title use **Temporal Self** where updated.

---

## Core features

- **Map-first journaling**: click map to add memories with title, date, notes, location, photos, tags, links, and icon/emoji label.
- **Calendar-first history entry**: click any date in Calendar view, then add memories to that selected date.
- **Date visibility cues**: Calendar dates with memories show dot/count indicators.
- **Markdown notes**: memory notes support Markdown (GFM-style) in the editor.
- **Organization**: groups, collapse/hide groups, drag reorder, default group, starred favorites, and bulk actions.
- **Map layers and filters**: search, date filter, favorites filter, timeline path, heatmap, marker visibility toggle.
- **Drag memories on the map**: hover a memory to open its photo card, grab the top-right corner to move it; connected timeline polylines update live (Spline or Straight/orthogonal rounded corners), with a focus crosshair shown at the current drag target. Undo is captured once per drag.
- **Keyboard shortcuts** (when not typing in inputs): see list below for map controls, plus **N** new memory, **/** focus search, **Escape** close selection/modals, **Ctrl+Z** / **Ctrl+Shift+Z** undo/redo.
- **Recall practice (SM-2)**: due-based spaced repetition with session stats (`I remember` / `Show me` / skip flow).
- **Stats dashboards**:
  - General stats (totals, places, starred, photos, by year/month, date-wise memories)
  - Recall stats (score, due/scheduled, cycle performance)
- **Styled screenshot export**: rounded card frame, theme-aware border/text, timestamp, timeline+markers forced on, map controls hidden.
- **PDF report generation**: branded cover with logo and timestamp, plus overview, date/group distribution, and recall analytics.
- **First-visit splash screen**: branded splash shown once per browser profile, dismiss on click.
- **Onboarding overlay**: multi-step tour (map, list/groups, calendar, stats, recall) with skip/next.
- **Right-rail controls with hover tooltips**: quick-access icons for theme/recall/reset/layers/export/import/screenshot/report/contact.
- **Research study support (Study panel)**: optional study logging in the Stats tab (participant ID + checkpoint tag + completion time) and an exportable event log for longitudinal analysis.

---

## Keyboard shortcuts

### Global controls

- `` ` `` — toggle left drawer open/collapse
- `Alt + D` — toggle dark/light theme
- `Alt + R` — start recall
- `Alt + C` — open reset dialog
- `Alt + S` — toggle timeline path style
- `Ctrl + S` — open memory search
- `Alt + P` — toggle timeline path
- `Alt + H` — toggle heatmap
- `Alt + M` — toggle markers
- `Alt + E` — open export menu
- `Alt + I` — open import file picker
- `Ctrl + I` — save map screenshot
- `Ctrl + R` — generate report
- `Shift + S` — open settings

### Navigation/editing

- `N` — create new memory at map center
- `/` — focus sidebar search field
- `Escape` — close active modal/selection
- `Ctrl + Z` / `Ctrl + Shift + Z` (`Ctrl + Y`) — undo/redo
- In notes editor: `Ctrl + E` / `Cmd + E` — toggle Preview/Edit

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
- Map tiles and fonts may be fetched from third-party CDNs (see `vite.config.ts` PWA runtime caching); no personal data is sent to app servers by design.

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
- `react-markdown` + `remark-gfm` / `remark-breaks` (notes)

---

## Project structure

- `src/App.tsx` — app shell, overlays/modals, splash behavior
- `src/components/` — map, sidebar, calendar, stats, recall, controls, export/import
- `src/store/memoryStore.ts` — global state, persistence, recall/session logic, preferences
- `src/types/memory.ts` — core `Memory` / `Group` shapes (good starting point for export schema or migrations)
- `src/utils/spacedRepetition.ts` — SM-2 recall scheduling
- `src/utils/exportImport.ts` — JSON/CSV backup and restore
- `src/utils/generateReport.ts` — PDF report generator
- `src/utils/idbStorage.ts` — IndexedDB adapter and migration utilities
- `electron/main.cjs` — desktop window/app lifecycle
- `vite.config.ts` — web/electron build config and PWA setup
- `scripts/copy-to-docs.cjs` — optional `dist` → `docs` for Pages
- `scripts/electron-afterPack.cjs` — electron-builder hook

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

- `npm run dev` — start Vite dev server
- `npm run build` — TypeScript build + Vite production build
- `npm run preview` — preview production build
- `npm run lint` — run ESLint
- `npm run build:pages` — build and copy `dist` into `docs`
- `npm run electron:dev` — run Vite + Electron in development
- `npm run electron:build` — build desktop app via electron-builder

---

## Electron

```bash
npm run electron:dev
npm run electron:build
```

Artifacts are written to `release/` (including unpacked app and Windows installer/portable outputs, per `package.json` → `build`).

---

## PWA and deployment notes

- PWA is enabled only in web mode (not the Electron production build).
- Default configured base path is `/Memory-Atlas/`; **update `base`, `start_url`, and `scope` in `vite.config.ts`** if you publish under a different repository name or custom domain.
- After changing PWA settings, users may need a fresh load or cache clear to pick up the new service worker.

---

## Notes

- Branding is Temporal Self, but some internal technical identifiers still use legacy names for compatibility.
