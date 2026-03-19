import { useEffect, useCallback } from 'react';
import { useMemoryStore } from '../store/memoryStore';

export const FOCUS_SEARCH_EVENT = 'memory-atlas-focus-search';

/** Global keyboard shortcuts: N = new memory, / = focus search, Escape = close modals, Ctrl+Z = undo, Ctrl+Shift+Z = redo. */
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          if (e.key === 'Escape') {
            (e.target as HTMLInputElement).blur();
            return;
          }
          if (e.key === '/' || e.ctrlKey || e.metaKey) return;
        }
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

      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
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
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
