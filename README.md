# Memory Atlas

A **map-based memory journal** that lets you pin life moments to places, organize them in groups, and explore them on a timeline—all in the browser, with no account required.

---

## What is this project?

**Memory Atlas** is a personal, location-aware journal. You add “memories” by clicking on a map: each memory has a title, date, notes, and an optional photo, tied to a latitude/longitude. Memories can be grouped (e.g. “Trip to Japan”, “2024”), reordered, and hidden. A sidebar lists everything; a timeline view (when enabled) draws a line connecting memories in order. Data is stored in your browser (localStorage) via Zustand persist—private and offline-capable.

---

## What it does

- **Map-based journaling** — Click anywhere on the map to add a memory at that location. Edit or delete from the sidebar or by opening a memory.
- **Groups** — Create groups, assign memories to them, collapse/expand and reorder. Drag-and-drop to reorder memories within a group.
- **Timeline** — Toggle a polyline on the map that connects memories in sidebar order (by group and order), so you can see a “path” through your memories.
- **Search** — Filter memories by title, notes, or date. Search can highlight a point or area on the map.
- **Photos** — Attach one or more images per memory (stored as compressed data URLs). Portrait (tall) images focus on the **top** in hover cards, detail/viewer, and edit form so faces aren’t cut off.
- **Spaced repetition (recall)** — Practice recall with the **Practice recall** button. The app asks “Do you remember what happened here?” (with image and location). **I remember** schedules the next review later; **Show me** resets and shows the memory again soon. Uses the **SM-2 algorithm** (Anki/SuperMemo-style) so items you remember appear less often and items you forget appear more often.
- **Recall stats** — Sidebar tab **Recall stats** shows: I remember / Show me counts, due now vs scheduled later, success rate, **by recall cycle** (per session), practice depth, and a **Recall score** (0–100).
- **Reset** — **Reset** button (below Practice recall) clears all memories, groups, and recall stats after confirmation.
- **Delete confirmation** — When removing a memory or resetting, you can check “Do not show this message again” and your choice is saved.
- **Light/dark theme** — UI and map tiles (e.g. CartoDB) switch with your preference.
- **Responsive** — Sidebar and controls adapt to smaller screens; map remains central.
- **Persistence** — Memories and groups are saved in the browser; no backend or login.

---

## Spaced repetition (recall algorithm)

Memory Atlas uses the **SM-2 algorithm** (SuperMemo 2), the same family of algorithms used by Anki and classic SuperMemo. It schedules when each memory is due for recall based on how well you remembered it.

### How it works

- **First review** — New memories are due for recall **2 days** after creation.
- **When you answer “I remember”** (successful recall):
  - **1st successful review** → next review in **1 day**.
  - **2nd successful review** → next review in **6 days**.
  - **3rd and later** → next interval = **previous interval × ease factor** (rounded up to whole days). So intervals grow (e.g. 6 → 15 → 37 days) for items you keep remembering.
- **When you answer “Show me”** (failed recall):
  - The item is **reset**: next review in **1 day**, repetition count set back to 0. The **ease factor** is not changed. So things you don’t remember show up again soon.
- **Ease factor (EF)** — Each memory has an ease factor (default **2.5**, range **1.3–2.5**). After each successful review it is updated by the SM-2 formula; harder items get a lower EF and thus shorter intervals. Failed reviews do not change EF.

### SM-2 formulas (reference)

- **Intervals (days):**  
  - \( I(1) = 1 \), \( I(2) = 6 \), and for \( n > 2 \): \( I(n) = I(n-1) \times \text{EF} \) (rounded up).
