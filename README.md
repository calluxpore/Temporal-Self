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

There is **no automated test script** in `package.json` today; rely on lint, typecheck, and manual exercise of map, sidebar, **flashcard and spatial walk recall**, and export/import flows.

---

## Core features

- **Map-first journaling**: click map to add memories with title, date, location coordinates, optional **sense of place** descriptor, notes, photos, tags, links, icon/emoji label, optional **mood** (five emoji buttons), and optional **voice note**. The editor now has an inline Mood + Voice toolbar: record button plus compact player in the same row, with the player always visible (greyed when no audio, active when audio exists). Vault sync writes voice files to `Temporal-Self/attachments/<memory-id>/voice.*` and stores `audio:` in note YAML.
- **Calendar-first history entry**: click any date in the compact **3-month Calendar view** (previous/current/next stacked), then add memories to that selected date.
- **Date visibility cues**: Calendar dates with memories show dot/count indicators.
- **Markdown notes**: memory notes support Markdown (GFM-style) in the editor.
- **Organization**: groups, collapse/hide groups, drag reorder, default group, starred favorites, and bulk actions. Group picker has fixed width in the editor for stable layout, and group names are capped at 20 characters.
- **Map layers and filters**: **location search** (top bar), date filter, favorites filter, timeline path, classic intensity heatmap, **mood heatmap** (color-coded by mood), and marker visibility toggle.
- **Map style toggle**: switch map tiles between the default (light/dark) style and a Voyager raster style (Carto; `subdomains="abcd"`) using the top-bar “Map style” button after location search.
- **Top-bar toggle clarity**: active map/search toggles now share a consistent highlighted state (accent border + glow + icon tint) so ON/OFF status is easy to read in both dark and light themes.
- **Drag memories on the map**: hover a memory to open its photo card, grab the top-right corner to move it; connected timeline polylines update live (Spline or Straight/orthogonal rounded corners), with a focus crosshair shown at the current drag target. Undo is captured once per drag.
- **Keyboard shortcuts** (when not typing in inputs): see list below for map controls, plus **N** new memory, **Ctrl+S** archive search drawer, **Escape** close selection/modals, **Ctrl+Z** / **Ctrl+Shift+Z** undo/redo.
- **Recall practice (SM-2)** — two modes, same scheduling and stats:
  - **Flashcards** — right-side recall panel; map flies to the memory; **I remember** / **Show me** (opens memory viewer) / skip. Started from the brain icon in the top bar or **`Alt+R`**.
  - **Spatial walk** — the **map is the cue** (no title until you reveal). The view **flies** to each memory (zoom 15); a **bottom-center** card shows place context (prefers the memory’s *sense of place* descriptor, otherwise place name/coords), **I remember** / **Show me**, then **Got it** / **Next** after reveal; SM-2 outcomes match flashcards. Order follows **group label traversal** (ungrouped `A, B, C…`, then group 1 `A1, B1…`, etc.). While active, **sidebar, location search, settings/search drawers, and heatmaps** are hidden for focus; **`Alt+B`** can show the **top control shelf** (visibility is remembered separately for main map vs spatial walk). **Escape** ends the walk. Started from the route icon next to flashcards or **`Alt+W`**. Memories without valid coordinates are skipped (console warning).
- **Top shelf toggle**: **`Alt+B`** shows or hides the floating top icon row with a slide-from-top animation. Preference is stored for **normal map** vs **spatial walk** independently.
- **Heatmaps during map pan**: intensity and mood heat layers **fade out while you drag** the map and **resync once** when movement ends, so the canvas stays smooth without expensive per-frame redraws.
- **Stats dashboards** (sidebar tabs):
  - **Memory stats** — totals, places, starred, photos, by year/month, date-wise memories (plus Study panel)
  - **Mood stats** — emotion coverage, valence, balance, diversity (entropy), per-mood distribution, monthly/yearly trends, weekday & group breakdowns, narrative insights
  - **Recall stats** — score, due/scheduled, cycle performance
