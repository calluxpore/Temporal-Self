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

### Dependencies to install (development)
`npm install` installs both runtime dependencies and dev dependencies listed in `package.json`.

Runtime dependencies:
- `@tailwindcss/postcss@^4.1.18`
- `@turf/buffer@^7.3.4`
- `@turf/distance@^7.3.4`
- `@turf/helpers@^7.3.4`
- `@turf/union@^7.3.4`
- `d3-contour@^4.0.2`
- `emoji-picker-react@^4.18.0`
- `exifr@^7.1.3`
- `heic2any@^0.0.4`
- `html-to-image@^1.11.13`
- `html2canvas@^1.4.1`
- `jspdf@^4.2.1`
- `leaflet@^1.9.4`
- `leaflet-compass@^1.5.6`
- `leaflet-rotate@^0.2.8`
- `leaflet.heat@^0.2.0`
- `react@^19.2.0`
- `react-dom@^19.2.0`
- `react-leaflet@^5.0.0`
- `react-leaflet-cluster@^4.0.0`
- `react-markdown@^10.1.0`
- `remark-breaks@^4.0.0`
- `remark-gfm@^4.0.1`
- `zustand@^5.0.11`

Dev dependencies:
- `@eslint/js@^9.39.1`
- `@types/d3-contour@^3.0.6`
- `@types/leaflet@^1.9.21`
- `@types/leaflet.heat@^0.2.5`
- `@types/node@^24.10.1`
- `@types/react@^19.2.7`
- `@types/react-dom@^19.2.3`
- `@vitejs/plugin-react@^5.1.1`
- `autoprefixer@^10.4.24`
- `concurrently@^9.1.0`
- `cross-env@^7.0.3`
- `electron@^33.2.0`
- `electron-builder@^25.1.8`
- `eslint@^9.39.1`
- `eslint-plugin-react-hooks@^7.0.1`
- `eslint-plugin-react-refresh@^0.4.24`
- `globals@^16.5.0`
- `postcss@^8.5.6`
- `rcedit@^5.0.2`
- `tailwindcss@^4.1.18`
- `typescript@~5.9.3`
- `typescript-eslint@^8.48.0`
- `vite@^7.3.1`
- `vite-plugin-pwa@^1.2.0`
- `wait-on@^8.0.1`

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

The Vite **`base`** and PWA **`start_url` / `scope`** are set to **`/Temporal-Self/`** in `vite.config.ts` (default repo name). They must match the path segment where the app is hosted.

- If your live URL uses a different path (e.g. `https://<user>.github.io/MyFork/`), change every **`/Temporal-Self/`** in `vite.config.ts` to your segment, then rebuild.
- The workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) runs `npm ci` and `npm run build`, then uploads **`dist/`** as the Pages artifact. In the repo’s **Settings → Pages**, use **GitHub Actions** as the source (not a legacy `docs/` branch).

### Optional: `docs/` copy for manual Pages

`npm run build:pages` runs the full build and copies `dist/` into `docs/` via `scripts/copy-to-docs.cjs`. Use this only if you prefer publishing from a `docs/` folder instead of the Actions artifact; the current CI path does **not** use this script.

### Contributing

1. Create a branch from `main`.
2. Make focused changes; keep the diff scoped to the feature or fix.
3. Run `npm run lint` and `npm run build` locally.
4. Open a pull request with a short description of behavior changes.

There is **no automated test script** in `package.json` today; rely on lint, typecheck, and manual exercise of map, sidebar, recall modes, vault sync, export/import, and photo import.

---

## What’s in the app

### Map and geography

