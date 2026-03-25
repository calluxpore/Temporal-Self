import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../utils/idbStorage';
import { sm2Schedule, QUALITY_REMEMBERED, QUALITY_FAILED } from '../utils/spacedRepetition';
import type { Memory, PendingLatLng, Group } from '../types/memory';
import type { StudyCheckpointTag, StudyEvent, StudyRecallAnswer } from '../types/study';

/** [south, north, west, east] */
export type SearchHighlightBbox = [number, number, number, number];

export type SearchHighlight =
  | { type: 'point'; lat: number; lng: number }
  | { type: 'area'; bbox: SearchHighlightBbox }
  | null;

export type TimelineLineStyle = 'spline' | 'orthogonal';
const GROUP_NAME_MAX_LENGTH = 20;
export type MapStyle = 'default' | 'watercolor';

interface MemoryState {
  mapView: { lat: number; lng: number; zoom: number } | null;
  hasChosenStartLocation: boolean;
  memories: Memory[];
  groups: Group[];
  selectedMemoryId: string | null;
  /** When set, map will show the hover card for this memory after flying to it (e.g. from sidebar). */
  cardTargetMemoryId: string | null;
  editingMemory: Memory | null;
  isAddingMemory: boolean;
  pendingLatLng: PendingLatLng | null;
  searchHighlight: SearchHighlight;
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  mapStyle: MapStyle;
  timelineEnabled: boolean;
  timelineLineStyle: TimelineLineStyle;
  defaultGroupId: string | null;
  /** Resizable sidebar width in px (min 240, max 560). */
  sidebarWidth: number;
  /** When true, sidebar and map show only starred memories. */
  filterStarred: boolean;
  /** Sidebar list sort: 'default' = order/createdAt, else sort by this field. */
  sortBy: 'default' | 'date' | 'title' | 'location' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  /** Map/sidebar date filter: only show memories with date in [dateFilterFrom, dateFilterTo] (YYYY-MM-DD). */
  dateFilterFrom: string | null;
  dateFilterTo: string | null;
  /** Show heatmap layer on map. */
  heatmapEnabled: boolean;
  /** Show mood heatmap layer on map. */
  moodHeatmapEnabled: boolean;
  /** Show memory markers and labels on map. */
  markersVisible: boolean;
  /** Show a fixed-radius circle around each visible memory marker. */
  radiusCirclesEnabled: boolean;
  /** Top controls shelf visibility in main screens. */
  topShelfVisibleMain: boolean;
  /** Top controls shelf visibility during spatial walk. */
  topShelfVisibleSpatial: boolean;
  /** Sidebar main view: list, calendar, memory stats (totals), mood stats, recall stats. */
  sidebarView: 'list' | 'calendar' | 'stats' | 'moodStats' | 'memoryStats';
  /** Bulk selection: memory IDs. */
  selectedMemoryIds: string[];
  /** Undo stack (snapshots of { memories, groups }). */
  undoStack: { memories: Memory[]; groups: Group[] }[];
  redoStack: { memories: Memory[]; groups: Group[] }[];
  /** Memory id shown in recall modal (null = closed). */
  recallModalMemoryId: string | null;
  setRecallModalMemoryId: (id: string | null) => void;
  /** Active recall presentation mode. */
  recallMode: 'flashcard' | 'spatial' | null;
  setRecallMode: (mode: 'flashcard' | 'spatial' | null) => void;
  /** Ordered list of memory ids for the current recall session (so we show each in turn). */
  recallSessionQueue: string[];
  setRecallSessionQueue: (ids: string[]) => void;
  /** Number of due memories when the current recall session started. */
  recallSessionInitialCount: number;
  setRecallSessionInitialCount: (count: number) => void;
  /** Per-session stats: each time you run Practice recall, we record { remembered, forgot } when the session ends. */
  recallSessions: { remembered: number; forgot: number }[];
  /** Current session counts (reset when starting recall; pushed to recallSessions when modal closes). */
  currentSessionRemembered: number;
  currentSessionForgot: number;
  /** Reset current session counts (call when starting a new Practice recall). */
  resetRecallSession: () => void;
  /** End the current recall cycle and push to recallSessions (call only when the full cycle is done or user closes). */
  endRecallSession: () => void;
  /** Schedule next spaced-repetition review for a memory. */
  scheduleNextReview: (memoryId: string, remembered: boolean) => void;