- **Ease factor update** (after a successful review with quality \( q \), \( 0 \le q \le 5 \)):  
  \( \text{EF}' = \text{EF} + \bigl(0.1 - (5-q)(0.08 + (5-q) \times 0.02)\bigr) \), with a minimum of **1.3**.
- **Quality mapping in the app:**  
  - **“I remember”** → quality **5** (perfect).  
  - **“Show me”** → quality **2** (failed); item is reset as in SM-2 (intervals restart, EF unchanged).

### Recall stats (sidebar tab)

The **Recall stats** tab shows: total I remember / Show me counts, due now vs scheduled later, overall success rate, **by recall cycle** (each run of Practice recall), how many memories have never been practiced, and a **Recall score** (0–100, from success rate). No average ease factor is shown.

### Where it lives in the code

- **Algorithm:** `src/utils/spacedRepetition.ts` — `sm2Schedule(quality, state)` and helpers (`isDueForReview`, `getFirstReviewDate`).
- **State:** Each memory stores `nextReviewAt`, `reviewCount`, `intervalDays`, `easeFactor`, and `failedReviewCount` (see `src/types/memory.ts`). The store keeps `recallSessions` (per-session remembered/forgot counts) for the stats tab.
- **UI:** **Practice recall** button (below the theme toggle) opens the recall flow; **Reset** (below it) clears all data. `RecallModal` shows one memory at a time with image and location; the store’s `scheduleNextReview(memoryId, remembered)` applies SM-2 and updates the memory. **Recall stats** (sidebar tab) uses `MemoryStatsDashboard` and `recallSessions` for per-cycle and overall stats plus Recall score (0–100).

---

## Why it’s important

- **Place and time together** — Many journals are either date-based or tag-based. Memory Atlas ties entries to real geography, so you can see *where* things happened and how places relate.
- **Privacy-first** — Everything stays in your browser. No sign-up, no server storing your data, no tracking.
- **Simple and focused** — No social features or clutter; it’s a single-user tool for reflecting on places and moments.
- **Reusable and hackable** — Built with standard web tech (React, TypeScript, Leaflet, Vite), so you can run it locally, deploy to GitHub Pages, or extend it for your own use.

---
 
## How it’s built

### Stack

- **React 19** + **TypeScript** — UI and type-safe state.
- **Vite 7** — Dev server, HMR, and production builds.
- **Zustand** — Global state (memories, groups, UI flags) with `persist` middleware for localStorage.
- **Leaflet** + **react-leaflet** — Interactive map; **react-leaflet-cluster** for marker clustering when zoomed out.
- **Tailwind CSS 4** — Styling and theming (CSS variables for light/dark).
- **No backend** — All data in the client; optional deploy to static hosting (e.g. GitHub Pages).

### Project structure (high level)

- `src/`
  - `App.tsx` — Root layout, modals (add/edit memory, memory viewer), theme and overlay behavior.
  - `components/` — `MapView`, `Sidebar`, `AddMemoryModal`, `MemoryViewer`, `RecallModal`, `RecallButton`, `ResetButton`, `MemoryMarker`, `MemoryHoverCard`, `MemoryStatsDashboard`, `LocationSearch`, `SearchBar`, `ConfirmDialog`, `ThemeToggle`, `TimelineToggle`, `ErrorBoundary`, etc.
  - `store/memoryStore.ts` — Zustand store: memories, groups, selection, search, theme, timeline toggle, recall modal, recall sessions, spaced-repetition scheduling, `skipDeleteConfirmation`, `resetAllData`, persistence config.
  - `context/MapContext.tsx` — React context holding the Leaflet map instance for programmatic control (e.g. flyTo for search).
  - `types/memory.ts` — `Memory`, `Group`, `PendingLatLng` (Memory includes `nextReviewAt`, `reviewCount`, `intervalDays`, `easeFactor` for SM-2).
  - `utils/` — `formatDate`, `formatCoords`, `memoryOrder`, `memoryLabel`, `timelineCurve`, `imageUtils`, **`spacedRepetition`** (SM-2 scheduling), etc.
  - `hooks/` — `useFocusTrap`, `useMediaQuery`, etc.
- `public/` — Static assets (e.g. 404 page for SPA routing on GitHub Pages).
- `scripts/copy-to-docs.cjs` — Optional script to copy build output to `docs/` for branch-based GitHub Pages.
- **Base path** — Vite is configured with `base: '/Memory-Atlas/'` for GitHub Pages repo deployment.

### Run and build

```bash
npm install
npm run dev      # Development
npm run build    # Production build (output in dist/)
npm run preview  # Preview production build locally
```

### Electron (desktop app)

You can run Memory Atlas as a desktop app and build installers for Windows (and, with the same setup, macOS/Linux):

```bash
npm run electron:dev   # Dev: Vite + Electron window (with DevTools)
npm run electron:build # Build: outputs in release/
```

After `electron:build` you get:

- **release/win-unpacked/** — Unpacked app (run `Memory Atlas.exe` to test).
- **release/Memory Atlas Setup 1.0.0.exe** — NSIS installer (download and install).
- **release/Memory Atlas 1.0.0.exe** — Portable executable (no install).

Web and Electron share the same codebase; the Electron build uses `base: './'` and skips the PWA plugin.

---

## Deploy to GitHub Pages

**Recommended: GitHub Actions**

1. In the repo go to **Settings** → **Pages** → under **Build and deployment**, set **Source** to **GitHub Actions**. Save.
2. Push the repo (including `.github/workflows/deploy-pages.yml`) to `main`. The workflow will build the app and deploy to GitHub Pages.
3. After the action completes (see the **Actions** tab), open:  
   `https://<your-username>.github.io/Memory-Atlas/`

Each push to `main` will rebuild and redeploy. You don’t need to run `build:pages` or commit the `docs` folder.

**Manual alternative:** Run `npm run build:pages`, commit and push the `docs` folder, then in **Settings** → **Pages** set Source to **Deploy from a branch** → Branch: **main** → Folder: **/docs**.