- **Leaflet** map with persisted **center and zoom** (restored on load).
- **Base map**: follows **light/dark theme** using **Carto** “light all” or “dark all” raster tiles (`subdomains abcd`), or switch to an alternate **“watercolor”** style (**Carto Voyager** raster) via the top bar or **`Alt+T`**.
- **Click the map** to place a **pending pin** (pulse marker) and open the add-memory flow; a **“CLICK TO PIN MEMORY”** hint appears after the pointer rests on the map. First map click while **Settings** or **archive search** is open only closes that drawer.
- **Location search** (geocoder) in the top strip: jump the map to a searched place.
- **Marker clustering** for memory pins; labels follow **group order** (e.g. ungrouped A, B, C… and grouped A1, B1…).
- **Timeline paths**: optional polylines connecting memories **per group** and a separate chain for **ungrouped** memories; line shape is **spline** or **orthogonal** (rounded corners), toggled in the top bar or with **`Alt+S`** / **`Alt+P`** for on/off.
- **Heatmap** (intensity by location) and **mood heatmap** (color by mood); both **dim while the map is dragged** and refresh after movement ends.
- **Radius circles** (about **2 km** per memory): optional overlay; circles whose ranges intersect (centers within about **twice** that radius) merge into **one outline** (buffer + polygon union). While **adding** a memory, the **pending coordinates** are included in that logic so merged shapes update live.
- **Hover** a marker to open a **card** (photo, title, etc.); **drag** from the card’s handle to **move** the memory on the map (one **undo** per drag), with a **crosshair** at the drag target.
- **Ctrl + drag** on the map draws a **marquee** to select memories whose pins fall inside (**Shift** adds to the current selection). **Delete** / **Backspace** deletes the selection (confirmation unless disabled in Settings). A small on-map hint shows when multiple memories are selected.
- **Archive search** hits can be **highlighted** on markers; some results draw a **dashed rectangle** on the map for an area match.

### Memories (create, edit, view)

- **Add / edit** drawer: **title**, **date**, coordinates, optional **sense of place** text, **Markdown** notes (GFM-style) with **Preview / Edit** toggle (**`Ctrl+E`** / **`Cmd+E`**), **photos** (common formats plus **HEIC/HEIF** conversion where supported), optional **voice note** (record + **inline player** in the mood/voice toolbar row), optional **mood** (five values), **tags**, **links**, **star**, **hide from map**, **custom label** (text or **emoji picker**), and **group** (names up to **20** characters; picker width fixed for layout).
- **Drop or import photos** (including bulk): reads **EXIF** GPS/date when present; photos without coordinates can land in an **ungeotagged tray** for later placement.
- **Memory viewer** (read-only): shows mood, optional sense of place under the location, images, markdown notes, links, and **voice playback** where present.
- **New memory at map center** via **`N`** when not typing in a field.

### Sidebar and navigation