- **Styled screenshot export**: rounded card frame, theme-aware border/text, timestamp, timeline+markers forced on, map controls hidden.
- **PDF report generation**: branded cover with logo and timestamp, plus overview, date/group distribution, **mood & emotion** (coverage, distribution chart, valence scale, balance, entropy, dominant mood), study table (if used), and recall analytics.
- **Memory viewer enhancements**: mood is shown directly in the viewer header, optional *sense of place* is shown under location in italic quotes, and voice notes can be played from an inline audio player on the memory card.
- **First-visit splash screen**: branded splash shown once per browser profile, dismiss on click.
- **Onboarding overlay**: multi-step tour (map, list/groups, calendar, memory stats, mood stats, recall stats) with skip/next.
- **Top-bar controls with hover tooltips**: theme, **flashcards recall** and **spatial walk recall**, reset, search, map style, timeline, heatmaps, markers, favorites, export/import, etc.
- **Research study support (Study panel)**: optional study logging in the Memory stats tab (participant ID + checkpoint tag + completion time) and an exportable event log for longitudinal analysis.
- **Vault convenience in Settings**: when a vault is linked, Settings includes an **Open vault folder** action (Electron opens it in the OS file explorer).
- **Vault markdown location format**: exported memory notes keep location inside YAML front matter as raw coordinates, e.g. `location: 42.98324945220888, -81.25033468246303` (legacy body `**Location:** ...` lines are cleaned during sync).

---

## Keyboard shortcuts

### Global controls

- `` ` `` — toggle left drawer open/collapse
- `Alt + D` — toggle dark/light theme
- `Alt + R` — start **flashcard** recall (SM-2)
- `Alt + W` — start **spatial walk** recall (map-as-cue; same SM-2 pool)
- `Alt + B` — toggle **top control shelf** visibility (main vs spatial walk state remembered)
- `Alt + C` — open reset dialog
- `Alt + S` — toggle timeline path style
- `Ctrl + S` — open **archive search** drawer (full-text vault search; matching memories highlighted on the map)
- `Alt + P` — toggle timeline path
- `Alt + H` — toggle heatmap
- `Alt + T` — toggle map style
- `Alt + G` — toggle mood heatmap
- `Alt + M` — toggle markers
- `Alt + L` — switch sidebar to list view
- `Alt + K` — switch sidebar to calendar view
- `Alt + E` — open export menu
- `Alt + I` — open import file picker
- `Ctrl + I` — save map screenshot
- `Ctrl + R` — generate report
- `Shift + S` — open settings

### Navigation/editing

- `N` — create new memory at map center
- `Escape` — close active modal/selection; ends **spatial walk** / recall session when the map has focus
- `Ctrl + Z` / `Ctrl + Shift + Z` (`Ctrl + Y`) — undo/redo
- In notes editor: `Ctrl + E` / `Cmd + E` — toggle Preview/Edit

### Recall modal

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
- Leaflet + React-Leaflet + marker clustering + heatmap
- Tailwind CSS 4
- `html-to-image` + canvas post-processing (styled screenshot export)
- `jsPDF` (report generation)
- `vite-plugin-pwa` (web mode)
- Electron + electron-builder (desktop packaging)
- `react-markdown` + `remark-gfm` / `remark-breaks` (notes)

---

## Project structure

- `src/App.tsx` — app shell, overlays/modals, splash behavior, spatial-walk chrome hiding
- `src/components/` — map, sidebar, calendar, stats, recall (`RecallModal`, `SpatialWalkOverlay`), controls, export/import
- `src/store/memoryStore.ts` — global state, persistence, recall/session logic, preferences
- `src/types/memory.ts` — core `Memory` / `Group` shapes (good starting point for export schema or migrations)
- `src/utils/spacedRepetition.ts` — SM-2 recall scheduling
- `src/utils/exportImport.ts` — JSON/CSV backup and restore
- `src/utils/generateReport.ts` — PDF report generator
- `src/utils/memoryMoods.ts` — mood taxonomy, labels, valence mapping, parser helpers
- `src/utils/moodReportStats.ts` — mood coverage / valence / entropy snapshot for PDF (and aligns with Mood stats tab)
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
