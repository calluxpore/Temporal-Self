import { useEffect, useCallback } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { getRecallSessionOrderedIds, isDueForReview } from '../utils/spacedRepetition';
import { memoriesInSidebarOrder } from '../utils/memoryOrder';

export const HOTKEY_RESET_EVENT = 'temporal-self-hotkey-reset';
export const HOTKEY_EXPORT_EVENT = 'temporal-self-hotkey-export';
export const HOTKEY_IMPORT_EVENT = 'temporal-self-hotkey-import';
export const HOTKEY_IMPORT_PHOTOS_EVENT = 'temporal-self-hotkey-import-photos';
export const HOTKEY_SHOT_EVENT = 'temporal-self-hotkey-shot';
export const HOTKEY_REPORT_EVENT = 'temporal-self-hotkey-report';

function hasValidCoordinates(lat: unknown, lng: unknown): boolean {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

/** Global keyboard shortcuts: N = new memory, Escape = close modals, Ctrl+Z = undo, Ctrl+Shift+Z = redo. */
export function useKeyboardShortcuts(onRequestNewMemory?: () => void) {
  const editingMemory = useMemoryStore((s) => s.editingMemory);
  const isAddingMemory = useMemoryStore((s) => s.isAddingMemory);
  const selectedMemoryId = useMemoryStore((s) => s.selectedMemoryId);
  const setEditingMemory = useMemoryStore((s) => s.setEditingMemory);
  const setSelectedMemory = useMemoryStore((s) => s.setSelectedMemory);
  const setIsAddingMemory = useMemoryStore((s) => s.setIsAddingMemory);
  const setPendingLatLng = useMemoryStore((s) => s.setPendingLatLng);
  const undo = useMemoryStore((s) => s.undo);
  const redo = useMemoryStore((s) => s.redo);
  const undoStack = useMemoryStore((s) => s.undoStack);
  const redoStack = useMemoryStore((s) => s.redoStack);
  const sidebarOpen = useMemoryStore((s) => s.sidebarOpen);
  const setSidebarOpen = useMemoryStore((s) => s.setSidebarOpen);
  const theme = useMemoryStore((s) => s.theme);
  const setTheme = useMemoryStore((s) => s.setTheme);
  const mapStyle = useMemoryStore((s) => s.mapStyle);
  const setMapStyle = useMemoryStore((s) => s.setMapStyle);
  const memories = useMemoryStore((s) => s.memories);
  const groups = useMemoryStore((s) => s.groups);
  const setRecallModalMemoryId = useMemoryStore((s) => s.setRecallModalMemoryId);
  const setRecallMode = useMemoryStore((s) => s.setRecallMode);
  const setRecallSessionQueue = useMemoryStore((s) => s.setRecallSessionQueue);
  const setRecallSessionInitialCount = useMemoryStore((s) => s.setRecallSessionInitialCount);
  const resetRecallSession = useMemoryStore((s) => s.resetRecallSession);
  const logStudyRecallSessionStarted = useMemoryStore((s) => s.logStudyRecallSessionStarted);
  const timelineLineStyle = useMemoryStore((s) => s.timelineLineStyle);
  const setTimelineLineStyle = useMemoryStore((s) => s.setTimelineLineStyle);
  const timelineEnabled = useMemoryStore((s) => s.timelineEnabled);
  const setTimelineEnabled = useMemoryStore((s) => s.setTimelineEnabled);
  const heatmapEnabled = useMemoryStore((s) => s.heatmapEnabled);
  const setHeatmapEnabled = useMemoryStore((s) => s.setHeatmapEnabled);
  const moodHeatmapEnabled = useMemoryStore((s) => s.moodHeatmapEnabled);
  const setMoodHeatmapEnabled = useMemoryStore((s) => s.setMoodHeatmapEnabled);
  const markersVisible = useMemoryStore((s) => s.markersVisible);
  const setMarkersVisible = useMemoryStore((s) => s.setMarkersVisible);
  const radiusCirclesEnabled = useMemoryStore((s) => s.radiusCirclesEnabled);
  const setRadiusCirclesEnabled = useMemoryStore((s) => s.setRadiusCirclesEnabled);
  const filterStarred = useMemoryStore((s) => s.filterStarred);
  const setFilterStarred = useMemoryStore((s) => s.setFilterStarred);
  const setSidebarView = useMemoryStore((s) => s.setSidebarView);
  const setMemorySearchDrawerOpen = useMemoryStore((s) => s.setMemorySearchDrawerOpen);
  const setSettingsDrawerOpen = useMemoryStore((s) => s.setSettingsDrawerOpen);
  const recallMode = useMemoryStore((s) => s.recallMode);
  const topShelfVisibleMain = useMemoryStore((s) => s.topShelfVisibleMain);
  const topShelfVisibleSpatial = useMemoryStore((s) => s.topShelfVisibleSpatial);
  const setTopShelfVisibleMain = useMemoryStore((s) => s.setTopShelfVisibleMain);
  const setTopShelfVisibleSpatial = useMemoryStore((s) => s.setTopShelfVisibleSpatial);

  const isTypingTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest('input, textarea, [contenteditable="true"], [role="textbox"]');
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Recall: Escape only (before global Escape) so it still works when map/Leaflet holds focus.
      {
        const st = useMemoryStore.getState();
        const recallId = st.recallModalMemoryId;
        const spatialActive = st.recallMode === 'spatial';
        if ((recallId || spatialActive) && e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const memory = st.memories.find((m) => m.id === recallId);
          if (memory) {
            st.endRecallSession();
          }
          st.setRecallModalMemoryId(null);
          st.setRecallMode(null);
          return;
        }
      }

      if (isTypingTarget(e.target)) {
        if (e.key === 'Escape' && e.target instanceof HTMLElement) {
          e.target.blur();
          return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      }

      if (e.key === 'Escape') {
        if (editingMemory) {
          setEditingMemory(null);
          e.preventDefault();
        } else if (selectedMemoryId) {
          setSelectedMemory(null);
          e.preventDefault();
        } else if (isAddingMemory) {
          setIsAddingMemory(false);
          setPendingLatLng(null);
          e.preventDefault();
        }
        return;
      }

      // Backquote (`): toggle left drawer.
      if ((e.key === '`' || e.code === 'Backquote') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (redoStack.length > 0) redo();
        } else {
          if (undoStack.length > 0) undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (redoStack.length > 0) redo();
        return;
      }

      // Ctrl+S: open archive search drawer.
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSettingsDrawerOpen(false);
        setMemorySearchDrawerOpen(true);
        return;
      }

      // Ctrl+I: screenshot
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(HOTKEY_SHOT_EVENT));
        return;
      }

      // Ctrl+R: report
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(HOTKEY_REPORT_EVENT));
        return;
      }

      // Shift+S: settings
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setMemorySearchDrawerOpen(false);
        setSettingsDrawerOpen(true);
        return;
      }

      // Alt+ shortcuts.
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'd') {
          e.preventDefault();
          setTheme(theme === 'dark' ? 'light' : 'dark');
          return;
        }
        if (k === 'r') {
          e.preventDefault();
          const orderedIds = getRecallSessionOrderedIds(memories);
          if (orderedIds.length === 0) return;
          const dueCount = memories.filter(isDueForReview).length;
          resetRecallSession();
          logStudyRecallSessionStarted(dueCount);
          setRecallMode('flashcard');
          setRecallSessionInitialCount(dueCount);
          setRecallSessionQueue(orderedIds);
          setRecallModalMemoryId(orderedIds[0]);
          return;
        }
        if (k === 'w') {
          e.preventDefault();
          const orderedIds = memoriesInSidebarOrder(memories, groups).filter((m) => {
            const valid = hasValidCoordinates(m.lat, m.lng);
            if (!valid) {
              console.warn('[Spatial Walk] Skipping memory without valid coordinates:', m.id);
            }
            return valid;
          }).map((m) => m.id);
          if (orderedIds.length === 0) {
            window.alert('No memories with map coordinates are available for Spatial Walk.');
            return;
          }
          const dueCount = memories.filter((m) => isDueForReview(m) && hasValidCoordinates(m.lat, m.lng)).length;
          resetRecallSession();
          logStudyRecallSessionStarted(dueCount);
          setRecallMode('spatial');
          setRecallSessionInitialCount(orderedIds.length);
          setRecallSessionQueue(orderedIds);
          setRecallModalMemoryId(orderedIds[0]);
          return;
        }
        if (k === 'c') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(HOTKEY_RESET_EVENT));
          return;
        }
        if (k === 's') {
          e.preventDefault();
          setTimelineLineStyle(timelineLineStyle === 'spline' ? 'orthogonal' : 'spline');
          return;
        }
        if (k === 'p') {
          e.preventDefault();
          setTimelineEnabled(!timelineEnabled);
          return;
        }
        if (k === 'h') {
          e.preventDefault();
          setHeatmapEnabled(!heatmapEnabled);
          return;
        }
        if (k === 'g') {
          e.preventDefault();
          setMoodHeatmapEnabled(!moodHeatmapEnabled);
          return;
        }
        if (k === 't') {
          e.preventDefault();
          setMapStyle(mapStyle === 'watercolor' ? 'default' : 'watercolor');
          return;
        }
        if (k === 'm') {
          e.preventDefault();
          setMarkersVisible(!markersVisible);
          return;
        }
        if (k === 'o') {
          e.preventDefault();
          setRadiusCirclesEnabled(!radiusCirclesEnabled);
          return;
        }
        if (k === 'f') {
          e.preventDefault();
          setFilterStarred(!filterStarred);
          return;
        }
        if (k === 'l') {
          e.preventDefault();
          setSidebarView('list');
          return;
        }
        if (k === 'k') {
          e.preventDefault();
          setSidebarView('calendar');
          return;
        }
        if (k === 'e') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(HOTKEY_EXPORT_EVENT));
          return;
        }
        if (k === 'i') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(HOTKEY_IMPORT_EVENT));
          return;
        }
        if (k === 'x') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(HOTKEY_IMPORT_PHOTOS_EVENT));
          return;
        }
        if (k === 'b') {
          e.preventDefault();
          if (recallMode === 'spatial') {
            setTopShelfVisibleSpatial(!topShelfVisibleSpatial);
          } else {
            setTopShelfVisibleMain(!topShelfVisibleMain);
          }
          return;
        }
      }

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest?.('input, textarea, [contenteditable]')) return;
        e.preventDefault();
        onRequestNewMemory?.();
        return;
      }
    },
    [
      editingMemory,
      selectedMemoryId,
      isAddingMemory,
      setEditingMemory,
      setSelectedMemory,
      setIsAddingMemory,
      setPendingLatLng,
      undo,
      redo,
      undoStack.length,
      redoStack.length,
      onRequestNewMemory,
      sidebarOpen,
      setSidebarOpen,
      theme,
      setTheme,
      mapStyle,
      setMapStyle,
      memories,
      groups,
      setRecallModalMemoryId,
      setRecallMode,
      setRecallSessionQueue,
      setRecallSessionInitialCount,
      resetRecallSession,
      logStudyRecallSessionStarted,
      timelineLineStyle,
      setTimelineLineStyle,
      timelineEnabled,
      setTimelineEnabled,
      heatmapEnabled,
      setHeatmapEnabled,
      moodHeatmapEnabled,
      setMoodHeatmapEnabled,
      markersVisible,
      setMarkersVisible,
      radiusCirclesEnabled,
      setRadiusCirclesEnabled,
      filterStarred,
      setFilterStarred,
      setSidebarView,
      setMemorySearchDrawerOpen,
      setSettingsDrawerOpen,
      recallMode,
      topShelfVisibleMain,
      topShelfVisibleSpatial,
      setTopShelfVisibleMain,
      setTopShelfVisibleSpatial,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);
}