- **Backtick (`)** toggles the **left drawer** (open/collapsed); width is persisted.
- **Views**: **List** (memories and groups), **Calendar** (three stacked months with **dots** on days that have memories; pick a date to filter and target new entries), **Memory stats**, **Mood stats**, **Recall stats**.
- **List**: groups with **collapse**, **hide on map**, **drag reorder**, **default group**, **multi-select** in the list, **bulk delete** and **bulk move to group**.
- **On This Day** banner when past-year memories exist today (dismissible for the session).
- **Vault row** in the sidebar links to **Settings** for folder setup.

### Search

- **Archive search** drawer (**`Ctrl+S`** or toolbar): full-text style search over vault-backed content; results tie to map highlights as above.

### Recall (SM-2)

- **Flashcards** (brain icon or **`Alt+R`**): right-hand **Recall** panel; map **flies** to the memory at zoom **17**; **I remember** / **Show me** (opens viewer) / **Skip**; number keys **1** / **2** / **3** map to those actions when the modal has focus.

  Flashcards use **SM-2 (Anki-style)** fields stored per memory:
  - **I remember** schedules the next review using SM-2 as a successful recall (increases the interval).
  - **Show me** schedules the next review using SM-2 as a failed recall (resets/reduces progress and makes it due sooner).
  - **Skip for now** does **not** update SM-2 scheduling for that memory.

  Session ordering for the next flashcard run:
  - Cards are built as a queue at the start of the session.
  - **Due** cards come first, then **not-due** cards.
  - Among *due* cards, items you have **forgotten more** (higher internal `failedReviewCount`, i.e. “Show me” more often) are shown earlier; ties use earlier `nextReviewAt`, then older `createdAt`.
  - The queue order during the current session is fixed; your SM-2 answers affect what becomes due (and its position) the *next* time you run flashcards.

- **Spatial walk** (route icon or **`Alt+W`**): map-centered cues; map **flies** at zoom **15**. The **bottom dialog** shows the **place cue** (sense of place if set, otherwise **reverse-geocoded** label or formatted coordinates) plus recall controls. If a memory has a photo, a **floating clue card near the node** shows the image preview; after tapping **Show me**, that floating card expands to show **photo + title + mood/emoji + place + a notes snippet**. Then:
  - **Got it** schedules the next review using SM-2 as a failed recall (same SM-2 fields as flashcards).
  - **Next** advances without updating SM-2 scheduling for that memory.

  Spatial walk ordering:
  - Iterate **sequentially** through all memories with valid coordinates in **sidebar label order** (ungrouped then grouped).
  - Memories **without valid coordinates** are skipped (browser console warning if any).
  - **`Alt+B`** toggles the **top control shelf** during the walk (preference saved separately from the main map). **Escape** ends recall / walk when the map stack has focus.
- **Recall stats** tab summarizes practice performance; scheduling uses **SM-2** fields on each memory.

### Top bar (floating)

When the shelf is visible: **theme**, **map style**, **timeline** on/off, **timeline line style**, **markers**, **radius circles**, **heatmap**, **mood heatmap**, **favorites filter**, **archive search**, **recall** (flashcard + spatial), **export / import / screenshot / report** menu, **reset**, and **Settings** (also **`Shift+S`**). Tooltips show shortcut hints where applicable.

### Settings

- **Vault**: choose a folder (browser **File System Access** where available, or Electron path); **sync** markdown + attachments under a `Temporal-Self` app folder; **Save now**, status and last error; **Open vault folder** on desktop when linked.
- **AI** (optional): **Gemini**, **OpenAI**, or **Claude** API key, connection test, and **auto-analyze** toggle for queued photo analysis.
- **Skip delete confirmation** for bulk deletes.
- **Keyboard shortcuts** reference table inside the drawer.

### Data, export, and reports

- **JSON** and **CSV** export/import (CSV is a reduced column set).
- **Styled map screenshot** (**`Ctrl+I`**): framed capture with timestamp; timeline/markers forced on for the shot.
- **PDF report** (**`Ctrl+R`**): cover, overview, calendar/group/mood breakdowns aligned with the in-app stats tabs, plus optional study table and recall summaries.
- **Research / Study** (optional): participant id, checkpoint tagging, completion times, and **append-only study events** exportable with JSON backup (see below).

### First run and help

- **Splash** screen on first visit (per browser profile), dismiss by click.
- **Onboarding** steps: welcome, add memory, list/groups, calendar, memory stats, mood stats, recall stats, vault folder, top controls — **Skip** / **Next**.

### Vault file layout (when synced)

- Markdown notes with **YAML front matter**; **location** stored as coordinates in front matter (e.g. `location: lat, lng`); voice files under `Temporal-Self/attachments/<memory-id>/` with `audio:` in YAML.

---

## Keyboard shortcuts

### With `Alt` (and other globals)

- `` ` `` — toggle left drawer
- `Alt + D` — toggle theme
- `Alt + R` — start flashcard recall
- `Alt + W` — start spatial walk
- `Alt + B` — toggle top control shelf (main vs spatial walk remembered separately)
- `Alt + C` — open reset dialog
- `Alt + S` — toggle timeline **line style** (spline ↔ orthogonal)
- `Alt + P` — toggle timeline **visibility**
- `Alt + H` — toggle heatmap
- `Alt + T` — toggle map style (default ↔ watercolor)
- `Alt + G` — toggle mood heatmap
- `Alt + M` — toggle markers
- `Alt + O` — toggle radius circles
- `Alt + F` — toggle favorites-only filter
- `Alt + L` — sidebar **list** view
- `Alt + K` — sidebar **calendar** view
- `Alt + E` — open export menu
- `Alt + I` — open import file picker
- `Alt + X` — trigger photo import
- `Ctrl + S` — open archive search drawer
- `Ctrl + I` — map screenshot
- `Ctrl + R` — generate PDF report
- `Shift + S` — open Settings

### Editing and navigation

- `N` — new memory at map center (not when typing in an input)
- `Escape` — closes editor/selection/add flow; ends recall/spatial walk when appropriate
- `Ctrl + Z` / `Ctrl + Shift + Z` / `Ctrl + Y` — undo / redo
- In the notes editor: `Ctrl + E` / `Cmd + E` — Preview ↔ Edit

### Recall panel (flashcard mode)

- `1` — I remember  
- `2` — Show me  
- `3` — Skip  

---

## Backup and portability

### JSON backup (recommended)

Use JSON export/import when moving data to another machine (for example a research computer).  
JSON is designed to preserve full data and app state, including:

- Memories, groups, map coordinates, dates, notes
- Optional place descriptor (`placeDescriptor`, "sense of place")
- Images (embedded data URLs)
- Voice notes (embedded audio data URLs)
- Custom labels/icons, tags, links, starred
- Mood labels (`radiant`, `content`, `neutral`, `concerned`, `distraught`)
- Visibility/order/group assignment
- Recall scheduling fields and recall session history
- App preferences (theme, map view, start-location preference, sidebar width, top-shelf visibility for main map vs spatial walk, etc.)
- Research study fields (when used):
  - `studyParticipantId` and current `studyCheckpointTag`
  - `studyCheckpointCompletedByParticipant` (per participant ID: which checkpoints were completed, and when; older backups may use the legacy flat `studyCheckpointCompletedAt`, which is merged on import)
  - `studyEvents` (append-only log of key actions like memory creation/updates, recall answers, and date-filter changes)

### CSV backup (limited)

CSV is for tabular memory data only and is **not** full-fidelity.  
It includes core fields plus mood and `placeDescriptor`, but does not preserve images, voice notes, and many rich metadata fields.

---

## Research workflow (optional)

If you are running a longitudinal study (for example at 2 days, 2 weeks, and 40 days), you can use the optional **Study panel** inside the **Memory stats** tab:

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
- Leaflet + React-Leaflet + `react-leaflet-cluster` + `leaflet.heat`
- Tailwind CSS 4
- Turf.js (`@turf/buffer`, `@turf/distance`, `@turf/union`, helpers) — radius-circle buffers and merged outlines
- `html-to-image` + canvas post-processing (styled screenshot export)
- `jsPDF` (report generation)
- `exifr` (photo EXIF)
- `heic2any` (HEIC/HEIF conversion in the browser where used)
- `emoji-picker-react` (custom memory labels)
- `vite-plugin-pwa` (web mode)
- Electron + electron-builder (desktop packaging)
- `react-markdown` + `remark-gfm` / `remark-breaks` (notes)

---

## Project structure

- `src/App.tsx` — app shell, splash, onboarding, photo drop/import flow, `UngeotaggedTray`, drawers, recall wiring
- `src/components/` — `MapView`, `Sidebar`, `CalendarView`, stats dashboards, `RecallModal`, `SpatialWalkOverlay`, `AddMemoryModal`, `MemoryViewer`, search/settings/export UI, `OnThisDayBanner`, etc.
- `src/hooks/` — `useKeyboardShortcuts`, `useVaultSync`, `useAiQueue`, and other hooks
- `src/store/memoryStore.ts` — global state, persistence, recall/session logic, preferences
- `src/types/memory.ts` — core `Memory` / `Group` shapes
- `src/utils/spacedRepetition.ts` — SM-2 recall scheduling
- `src/utils/radiusCircleMerge.ts` — intersecting 2 km circles → merged polygons (+ pending-pin preview)
- `src/utils/exportImport.ts` — JSON/CSV backup and restore
- `src/utils/generateReport.ts` — PDF report generator
- `src/utils/analyzePhoto.ts` — optional AI photo analysis (providers configured in Settings)
- `src/utils/memoryMoods.ts` — mood taxonomy, labels, valence mapping, parser helpers
- `src/utils/moodReportStats.ts` — mood stats for PDF (aligned with Mood stats tab)
- `src/utils/voiceNote.ts` — MediaRecorder helpers (capability checks, MIME choice, blob→data URL)
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

Electron preload also exposes vault helpers used by Settings, including opening the linked vault folder directly from the app.

---

## PWA and deployment notes

- PWA is enabled only in web mode (not the Electron production build).
- Default configured base path is **`/Temporal-Self/`**; **update `base`, `start_url`, and `scope` in `vite.config.ts`** if you publish under a different repository name or custom domain.
- After changing PWA settings, users may need a fresh load or cache clear to pick up the new service worker.

---

## Notes

- **Storage migration**: IndexedDB was renamed from `memory-atlas-db` to `temporal-self-db` (and the Zustand persist key updated). On first load, the app copies prior persist data and vault directory handles from the legacy database when the new one is empty.
- Geocoding `User-Agent` strings point at this repo; adjust in `LocationSearch.tsx` / `useReverseGeocode.ts` if you fork under another URL.