  // --- Study mode (research support) ---
  /** Optional participant identifier for research exports. */
  studyParticipantId: string | null;
  /** Which checkpoint this participant is currently completing. */
  studyCheckpointTag: StudyCheckpointTag | null;
  /** Per–participant ID: timestamps when each checkpoint was marked complete (key = trimmed participant ID). */
  studyCheckpointCompletedByParticipant: Record<string, Partial<Record<StudyCheckpointTag, string>>>;
  /** Append-only event log used for longitudinal analysis. */
  studyEvents: StudyEvent[];
  setStudyParticipantId: (id: string | null) => void;
  setStudyCheckpointTag: (tag: StudyCheckpointTag | null) => void;
  markStudyCheckpointComplete: () => void;
  logStudyMemoryCreated: (memoryId: string) => void;
  logStudyMemoryUpdated: (memoryId: string) => void;
  logStudyRecallSessionStarted: (dueCount: number) => void;
  logStudyRecallAnswered: (memoryId: string, answer: StudyRecallAnswer) => void;
  logStudyDateFilterChanged: (from: string | null, to: string | null) => void;
  /** When true, delete actions run without confirmation dialog. */
  skipDeleteConfirmation: boolean;
  /** Absolute path to vault root (Electron). Browser uses IndexedDB-stored directory handle. */
  vaultElectronPath: string | null;
  vaultLastSyncAt: string | null;
  vaultLastSyncError: string | null;
  setVaultElectronPath: (path: string | null) => void;
  setVaultLastSyncMeta: (at: string | null, error: string | null) => void;
  /** Right-edge settings drawer (same pattern as editing a memory). */
  settingsDrawerOpen: boolean;
  setSettingsDrawerOpen: (open: boolean) => void;
  /** Search memories (title, notes, tags, links, coords, group name, …) — right drawer + map highlights. */
  memorySearchDrawerOpen: boolean;
  memorySearchMatchIds: string[] | null;
  setMemorySearchDrawerOpen: (open: boolean) => void;
  setMemorySearchMatchIds: (ids: string[] | null) => void;
  /** Bumped when vault folder is linked or cleared so disk writes pick up the change. */
  vaultLinkNonce: number;
  bumpVaultLinkNonce: () => void;
  aiProvider: 'gemini' | 'openai' | 'claude' | null;
  aiApiKey: string;
  aiAutoAnalyze: boolean;
  aiQueue: string[];
  aiProcessing: string | null;
  setAiProvider: (p: 'gemini' | 'openai' | 'claude' | null) => void;
  setAiApiKey: (key: string) => void;
  setAiAutoAnalyze: (v: boolean) => void;
  enqueueAiAnalysis: (memoryId: string) => void;
  dequeueAiAnalysis: () => void;
  completeAiAnalysis: () => void;
  setSkipDeleteConfirmation: (value: boolean) => void;
  setMemories: (memories: Memory[]) => void;
  setGroups: (groups: Group[]) => void;
  setFilterStarred: (value: boolean) => void;
  setSortBy: (sortBy: MemoryState['sortBy']) => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  setDateFilter: (from: string | null, to: string | null) => void;
  setHeatmapEnabled: (value: boolean) => void;
  setMoodHeatmapEnabled: (value: boolean) => void;
  setMarkersVisible: (value: boolean) => void;
  setRadiusCirclesEnabled: (value: boolean) => void;
  setTopShelfVisibleMain: (value: boolean) => void;
  setTopShelfVisibleSpatial: (value: boolean) => void;
  setSidebarView: (view: MemoryState['sidebarView']) => void;
  addMemory: (memory: Memory) => void;
  /** Add many memories in one state update (used by bulk photo import). */
  addMemories: (memories: Memory[]) => void;
  updateMemory: (id: string, updates: Partial<Memory>) => void;
  /** Update a memory without pushing an undo snapshot (use for live dragging). */
  updateMemoryWithoutUndo: (id: string, updates: Partial<Memory>) => void;
  removeMemory: (id: string) => void;
  /** Drop memories because their vault `.md` files were removed externally (no undo). */
  removeMemoriesVaultMirror: (ids: string[]) => void;
  setSelectedMemory: (memory: Memory | null) => void;
  setCardTargetMemoryId: (id: string | null) => void;
  setEditingMemory: (memory: Memory | null) => void;
  setIsAddingMemory: (value: boolean) => void;
  setPendingLatLng: (value: PendingLatLng | null) => void;
  setSearchHighlight: (value: SearchHighlight) => void;
  setSidebarOpen: (value: boolean) => void;
  setMapView: (value: { lat: number; lng: number; zoom: number }) => void;
  setHasChosenStartLocation: (value: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setMapStyle: (mapStyle: MapStyle) => void;
  setTimelineEnabled: (value: boolean) => void;
  setTimelineLineStyle: (value: TimelineLineStyle) => void;
  setDefaultGroupId: (id: string | null) => void;
  setSidebarWidth: (width: number) => void;
  addGroup: (group: Group) => void;
  removeGroup: (id: string) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  /** Set order of memories within a group (or ungrouped when groupId is null). orderedMemoryIds = full list in desired order. */
  reorderMemoriesInGroup: (groupId: string | null, orderedMemoryIds: string[]) => void;
  toggleSelection: (id: string) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  bulkDelete: (ids: string[]) => void;
  bulkMoveToGroup: (ids: string[], groupId: string | null) => void;
  undo: () => void;
  redo: () => void;
  pushUndo: () => void;
  /** Clear all memories, groups, and recall stats (fresh start). */
  resetAllData: () => void;
}

const UNDO_STACK_CAP = 20;

/** Strip base64 image data from memories for undo snapshots to avoid unbounded memory. */
function stripImagesForUndoSnapshot(memories: Memory[]): Memory[] {
  return memories.map((m) => ({
    ...m,
    imageDataUrl: undefined,
    imageDataUrls: undefined,
  }));
}

/** Restore image data from current state into restored memories (by id) so undo/redo doesn't lose images. */
function mergeImagesIntoRestored(restored: Memory[], current: Memory[]): Memory[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  return restored.map((r) => {
    const cur = byId.get(r.id);
    if (!cur || (cur.imageDataUrl == null && !cur.imageDataUrls?.length)) return r;
    return { ...r, imageDataUrl: cur.imageDataUrl, imageDataUrls: cur.imageDataUrls };
  });
}

const pushUndoInSet = (state: MemoryState): Partial<MemoryState> => ({
  undoStack: state.undoStack.length >= UNDO_STACK_CAP
    ? [
        ...state.undoStack.slice(1),
        { memories: stripImagesForUndoSnapshot(state.memories), groups: state.groups },
      ]
    : [...state.undoStack, { memories: stripImagesForUndoSnapshot(state.memories), groups: state.groups }],
  redoStack: [],
});

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set) => ({
      mapView: null,
      hasChosenStartLocation: false,
      memories: [],
      groups: [],
      selectedMemoryId: null,
      cardTargetMemoryId: null,
      editingMemory: null,
      isAddingMemory: false,
      pendingLatLng: null,
      searchHighlight: null,
      sidebarOpen: true,
      theme: 'dark',
      mapStyle: 'default',
      timelineEnabled: false,
      timelineLineStyle: 'spline',
      defaultGroupId: null,
      sidebarWidth: 320,
      filterStarred: false,
      sortBy: 'default',
      sortOrder: 'asc',
      dateFilterFrom: null,
      dateFilterTo: null,
      heatmapEnabled: false,
      moodHeatmapEnabled: false,
      markersVisible: true,
      radiusCirclesEnabled: false,
      topShelfVisibleMain: true,
      topShelfVisibleSpatial: false,
      sidebarView: 'list',
      selectedMemoryIds: [],
      undoStack: [],
      redoStack: [],
      recallModalMemoryId: null,
      recallMode: null,
      recallSessionQueue: [],
      recallSessionInitialCount: 0,
      recallSessions: [],
      currentSessionRemembered: 0,
      currentSessionForgot: 0,
      studyParticipantId: null,
      studyCheckpointTag: null,
      studyCheckpointCompletedByParticipant: {},
      studyEvents: [],
      skipDeleteConfirmation: false,
      vaultElectronPath: null,
      vaultLastSyncAt: null,
      vaultLastSyncError: null,
      settingsDrawerOpen: false,
      memorySearchDrawerOpen: false,
      memorySearchMatchIds: null,
      vaultLinkNonce: 0,
      aiProvider: null,
      aiApiKey: '',
      aiAutoAnalyze: false,
      aiQueue: [],
      aiProcessing: null,

      setVaultElectronPath: (vaultElectronPath) => set({ vaultElectronPath }),
      setVaultLastSyncMeta: (vaultLastSyncAt, vaultLastSyncError) =>
        set({ vaultLastSyncAt, vaultLastSyncError }),
      setSettingsDrawerOpen: (open) =>
        set({
          settingsDrawerOpen: open,
          ...(open
            ? {
                memorySearchDrawerOpen: false,
                memorySearchMatchIds: null,
                selectedMemoryId: null,
                editingMemory: null,
                isAddingMemory: false,
                pendingLatLng: null,
              }
            : {}),
        }),
      setMemorySearchDrawerOpen: (open) =>
        set({
          memorySearchDrawerOpen: open,
          ...(!open
            ? {
                memorySearchMatchIds: null,
                // Avoid leaving a map highlight dot after closing archive search.
                searchHighlight: null,
              }
            : {}),
        }),
      setMemorySearchMatchIds: (memorySearchMatchIds) => set({ memorySearchMatchIds }),
      bumpVaultLinkNonce: () => set((s) => ({ vaultLinkNonce: s.vaultLinkNonce + 1 })),
      setAiProvider: (aiProvider) => set({ aiProvider }),
      setAiApiKey: (aiApiKey) => set({ aiApiKey }),
      setAiAutoAnalyze: (aiAutoAnalyze) => set({ aiAutoAnalyze }),
      enqueueAiAnalysis: (memoryId) =>
        set((state) => {
          if (!memoryId || state.aiQueue.includes(memoryId) || state.aiProcessing === memoryId) return state;
          const memory = state.memories.find((m) => m.id === memoryId);
          if (!memory) return state;
          const alreadyAnalyzed =
            !!memory.title?.trim() && !!memory.customLabel?.trim() && !!memory.placeDescriptor?.trim();
          if (alreadyAnalyzed) return state;
          return { aiQueue: [...state.aiQueue, memoryId] };
        }),
      dequeueAiAnalysis: () =>
        set((state) => {
          if (state.aiQueue.length === 0) return state;
          const [next, ...rest] = state.aiQueue;
          return { aiQueue: rest, aiProcessing: next };
        }),
      completeAiAnalysis: () => set({ aiProcessing: null }),

      setRecallModalMemoryId: (id) => set({ recallModalMemoryId: id }),
      setRecallMode: (mode) => set({ recallMode: mode }),
      setRecallSessionQueue: (recallSessionQueue) => set({ recallSessionQueue }),
      setRecallSessionInitialCount: (recallSessionInitialCount) => set({ recallSessionInitialCount }),
      resetRecallSession: () => set({ currentSessionRemembered: 0, currentSessionForgot: 0 }),
      endRecallSession: () =>
        set((state) => {
          const hadActivity = state.currentSessionRemembered > 0 || state.currentSessionForgot > 0;
          if (!hadActivity)
            return { currentSessionRemembered: 0, currentSessionForgot: 0 };
          return {
            recallSessions: [
              ...state.recallSessions,
              { remembered: state.currentSessionRemembered, forgot: state.currentSessionForgot },
            ],
            currentSessionRemembered: 0,
            currentSessionForgot: 0,
          };
        }),
      setSkipDeleteConfirmation: (skipDeleteConfirmation) => set({ skipDeleteConfirmation }),

      scheduleNextReview: (memoryId, remembered) =>
        set((state) => {
          const memory = state.memories.find((m) => m.id === memoryId);
          if (!memory) return state;
          const quality = remembered ? QUALITY_REMEMBERED : QUALITY_FAILED;
          const result = sm2Schedule(quality, {
            reviewCount: memory.reviewCount ?? 0,
            intervalDays: memory.intervalDays ?? 0,
            easeFactor: memory.easeFactor ?? 2.5,
          });
          return {
            memories: state.memories.map((m) =>
              m.id === memoryId
                ? {
                    ...m,
                    nextReviewAt: result.nextReviewAt,
                    reviewCount: result.reviewCount,
                    intervalDays: result.intervalDays,
                    easeFactor: result.easeFactor,
                    ...(remembered ? {} : { failedReviewCount: (memory.failedReviewCount ?? 0) + 1 }),
                  }
                : m
            ),
            currentSessionRemembered: state.currentSessionRemembered + (remembered ? 1 : 0),
            currentSessionForgot: state.currentSessionForgot + (remembered ? 0 : 1),
          };
        }),

      // --- Study mode events (research logging) ---
      setStudyParticipantId: (id) => set({ studyParticipantId: id }),
      setStudyCheckpointTag: (tag) => set({ studyCheckpointTag: tag }),

      markStudyCheckpointComplete: () =>
        set((state) => {
          if (!state.studyCheckpointTag) return state;
          const ts = new Date().toISOString();
          const checkpointTag = state.studyCheckpointTag;
          const pid = state.studyParticipantId?.trim();
          if (!pid) return state;
          const event: StudyEvent = {
            id: crypto.randomUUID(),
            ts,
            type: 'checkpoint_completed',
            participantId: state.studyParticipantId,
            checkpointTag,
          };
          const cap = 5000;
          const nextEvents =
            state.studyEvents.length >= cap
              ? state.studyEvents.slice(state.studyEvents.length - cap + 1)
              : state.studyEvents;
          const prevForPid = state.studyCheckpointCompletedByParticipant[pid] ?? {};
          return {
            studyCheckpointCompletedByParticipant: {
              ...state.studyCheckpointCompletedByParticipant,
              [pid]: {
                ...prevForPid,
                [checkpointTag]: ts,
              },
            },
            studyEvents: [...nextEvents, event],
          };
        }),

      logStudyMemoryCreated: (memoryId) =>
        set((state) => {
          const ts = new Date().toISOString();
          const event: StudyEvent = {
            id: crypto.randomUUID(),
            ts,
            type: 'memory_created',
            participantId: state.studyParticipantId,
            checkpointTag: state.studyCheckpointTag,
            memoryId,
          };
          const cap = 5000;
          const nextEvents =
            state.studyEvents.length >= cap
              ? state.studyEvents.slice(state.studyEvents.length - cap + 1)
              : state.studyEvents;
          return { studyEvents: [...nextEvents, event] };
        }),

      logStudyMemoryUpdated: (memoryId) =>
        set((state) => {
          const ts = new Date().toISOString();
          const event: StudyEvent = {
            id: crypto.randomUUID(),
            ts,
            type: 'memory_updated',
            participantId: state.studyParticipantId,
            checkpointTag: state.studyCheckpointTag,
            memoryId,
          };
          const cap = 5000;
          const nextEvents =
            state.studyEvents.length >= cap
              ? state.studyEvents.slice(state.studyEvents.length - cap + 1)
              : state.studyEvents;
          return { studyEvents: [...nextEvents, event] };
        }),

      logStudyRecallSessionStarted: (dueCount) =>
        set((state) => {
          const ts = new Date().toISOString();
          const event: StudyEvent = {
            id: crypto.randomUUID(),
            ts,
            type: 'recall_session_started',
            participantId: state.studyParticipantId,
            checkpointTag: state.studyCheckpointTag,
            dueCount,
          };
          const cap = 5000;
          const nextEvents =
            state.studyEvents.length >= cap
              ? state.studyEvents.slice(state.studyEvents.length - cap + 1)
              : state.studyEvents;
          return { studyEvents: [...nextEvents, event] };
        }),

      logStudyRecallAnswered: (memoryId, answer) =>
        set((state) => {
          const ts = new Date().toISOString();
          const event: StudyEvent = {
            id: crypto.randomUUID(),
            ts,
            type: 'recall_answered',
            participantId: state.studyParticipantId,
            checkpointTag: state.studyCheckpointTag,
            memoryId,
            answer,
          };
          const cap = 5000;
          const nextEvents =
            state.studyEvents.length >= cap
              ? state.studyEvents.slice(state.studyEvents.length - cap + 1)
              : state.studyEvents;
          return { studyEvents: [...nextEvents, event] };
        }),

      logStudyDateFilterChanged: (from, to) =>
        set((state) => {
          const ts = new Date().toISOString();
          const event: StudyEvent = {
            id: crypto.randomUUID(),
            ts,
            type: 'date_filter_changed',
            participantId: state.studyParticipantId,
            checkpointTag: state.studyCheckpointTag,
            from,
            to,
          };
          const cap = 5000;
          const nextEvents =
            state.studyEvents.length >= cap
              ? state.studyEvents.slice(state.studyEvents.length - cap + 1)
              : state.studyEvents;
          return { studyEvents: [...nextEvents, event] };
        }),

      setMemories: (memories) => set({ memories }),
      setGroups: (groups) => set({ groups }),
      setFilterStarred: (filterStarred) => set({ filterStarred }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setDateFilter: (dateFilterFrom, dateFilterTo) =>
        set((state) => {
          const ts = new Date().toISOString();
          const event: StudyEvent = {
            id: crypto.randomUUID(),
            ts,
            type: 'date_filter_changed',
            participantId: state.studyParticipantId,
            checkpointTag: state.studyCheckpointTag,
            from: dateFilterFrom,
            to: dateFilterTo,
          };
          const cap = 5000;
          const nextEvents =
            state.studyEvents.length >= cap
              ? state.studyEvents.slice(state.studyEvents.length - cap + 1)
              : state.studyEvents;
          return {
            dateFilterFrom,
            dateFilterTo,
            studyEvents: [...nextEvents, event],
          };
        }),
      setHeatmapEnabled: (heatmapEnabled) => set({ heatmapEnabled }),
      setMoodHeatmapEnabled: (moodHeatmapEnabled) => set({ moodHeatmapEnabled }),
      setMarkersVisible: (markersVisible) => set({ markersVisible }),
      setRadiusCirclesEnabled: (radiusCirclesEnabled) => set({ radiusCirclesEnabled }),
      setTopShelfVisibleMain: (topShelfVisibleMain) => set({ topShelfVisibleMain }),
      setTopShelfVisibleSpatial: (topShelfVisibleSpatial) => set({ topShelfVisibleSpatial }),
      setSidebarView: (sidebarView) => set({ sidebarView }),

      setSidebarWidth: (width) =>
        set({
          sidebarWidth: Math.min(560, Math.max(240, width)),
        }),

      addMemory: (memory) =>
        set((state) => ({
          ...pushUndoInSet(state),
          memories: [...state.memories, memory],
          isAddingMemory: false,
          pendingLatLng: null,
        })),
      addMemories: (memories) =>
        set((state) => {
          if (!memories.length) return state;
          return {
            ...pushUndoInSet(state),
            memories: [...state.memories, ...memories],
            isAddingMemory: false,
            pendingLatLng: null,
          };
        }),

      updateMemory: (id, updates) =>
        set((state) => ({
          ...pushUndoInSet(state),
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),
      updateMemoryWithoutUndo: (id, updates) =>
        set((state) => ({
          memories: state.memories.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),

      removeMemory: (id) =>
        set((state) => ({
          ...pushUndoInSet(state),
          memories: state.memories.filter((m) => m.id !== id),
          selectedMemoryId: state.selectedMemoryId === id ? null : state.selectedMemoryId,
        })),

      removeMemoriesVaultMirror: (ids) => {
        const idSet = new Set(ids);
        if (idSet.size === 0) return;
        set((state) => {
          const nextMemories = state.memories.filter((m) => !idSet.has(m.id));
          if (nextMemories.length === state.memories.length) return state;
          const nextSearch =
            state.memorySearchMatchIds?.filter((x) => !idSet.has(x)) ?? null;
          return {
            memories: nextMemories,
            selectedMemoryId:
              state.selectedMemoryId && idSet.has(state.selectedMemoryId) ? null : state.selectedMemoryId,
            editingMemory:
              state.editingMemory && idSet.has(state.editingMemory.id) ? null : state.editingMemory,
            cardTargetMemoryId:
              state.cardTargetMemoryId && idSet.has(state.cardTargetMemoryId)
                ? null
                : state.cardTargetMemoryId,
            selectedMemoryIds: state.selectedMemoryIds.filter((x) => !idSet.has(x)),
            recallModalMemoryId:
              state.recallModalMemoryId && idSet.has(state.recallModalMemoryId)
                ? null
                : state.recallModalMemoryId,
            recallSessionQueue: state.recallSessionQueue.filter((x) => !idSet.has(x)),
            memorySearchMatchIds: nextSearch?.length ? nextSearch : null,
          };
        });
      },

      setSelectedMemory: (memory) =>
        set({
          selectedMemoryId: memory?.id ?? null,
          // Memory search drawer (z ~1121) stacks above editor/viewer — close it when opening a memory.
          ...(memory != null ? { memorySearchDrawerOpen: false, memorySearchMatchIds: null } : {}),
        }),

      setCardTargetMemoryId: (id) => set({ cardTargetMemoryId: id }),

      setTheme: (theme) => set({ theme }),
      setMapStyle: (mapStyle) => set({ mapStyle }),

      setTimelineEnabled: (timelineEnabled) => set({ timelineEnabled }),

      setTimelineLineStyle: (timelineLineStyle) => set({ timelineLineStyle }),

      setDefaultGroupId: (defaultGroupId) => set({ defaultGroupId }),

      addGroup: (group) =>
        set((state) => {
          const normalizedName = (group.name ?? '').trim().slice(0, GROUP_NAME_MAX_LENGTH) || 'Group';
          return {
            ...pushUndoInSet(state),
            groups: [...state.groups, { ...group, name: normalizedName }],
            defaultGroupId: group.id,
          };
        }),

      removeGroup: (id) =>
        set((state) => ({
          ...pushUndoInSet(state),
          groups: state.groups.filter((g) => g.id !== id),
          memories: state.memories.map((m) =>
            m.groupId === id ? { ...m, groupId: null } : m
          ),
          defaultGroupId: state.defaultGroupId === id ? null : state.defaultGroupId,
        })),

      updateGroup: (id, updates) =>
        set((state) => {
          const normalizedUpdates =
            typeof updates.name === 'string'
              ? {
                  ...updates,
                  name: updates.name.trim().slice(0, GROUP_NAME_MAX_LENGTH) || 'Group',
                }
              : updates;
          return {
            ...pushUndoInSet(state),
            groups: state.groups.map((g) =>
              g.id === id ? { ...g, ...normalizedUpdates } : g
            ),
          };
        }),

      reorderMemoriesInGroup: (groupId, orderedMemoryIds) =>
        set((state) => {
          const updates = new Map<string, number>();
          orderedMemoryIds.forEach((id, index) => updates.set(id, index));
          return {
            ...pushUndoInSet(state),
            memories: state.memories.map((m) => {
              const g = m.groupId ?? null;
              if (g !== groupId) return m;
              const order = updates.get(m.id);
              return order === undefined ? m : { ...m, order };
            }),
          };
        }),

      setEditingMemory: (editingMemory) =>
        set({
          editingMemory,
          ...(editingMemory != null ? { memorySearchDrawerOpen: false, memorySearchMatchIds: null } : {}),
        }),

      setIsAddingMemory: (isAddingMemory) => set({ isAddingMemory }),

      setPendingLatLng: (pendingLatLng) => set({ pendingLatLng }),

      setSearchHighlight: (searchHighlight) => set({ searchHighlight }),

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      setMapView: (mapView) => set({ mapView }),
      setHasChosenStartLocation: (hasChosenStartLocation) => set({ hasChosenStartLocation }),

      pushUndo: () =>
        set((state) => pushUndoInSet(state)),

      undo: () =>
        set((state) => {
          const last = state.undoStack[state.undoStack.length - 1];
          if (!last) return state;
          const memories = mergeImagesIntoRestored(last.memories, state.memories);
          return {
            memories,
            groups: last.groups,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [
              ...state.redoStack,
              { memories: stripImagesForUndoSnapshot(state.memories), groups: state.groups },
            ],
          };
        }),

      redo: () =>
        set((state) => {
          const next = state.redoStack[state.redoStack.length - 1];
          if (!next) return state;
          const memories = mergeImagesIntoRestored(next.memories, state.memories);
          return {
            memories,
            groups: next.groups,
            undoStack: [
              ...state.undoStack,
              { memories: stripImagesForUndoSnapshot(state.memories), groups: state.groups },
            ],
            redoStack: state.redoStack.slice(0, -1),
          };
        }),

      toggleSelection: (id) =>
        set((state) => ({
          selectedMemoryIds: state.selectedMemoryIds.includes(id)
            ? state.selectedMemoryIds.filter((x) => x !== id)
            : [...state.selectedMemoryIds, id],
        })),

      setSelection: (ids) => set({ selectedMemoryIds: ids }),

      clearSelection: () => set({ selectedMemoryIds: [] }),

      bulkDelete: (ids) =>
        set((state) => {
          const idSet = new Set(ids);
          return {
            ...pushUndoInSet(state),
            memories: state.memories.filter((m) => !idSet.has(m.id)),
            selectedMemoryId: state.selectedMemoryId && idSet.has(state.selectedMemoryId) ? null : state.selectedMemoryId,
            selectedMemoryIds: [],
          };
        }),

      bulkMoveToGroup: (ids, groupId) =>
        set((state) => {
          const idSet = new Set(ids);
          return {
            ...pushUndoInSet(state),
            memories: state.memories.map((m) =>
              idSet.has(m.id) ? { ...m, groupId } : m
            ),
            selectedMemoryIds: [],
          };
        }),

      resetAllData: () =>
        set((state) => ({
          memories: [],
          groups: [],
          selectedMemoryId: null,
          selectedMemoryIds: [],
          recallModalMemoryId: null,
          recallMode: null,
          recallSessionQueue: [],
          recallSessionInitialCount: 0,
          recallSessions: [],
          currentSessionRemembered: 0,
          currentSessionForgot: 0,
          defaultGroupId: null,
          editingMemory: null,
          mapView: null,
          hasChosenStartLocation: false,
          studyParticipantId: null,
          studyCheckpointTag: null,
          studyCheckpointCompletedByParticipant: {},
          studyEvents: [],
          undoStack: [],
          redoStack: [],
          vaultElectronPath: null,
          vaultLastSyncAt: null,
          vaultLastSyncError: null,
          settingsDrawerOpen: false,
          memorySearchDrawerOpen: false,
          memorySearchMatchIds: null,
          topShelfVisibleMain: true,
          topShelfVisibleSpatial: false,
          radiusCirclesEnabled: false,
          vaultLinkNonce: state.vaultLinkNonce + 1,
          aiQueue: [],
          aiProcessing: null,
        })),
    }),
    {
      name: 'temporal-self-storage',
      version: 15,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        mapView: state.mapView,
        hasChosenStartLocation: state.hasChosenStartLocation,
        memories: state.memories,
        groups: state.groups,
        theme: state.theme,
        mapStyle: state.mapStyle,
        timelineLineStyle: state.timelineLineStyle,
        defaultGroupId: state.defaultGroupId,
        sidebarWidth: state.sidebarWidth,
        skipDeleteConfirmation: state.skipDeleteConfirmation,
        recallSessions: state.recallSessions,
        studyParticipantId: state.studyParticipantId,
        studyCheckpointTag: state.studyCheckpointTag,
        studyCheckpointCompletedByParticipant: state.studyCheckpointCompletedByParticipant,
        studyEvents: state.studyEvents,
        vaultElectronPath: state.vaultElectronPath,
        vaultLastSyncAt: state.vaultLastSyncAt,
        topShelfVisibleMain: state.topShelfVisibleMain,
        topShelfVisibleSpatial: state.topShelfVisibleSpatial,
        radiusCirclesEnabled: state.radiusCirclesEnabled,
        aiProvider: state.aiProvider,
        aiApiKey: state.aiApiKey,
        aiAutoAnalyze: state.aiAutoAnalyze,
      }),
      migrate: (persisted: unknown, version: number) => {
        const withVault = (x: Record<string, unknown>): Record<string, unknown> => {
          const rest = { ...x };
          delete rest.vaultSyncEnabled;
          return {
            ...rest,
            vaultElectronPath: typeof rest.vaultElectronPath === 'string' ? rest.vaultElectronPath : null,
            vaultLastSyncAt: typeof rest.vaultLastSyncAt === 'string' ? rest.vaultLastSyncAt : null,
          };
        };
        if (persisted == null || typeof persisted !== 'object') return persisted as Record<string, unknown>;
        const p = persisted as Record<string, unknown>;
        if (version < 1) {
          return withVault({
            ...p,
            memories: Array.isArray(p.memories) ? p.memories : [],
            groups: Array.isArray(p.groups) ? p.groups : [],
            theme: p.theme === 'light' ? 'light' : 'dark',
            defaultGroupId: p.defaultGroupId ?? null,
            sidebarWidth: 320,
          });
        }
        if (version < 2 && p.sidebarWidth == null) {
          return withVault({ ...p, sidebarWidth: 320 });
        }
        if (version < 3 && p.skipDeleteConfirmation == null) {
          return withVault({ ...p, skipDeleteConfirmation: false });
        }
        if (version < 4 && p.recallSessions == null) {
          return withVault({ ...p, recallSessions: [] });
        }
        if (version < 5) {
          return withVault({
            ...p,
            mapView: p.mapView ?? null,
            hasChosenStartLocation: p.hasChosenStartLocation ?? false,
          });
        }
        if (version < 6) {
          return withVault({
            ...p,
            studyParticipantId: p.studyParticipantId ?? null,
            studyCheckpointTag: p.studyCheckpointTag ?? null,
            studyCheckpointCompletedAt: p.studyCheckpointCompletedAt ?? {},
            studyEvents: Array.isArray(p.studyEvents) ? p.studyEvents : [],
          });
        }
        if (version < 7) {
          const legacy =
            p.studyCheckpointCompletedAt &&
            typeof p.studyCheckpointCompletedAt === 'object' &&
            !Array.isArray(p.studyCheckpointCompletedAt)
              ? (p.studyCheckpointCompletedAt as Partial<Record<StudyCheckpointTag, string>>)
              : null;
          const existing =
            p.studyCheckpointCompletedByParticipant &&
            typeof p.studyCheckpointCompletedByParticipant === 'object' &&
            !Array.isArray(p.studyCheckpointCompletedByParticipant)
              ? (p.studyCheckpointCompletedByParticipant as Record<
                  string,
                  Partial<Record<StudyCheckpointTag, string>>
                >)
              : null;
          if (existing) {
            return withVault({ ...p, studyCheckpointCompletedByParticipant: existing });
          }
          const pid =
            typeof p.studyParticipantId === 'string' && p.studyParticipantId.trim()
              ? p.studyParticipantId.trim()
              : '_legacy';
          const byParticipant: Record<string, Partial<Record<StudyCheckpointTag, string>>> = legacy
            ? { [pid]: legacy }
            : {};
          return withVault({ ...p, studyCheckpointCompletedByParticipant: byParticipant });
        }
        if (version < 9) {
          const copy = { ...p };
          delete copy.vaultSyncEnabled;
          return withVault(copy);
        }
        if (version < 10) {
          return withVault({
            ...p,
            mapStyle: p.mapStyle === 'watercolor' ? 'watercolor' : 'default',
          });
        }
        if (version < 11) {
          return withVault({
            ...p,
            aiProvider:
              p.aiProvider === 'gemini' || p.aiProvider === 'openai' || p.aiProvider === 'claude'
                ? p.aiProvider
                : null,
            aiApiKey: typeof p.aiApiKey === 'string' ? p.aiApiKey : '',
            aiAutoAnalyze: typeof p.aiAutoAnalyze === 'boolean' ? p.aiAutoAnalyze : false,
          });
        }
        if (version < 12) {
          const copy = {
            ...p,
            terrainContoursEnabled: typeof p.terrainContoursEnabled === 'boolean' ? p.terrainContoursEnabled : false,
            boundariesEnabled: typeof p.boundariesEnabled === 'boolean' ? p.boundariesEnabled : false,
          };
          delete (copy as Record<string, unknown>).poiOverlayEnabled;
          delete (copy as Record<string, unknown>).naturalOverlayEnabled;
          return withVault(copy);
        }
        if (version < 13) {
          const copy = { ...p };
          delete copy.poiOverlayEnabled;
          delete copy.naturalOverlayEnabled;
          return withVault(copy);
        }
        if (version < 14) {
          return withVault({
            ...p,
            radiusCirclesEnabled: typeof p.radiusCirclesEnabled === 'boolean' ? p.radiusCirclesEnabled : false,
          });
        }
        if (version < 15) {
          const copy = { ...p };
          delete copy.terrainContoursEnabled;
          delete copy.boundariesEnabled;
          return withVault(copy);
        }
        return withVault(p);
      },
    }
  )
);
