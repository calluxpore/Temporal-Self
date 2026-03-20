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
  searchQuery: string;
  theme: 'dark' | 'light';
  timelineEnabled: boolean;
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
  /** Show memory markers and labels on map. */
  markersVisible: boolean;
  /** Sidebar main view: 'list' | 'calendar' | 'stats' | 'memoryStats'. */
  sidebarView: 'list' | 'calendar' | 'stats' | 'memoryStats';
  /** Bulk selection: memory IDs. */
  selectedMemoryIds: string[];
  /** Undo stack (snapshots of { memories, groups }). */
  undoStack: { memories: Memory[]; groups: Group[] }[];
  redoStack: { memories: Memory[]; groups: Group[] }[];
  /** Memory id shown in recall modal (null = closed). */
  recallModalMemoryId: string | null;
  setRecallModalMemoryId: (id: string | null) => void;
  /** Ordered list of memory ids for the current recall session (so we show each in turn). */
  recallSessionQueue: string[];
  setRecallSessionQueue: (ids: string[]) => void;
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
  setSkipDeleteConfirmation: (value: boolean) => void;
  setMemories: (memories: Memory[]) => void;
  setGroups: (groups: Group[]) => void;
  setFilterStarred: (value: boolean) => void;
  setSortBy: (sortBy: MemoryState['sortBy']) => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  setDateFilter: (from: string | null, to: string | null) => void;
  setHeatmapEnabled: (value: boolean) => void;
  setMarkersVisible: (value: boolean) => void;
  setSidebarView: (view: MemoryState['sidebarView']) => void;
  addMemory: (memory: Memory) => void;
  updateMemory: (id: string, updates: Partial<Memory>) => void;
  removeMemory: (id: string) => void;
  setSelectedMemory: (memory: Memory | null) => void;
  setCardTargetMemoryId: (id: string | null) => void;
  setEditingMemory: (memory: Memory | null) => void;
  setIsAddingMemory: (value: boolean) => void;
  setPendingLatLng: (value: PendingLatLng | null) => void;
  setSearchHighlight: (value: SearchHighlight) => void;
  setSidebarOpen: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  setMapView: (value: { lat: number; lng: number; zoom: number }) => void;
  setHasChosenStartLocation: (value: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setTimelineEnabled: (value: boolean) => void;
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
      searchQuery: '',
      theme: 'dark',
      timelineEnabled: false,
      defaultGroupId: null,
      sidebarWidth: 320,
      filterStarred: false,
      sortBy: 'default',
      sortOrder: 'asc',
      dateFilterFrom: null,
      dateFilterTo: null,
      heatmapEnabled: false,
      markersVisible: true,
      sidebarView: 'list',
      selectedMemoryIds: [],
      undoStack: [],
      redoStack: [],
      recallModalMemoryId: null,
      recallSessionQueue: [],
      recallSessions: [],
      currentSessionRemembered: 0,
      currentSessionForgot: 0,
      studyParticipantId: null,
      studyCheckpointTag: null,
      studyCheckpointCompletedByParticipant: {},
      studyEvents: [],
      skipDeleteConfirmation: false,

      setRecallModalMemoryId: (id) => set({ recallModalMemoryId: id }),
      setRecallSessionQueue: (recallSessionQueue) => set({ recallSessionQueue }),
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
      setMarkersVisible: (markersVisible) => set({ markersVisible }),
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

      updateMemory: (id, updates) =>
        set((state) => ({
          ...pushUndoInSet(state),
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),

      removeMemory: (id) =>
        set((state) => ({
          ...pushUndoInSet(state),
          memories: state.memories.filter((m) => m.id !== id),
          selectedMemoryId: state.selectedMemoryId === id ? null : state.selectedMemoryId,
        })),

      setSelectedMemory: (memory) =>
        set({ selectedMemoryId: memory?.id ?? null }),

      setCardTargetMemoryId: (id) => set({ cardTargetMemoryId: id }),

      setTheme: (theme) => set({ theme }),

      setTimelineEnabled: (timelineEnabled) => set({ timelineEnabled }),

      setDefaultGroupId: (defaultGroupId) => set({ defaultGroupId }),

      addGroup: (group) =>
        set((state) => ({
          ...pushUndoInSet(state),
          groups: [...state.groups, group],
          defaultGroupId: group.id,
        })),

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
        set((state) => ({
          ...pushUndoInSet(state),
          groups: state.groups.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),

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

      setEditingMemory: (editingMemory) => set({ editingMemory }),

      setIsAddingMemory: (isAddingMemory) => set({ isAddingMemory }),

      setPendingLatLng: (pendingLatLng) => set({ pendingLatLng }),

      setSearchHighlight: (searchHighlight) => set({ searchHighlight }),

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),
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
        set({
          memories: [],
          groups: [],
          selectedMemoryId: null,
          selectedMemoryIds: [],
          recallModalMemoryId: null,
          recallSessionQueue: [],
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
        }),
    }),
    {
      name: 'memory-atlas-storage',
      version: 7,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        mapView: state.mapView,
        hasChosenStartLocation: state.hasChosenStartLocation,
        memories: state.memories,
        groups: state.groups,
        theme: state.theme,
        defaultGroupId: state.defaultGroupId,
        sidebarWidth: state.sidebarWidth,
        skipDeleteConfirmation: state.skipDeleteConfirmation,
        recallSessions: state.recallSessions,
        studyParticipantId: state.studyParticipantId,
        studyCheckpointTag: state.studyCheckpointTag,
        studyCheckpointCompletedByParticipant: state.studyCheckpointCompletedByParticipant,
        studyEvents: state.studyEvents,
      }),
      migrate: (persisted: unknown, version: number) => {
        if (persisted == null || typeof persisted !== 'object') return persisted as Record<string, unknown>;
        const p = persisted as Record<string, unknown>;
        if (version < 1) {
          return {
            ...p,
            memories: Array.isArray(p.memories) ? p.memories : [],
            groups: Array.isArray(p.groups) ? p.groups : [],
            theme: p.theme === 'light' ? 'light' : 'dark',
            defaultGroupId: p.defaultGroupId ?? null,
            sidebarWidth: 320,
          } as Record<string, unknown>;
        }
        if (version < 2 && p.sidebarWidth == null) {
          return { ...p, sidebarWidth: 320 } as Record<string, unknown>;
        }
        if (version < 3 && p.skipDeleteConfirmation == null) {
          return { ...p, skipDeleteConfirmation: false } as Record<string, unknown>;
        }
        if (version < 4 && p.recallSessions == null) {
          return { ...p, recallSessions: [] } as Record<string, unknown>;
        }
        if (version < 5) {
          return {
            ...p,
            mapView: p.mapView ?? null,
            hasChosenStartLocation: p.hasChosenStartLocation ?? false,
          } as Record<string, unknown>;
        }
        if (version < 6) {
          return {
            ...p,
            studyParticipantId: p.studyParticipantId ?? null,
            studyCheckpointTag: p.studyCheckpointTag ?? null,
            studyCheckpointCompletedAt: p.studyCheckpointCompletedAt ?? {},
            studyEvents: Array.isArray(p.studyEvents) ? p.studyEvents : [],
          } as Record<string, unknown>;
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
            return { ...p, studyCheckpointCompletedByParticipant: existing } as Record<string, unknown>;
          }
          const pid =
            typeof p.studyParticipantId === 'string' && p.studyParticipantId.trim()
              ? p.studyParticipantId.trim()
              : '_legacy';
          const byParticipant: Record<string, Partial<Record<StudyCheckpointTag, string>>> = legacy
            ? { [pid]: legacy }
            : {};
          return { ...p, studyCheckpointCompletedByParticipant: byParticipant } as Record<string, unknown>;
        }
        return persisted as Record<string, unknown>;
      },
    }
  )
);
