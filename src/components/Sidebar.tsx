import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useMapRef } from '../context/mapContextState';
import { useIsMd } from '../hooks/useMediaQuery';
import { useMemoryStore } from '../store/memoryStore';
import { ConfirmDialog } from './ConfirmDialog';
import { CalendarView } from './CalendarView';
import { StatsDashboard } from './StatsDashboard';
import { MemoryStatsDashboard } from './MemoryStatsDashboard';
import { MoodStatsDashboard } from './MoodStatsDashboard';
import { compareMemories } from '../utils/memoryOrder';
import { formatDate } from '../utils/formatDate';
import { getMemoryLabel } from '../utils/memoryLabel';
import { getMemoryImages } from '../utils/imageUtils';
import { filterMemoriesByDate } from '../utils/dateFilter';
import type { Memory } from '../types/memory';
import { memoryNoteDisplayName } from '../utils/vaultMarkdown';
import { SidebarVaultRow } from './SidebarVaultRow';

const UNGROUPED_ID = '__ungrouped__';

function memoryMatchesSearch(m: Memory, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  const tagMatch = (m.tags ?? []).some((t) => t.toLowerCase().includes(lower));
  return (
    tagMatch ||
    m.title.toLowerCase().includes(lower) ||
    memoryNoteDisplayName(m).toLowerCase().includes(lower) ||
    m.notes.toLowerCase().includes(lower) ||
    m.date.toLowerCase().includes(lower)
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const i = lower.indexOf(q);
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent">{text.slice(i, i + query.length)}</span>
      {text.slice(i + query.length)}
    </>
  );
}

const DRAG_MEMORY_KEY = 'memory-id';
const DROP_LINE_END = '__drop_end__';
const GROUP_NAME_MAX_LENGTH = 6;

/** Insert draggedId so it appears before beforeId, or at end if beforeId is null. */
function insertBefore(ids: string[], draggedId: string, beforeId: string | null): string[] {
  const without = ids.filter((id) => id !== draggedId);
  if (beforeId === null) return [...without, draggedId];
  const idx = without.indexOf(beforeId);
  if (idx === -1) return ids;
  return [...without.slice(0, idx), draggedId, ...without.slice(idx)];
}

/** Thin drop target between list items; shows a line when dragging over (same group). */
function ReorderDropLine({
  insertBeforeId,
  lineId,
  isActive,
  isSameGroup,
  memoryIds,
  onReorderMemories,
  onDragOverLine,
  onDragLeaveLine,
}: {
  insertBeforeId: string | null;
  lineId: string;
  isActive: boolean;
  isSameGroup: boolean;
  memoryIds: string[];
  onReorderMemories: (orderedIds: string[]) => void;
  onDragOverLine: (id: string) => void;
  onDragLeaveLine: () => void;
}) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (isSameGroup) onDragOverLine(lineId);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData(DRAG_MEMORY_KEY) || e.dataTransfer.getData('text/plain');
    if (!id || !memoryIds.includes(id)) return;
    onReorderMemories(insertBefore(memoryIds, id, insertBeforeId));
  };

  return (
    <div
      role="presentation"
      className={`reorder-drop-line flex-shrink-0 ${isActive && isSameGroup ? 'active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeaveLine}
      onDrop={handleDrop}
      aria-hidden
    />
  );
}

const CUSTOM_LABEL_MAX_LENGTH = 3;

function MemoryListItem({
  memory,
  searchQuery,
  label,
  onLabelChange,
  onClick,
  onToggleHide,
  onToggleStar,
  onToggleSelect,
  isSelected,
  onDelete,
  onDragStartWithId,
}: {
  memory: Memory;
  searchQuery: string;
  /** Default letter label (A, B, …) when no customLabel. */
  label?: string;
  onLabelChange?: (memoryId: string, value: string | null) => void;
  onClick: (e: React.MouseEvent) => void;
  onToggleHide: (e: React.MouseEvent) => void;
  onToggleStar?: (e: React.MouseEvent) => void;
  onToggleSelect?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  onDelete?: (e: React.MouseEvent) => void;
  onDragStartWithId?: (memoryId: string) => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState(memory.customLabel ?? '');
  const isHidden = memory.hidden ?? false;
  const displayLabel = (memory.customLabel?.trim() || null) ?? label ?? '';
  const effectiveLabel = displayLabel || label || '';

  const handleLabelBlur = () => {
    setEditingLabel(false);
    const v = editValue.trim() || null;
    if (v !== (memory.customLabel ?? null)) onLabelChange?.(memory.id, v);
  };

  return (
    <div className="group/mem flex w-full min-h-[28px] touch-target items-center gap-0 rounded-sm border-l-2 border-transparent py-0.5 pl-0 pr-0.5 transition-colors hover:bg-surface-elevated hover:border-accent/50 active:bg-surface-elevated">
      {onToggleSelect && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}
          className="flex-shrink-0 flex min-h-[28px] min-w-[28px] items-center justify-center p-1 text-text-muted hover:text-accent"
          aria-label={isSelected ? 'Deselect' : 'Select'}
          aria-pressed={isSelected}
        >
          <span className={`flex h-4 w-4 items-center justify-center rounded border-2 ${isSelected ? 'border-accent bg-accent' : 'border-current'}`}>
            {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}
          </span>
        </button>
      )}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MEMORY_KEY, memory.id);
          e.dataTransfer.setData('text/plain', memory.id);
          e.dataTransfer.effectAllowed = 'move';
          onDragStartWithId?.(memory.id);
        }}
        className="flex-shrink-0 flex min-h-[32px] min-w-[32px] cursor-grab active:cursor-grabbing items-center justify-center p-1.5 text-text-muted opacity-60 group-hover/mem:opacity-100"
        aria-hidden
        title="Reorder"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>
      {label != null && (
        <div className="flex-shrink-0 mr-1.5 flex h-6 w-6 items-center justify-center rounded bg-surface-elevated">
          {editingLabel ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value.slice(0, CUSTOM_LABEL_MAX_LENGTH))}
              onBlur={handleLabelBlur}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), handleLabelBlur())}
              className="h-full w-full rounded bg-surface text-center text-sm text-text-primary outline-none ring-1 ring-accent"
              maxLength={CUSTOM_LABEL_MAX_LENGTH}
              autoFocus
              aria-label="Edit icon or emoji"
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditValue(memory.customLabel ?? '');
                setEditingLabel(true);
              }}
              className="flex h-full w-full items-center justify-center rounded text-sm text-text-secondary transition-colors hover:bg-surface hover:text-accent"
              title="Icon"
              aria-label="Edit icon or emoji"
            >
              {effectiveLabel}
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        className={`flex min-h-[28px] min-w-0 flex-1 touch-target items-center gap-1.5 py-0.5 pl-1 text-left ${isHidden ? 'opacity-50' : ''}`}
      >
        <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded bg-surface-elevated">
          {getMemoryImages(memory)[0] ? (
            <img
              src={getMemoryImages(memory)[0]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-muted font-mono text-[10px]">
              —
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-text-primary truncate text-[11px] font-medium leading-tight">
            {highlightMatch(memoryNoteDisplayName(memory), searchQuery)}
          </div>
          <div className="font-mono text-[10px] text-text-secondary leading-tight">
            {formatDate(memory.date)}
          </div>
        </div>
      </button>
      {onToggleStar && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleStar(e); }}
          className="flex-shrink-0 touch-target min-h-[28px] min-w-[28px] p-1 text-text-muted hover:text-accent active:text-accent"
          aria-label={memory.starred ? 'Unstar' : 'Star'}
          title={memory.starred ? 'Unstar' : 'Star'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={memory.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleHide(e);
        }}
        className="flex-shrink-0 touch-target min-h-[28px] min-w-[28px] p-1 text-text-muted hover:text-accent active:text-accent"
        aria-label={isHidden ? 'Show on map' : 'Hide from map'}
          title={isHidden ? 'Show' : 'Hide'}
      >
        {isHidden ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24 4.24" />
            <path d="M1 1l22 22" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          className="flex-shrink-0 touch-target min-h-[28px] min-w-[28px] p-1 text-text-muted hover:text-danger"
          aria-label="Delete memory"
          title="Delete memory"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      )}
    </div>
  );
}

function GroupSection({
  id,
  name,
  memories,
  searchQuery,
  collapsed,
  hidden,
  onToggleCollapse,
  onToggleHide,
  onDelete,
  onMemoryClick,
  onMemoryToggleHide,
  onMemoryToggleStar,
  onMemoryToggleSelect,
  selectedMemoryIds,
  onMemoryDelete,
  onMemoryLabelChange,
  onDropMemory,
  onReorderMemories,
  isUngrouped,
  memoryLabels,
  openForRename,
  onClearOpenForRename,
}: {
  id: string;
  name: string;
  memories: Memory[];
  searchQuery: string;
  collapsed: boolean;
  hidden: boolean;
  onToggleCollapse: () => void;
  onToggleHide: () => void;
  onDelete: () => void;
  onMemoryClick: (e: React.MouseEvent, m: Memory) => void;
  onMemoryToggleHide: (e: React.MouseEvent, m: Memory) => void;
  onMemoryToggleStar?: (e: React.MouseEvent, m: Memory) => void;
  onMemoryToggleSelect?: (e: React.MouseEvent, m: Memory) => void;
  selectedMemoryIds?: string[];
  onMemoryDelete?: (e: React.MouseEvent, m: Memory) => void;
  onMemoryLabelChange?: (memoryId: string, value: string | null) => void;
  onDropMemory: (memoryId: string) => void;
  onReorderMemories: (orderedMemoryIds: string[]) => void;
  isUngrouped: boolean;
  memoryLabels?: Map<string, string>;
  openForRename?: boolean;
  onClearOpenForRename?: () => void;
}) {
  const [editingName, setEditingName] = useState(!!openForRename);
  const [editValue, setEditValue] = useState(name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isListDragOver, setIsListDragOver] = useState(false);
  const [draggedMemoryId, setDraggedMemoryId] = useState<string | null>(null);
  const [activeDropLineId, setActiveDropLineId] = useState<string | null>(null);
  const updateGroup = useMemoryStore((s) => s.updateGroup);
  const memoryIds = memories.map((m) => m.id);
  const isSameGroupDrag = memoryIds.includes(draggedMemoryId ?? '');
  useEffect(() => {
    queueMicrotask(() => setEditValue(name));
  }, [name]);
  useEffect(() => {
    if (openForRename) queueMicrotask(() => setEditingName(true));
  }, [openForRename]);

  const handleBlur = () => {
    setEditingName(false);
    onClearOpenForRename?.();
    const nextName = editValue.trim().slice(0, GROUP_NAME_MAX_LENGTH);
    if (nextName && nextName !== name) {
      updateGroup(id, { name: nextName });
    } else {
      setEditValue(name);
    }
  };

  const handleHeaderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setIsListDragOver(false);
    const memoryId = e.dataTransfer.getData(DRAG_MEMORY_KEY);
    if (memoryId) onDropMemory(memoryId);
  };

  const handleListDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.dataTransfer.types.includes(DRAG_MEMORY_KEY)) setIsListDragOver(true);
  };

  const handleListDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsListDragOver(false);
    const memoryId = e.dataTransfer.getData(DRAG_MEMORY_KEY);
    if (memoryId && !memoryIds.includes(memoryId)) onDropMemory(memoryId);
  };

  const handleListDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsListDragOver(false);
  };

  const isHidden = hidden ?? false;
  return (
    <div className={`py-0 ${isHidden ? 'opacity-70' : ''}`}>
      <div
        className={`flex items-center gap-1 rounded-sm border transition-colors ${isDragOver ? 'border-accent bg-accent-glow' : 'border-transparent hover:border-border'}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleHeaderDragOver}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="touch-target flex min-h-[28px] min-w-[28px] flex-shrink-0 items-center justify-center p-1 text-text-muted hover:text-text-primary"
          aria-label={collapsed ? 'Expand group' : 'Collapse group'}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {editingName && !isUngrouped ? (
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value.slice(0, GROUP_NAME_MAX_LENGTH))}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), handleBlur())}
            className="font-mono flex-1 bg-transparent py-0 text-[11px] text-text-primary outline-none"
            maxLength={GROUP_NAME_MAX_LENGTH}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => !isUngrouped && setEditingName(true)}
            className="font-mono flex-1 truncate py-0 text-left text-[11px] font-medium text-text-secondary"
          >
            {name}
          </button>
        )}
        {!isUngrouped && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHide();
              }}
              className="touch-target flex min-h-[28px] min-w-[28px] flex-shrink-0 items-center justify-center p-1 text-text-muted hover:text-accent"
              aria-label={isHidden ? 'Show group on map' : 'Hide group from map'}
              title={isHidden ? 'Show' : 'Hide'}
            >
              {isHidden ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24 4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="touch-target flex min-h-[28px] min-w-[28px] flex-shrink-0 items-center justify-center p-1 text-text-muted hover:text-danger"
              aria-label="Delete group"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </>
        )}
      </div>
      {!collapsed && (
        <div
          className={`ml-1 mt-0 min-h-[24px] space-y-0 rounded-r border-l border-border pl-1 transition-colors ${isListDragOver ? 'bg-accent-glow' : ''}`}
          onDragOver={handleListDragOver}
          onDragLeave={handleListDragLeave}
          onDrop={handleListDrop}
          onDragEnd={() => {
            setDraggedMemoryId(null);
            setActiveDropLineId(null);
            setIsListDragOver(false);
          }}
        >
          {memories.map((m) => (
            <div
              key={m.id}
              className={`transition-opacity duration-200 ${
                memoryMatchesSearch(m, searchQuery) ? 'opacity-100' : 'opacity-20'
              }`}
            >
              <ReorderDropLine
                insertBeforeId={m.id}
                lineId={m.id}
                isActive={activeDropLineId === m.id}
                isSameGroup={isSameGroupDrag}
                memoryIds={memoryIds}
                onReorderMemories={onReorderMemories}
                onDragOverLine={setActiveDropLineId}
                onDragLeaveLine={() => setActiveDropLineId(null)}
              />
              <MemoryListItem
                memory={m}
                searchQuery={searchQuery}
                label={memoryLabels?.get(m.id)}
                onLabelChange={onMemoryLabelChange}
                onClick={(e) => onMemoryClick(e, m)}
                onToggleHide={(e) => onMemoryToggleHide(e, m)}
                onToggleStar={onMemoryToggleStar ? (e) => onMemoryToggleStar(e, m) : undefined}
                onToggleSelect={onMemoryToggleSelect ? (e) => onMemoryToggleSelect(e, m) : undefined}
                isSelected={selectedMemoryIds?.includes(m.id)}
                onDelete={onMemoryDelete ? (e) => onMemoryDelete(e, m) : undefined}
                onDragStartWithId={(id) => {
                  setDraggedMemoryId(id);
                }}
              />
            </div>
          ))}
          <ReorderDropLine
            insertBeforeId={null}
            lineId={DROP_LINE_END}
            isActive={activeDropLineId === DROP_LINE_END}
            isSameGroup={isSameGroupDrag}
            memoryIds={memoryIds}
            onReorderMemories={onReorderMemories}
            onDragOverLine={setActiveDropLineId}
            onDragLeaveLine={() => setActiveDropLineId(null)}
          />
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const map = useMapRef();
  const memories = useMemoryStore((s) => s.memories);
  const groups = useMemoryStore((s) => s.groups);
  const searchQuery = useMemoryStore((s) => s.searchQuery);
  const sidebarOpen = useMemoryStore((s) => s.sidebarOpen);
  const setSidebarOpen = useMemoryStore((s) => s.setSidebarOpen);
  const filterStarred = useMemoryStore((s) => s.filterStarred);
  const sortBy = useMemoryStore((s) => s.sortBy);
  const sortOrder = useMemoryStore((s) => s.sortOrder);
  const dateFilterFrom = useMemoryStore((s) => s.dateFilterFrom);
  const dateFilterTo = useMemoryStore((s) => s.dateFilterTo);
  const setDateFilter = useMemoryStore((s) => s.setDateFilter);
  const sidebarView = useMemoryStore((s) => s.sidebarView);
  const setSidebarView = useMemoryStore((s) => s.setSidebarView);
  const sidebarWidth = useMemoryStore((s) => s.sidebarWidth);
  const setSidebarWidth = useMemoryStore((s) => s.setSidebarWidth);
  const isMd = useIsMd();
  const setCardTargetMemoryId = useMemoryStore((s) => s.setCardTargetMemoryId);
  const addGroup = useMemoryStore((s) => s.addGroup);
  const removeGroup = useMemoryStore((s) => s.removeGroup);
  const updateGroup = useMemoryStore((s) => s.updateGroup);
  const updateMemory = useMemoryStore((s) => s.updateMemory);
  const reorderMemoriesInGroup = useMemoryStore((s) => s.reorderMemoriesInGroup);
  const panelRef = useRef<HTMLDivElement>(null);
  const [ungroupedCollapsed, setUngroupedCollapsed] = useState(false);
  const [openForRenameId, setOpenForRenameId] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteMemory, setConfirmDeleteMemory] = useState<{ id: string; name: string } | null>(null);
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef({ clientX: 0, width: 0 });
  const removeMemory = useMemoryStore((s) => s.removeMemory);
  const selectedMemoryIds = useMemoryStore((s) => s.selectedMemoryIds);
  const toggleSelection = useMemoryStore((s) => s.toggleSelection);
  const clearSelection = useMemoryStore((s) => s.clearSelection);
  const bulkDelete = useMemoryStore((s) => s.bulkDelete);
  const bulkMoveToGroup = useMemoryStore((s) => s.bulkMoveToGroup);
  const undo = useMemoryStore((s) => s.undo);
  const redo = useMemoryStore((s) => s.redo);
  const undoStack = useMemoryStore((s) => s.undoStack);
  const redoStack = useMemoryStore((s) => s.redoStack);
  const recallSessions = useMemoryStore((s) => s.recallSessions);
  const skipDeleteConfirmation = useMemoryStore((s) => s.skipDeleteConfirmation);
  const setSkipDeleteConfirmation = useMemoryStore((s) => s.setSkipDeleteConfirmation);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStartRef.current = { clientX: e.clientX, width: sidebarWidth };
      setResizing(true);
    },
    [sidebarWidth]
  );

  useEffect(() => {
    if (!resizing) return;
    const minW = 240;
    const maxW = 560;
    const onMove = (e: MouseEvent) => {
      const { clientX, width } = resizeStartRef.current;
      setSidebarWidth(Math.min(maxW, Math.max(minW, width + (e.clientX - clientX))));
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, setSidebarWidth]);

  const handleMemoryClick = useCallback(
    (e: React.MouseEvent, memory: Memory) => {
      e.stopPropagation();
      e.preventDefault();
      setCardTargetMemoryId(memory.id);
      if (map) {
        map.flyTo([memory.lat, memory.lng], 17, { duration: 0.5 });
      }
    },
    [map, setCardTargetMemoryId]
  );

  const handleMemoryToggleHide = useCallback(
    (e: React.MouseEvent, m: Memory) => {
      e.stopPropagation();
      updateMemory(m.id, { hidden: !(m.hidden ?? false) });
    },
    [updateMemory]
  );

  const handleMemoryDelete = useCallback(
    (e: React.MouseEvent, m: Memory) => {
      e.stopPropagation();
      if (skipDeleteConfirmation) {
        removeMemory(m.id);
      } else {
        setConfirmDeleteMemory({ id: m.id, name: memoryNoteDisplayName(m) });
      }
    },
    [skipDeleteConfirmation, removeMemory]
  );

  const handleMemoryLabelChange = useCallback(
    (memoryId: string, value: string | null) => {
      updateMemory(memoryId, { customLabel: value || undefined });
    },
    [updateMemory]
  );

  const handleMemoryToggleStar = useCallback(
    (e: React.MouseEvent, m: Memory) => {
      e.stopPropagation();
      updateMemory(m.id, { starred: !(m.starred ?? false) });
    },
    [updateMemory]
  );

  const handleMemoryToggleSelect = useCallback(
    (e: React.MouseEvent, m: Memory) => {
      e.stopPropagation();
      toggleSelection(m.id);
    },
    [toggleSelection]
  );

  const visibleMemories = useMemo(() => {
    let list = filterStarred ? memories.filter((m) => m.starred) : memories;
    list = filterMemoriesByDate(list, dateFilterFrom, dateFilterTo);
    return list;
  }, [memories, filterStarred, dateFilterFrom, dateFilterTo]);
  const sortCompare = useCallback(
    (a: Memory, b: Memory) => compareMemories(a, b, sortBy, sortOrder),
    [sortBy, sortOrder]
  );
  const ungroupedMemories = useMemo(
    () => visibleMemories.filter((m) => !(m.groupId ?? null)).sort(sortCompare),
    [visibleMemories, sortCompare]
  );
  const memoryLabels = useMemo(() => {
    const labels = new Map<string, string>();
    const groupedVisible = visibleMemories.filter((m) => (m.groupId ?? null) !== null);

    // Ungrouped: A, B, C...
    ungroupedMemories.forEach((m, i) => labels.set(m.id, getMemoryLabel(i)));

    // Suffix from group order in `groups` (stable while group exists). Hiding a group must not
    // renumber other groups; deleting a group removes its slot and may renumber.
    groups.forEach((g, groupIndex) => {
      const inGroup = groupedVisible
        .filter((m) => (m.groupId ?? null) === g.id)
        .sort(sortCompare);
      if (inGroup.length === 0) return;
      const suffix = String(groupIndex + 1);
      inGroup.forEach((m, i) => labels.set(m.id, `${getMemoryLabel(i)}${suffix}`));
    });
    return labels;
  }, [ungroupedMemories, groups, visibleMemories, sortCompare]);
  const createNewGroup = () => {
    const id = crypto.randomUUID();
    addGroup({
      id,
      name: 'Group',
      collapsed: false,
    });
    setOpenForRenameId(id);
  };

  return (
    <>
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`absolute left-0 top-0 z-[800] flex h-full min-h-full w-[85vw] max-w-[320px] flex-row border-r border-border bg-background/95 shadow-lg backdrop-blur-[20px] transition-transform duration-300 md:max-w-none ${
          sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          ...(isMd ? { width: sidebarWidth } : undefined),
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-1 border-b border-border p-2">
          <div className="flex items-center gap-1">
            <h1 className="font-display min-w-0 flex-1 text-base font-semibold tracking-tight text-text-primary">
              Temporal Self
            </h1>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSidebarOpen(!sidebarOpen);
              }}
              className="touch-target flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-border bg-surface/80 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-accent active:scale-95"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>
          <div className="flex gap-0.5 overflow-x-auto rounded border border-border p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setSidebarView('list')}
              title="List view (Alt+L)"
              className={`font-mono min-h-[28px] shrink-0 rounded px-2 text-[9px] transition-colors sm:text-[10px] ${
                sidebarView === 'list' ? 'bg-surface-elevated text-accent' : 'text-text-muted hover:text-text-primary'
              }`}
              aria-pressed={sidebarView === 'list'}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setSidebarView('calendar')}
              title="Calendar view (Alt+K)"
              className={`font-mono min-h-[28px] shrink-0 rounded px-2 text-[9px] transition-colors sm:text-[10px] ${
                sidebarView === 'calendar' ? 'bg-surface-elevated text-accent' : 'text-text-muted hover:text-text-primary'
              }`}
              aria-pressed={sidebarView === 'calendar'}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setSidebarView('stats')}
              title="Totals, places, dates"
              className={`font-mono min-h-[28px] shrink-0 rounded px-2 text-[9px] transition-colors sm:text-[10px] ${
                sidebarView === 'stats' ? 'bg-surface-elevated text-accent' : 'text-text-muted hover:text-text-primary'
              }`}
              aria-pressed={sidebarView === 'stats'}
            >
              Memory stats
            </button>
            <button
              type="button"
              onClick={() => setSidebarView('moodStats')}
              title="Mood and emotion analytics"
              className={`font-mono min-h-[28px] shrink-0 rounded px-2 text-[9px] transition-colors sm:text-[10px] ${
                sidebarView === 'moodStats' ? 'bg-surface-elevated text-accent' : 'text-text-muted hover:text-text-primary'
              }`}
              aria-pressed={sidebarView === 'moodStats'}
            >
              Mood stats
            </button>
            <button
              type="button"
              onClick={() => setSidebarView('memoryStats')}
              title="Spaced repetition recall"
              className={`font-mono min-h-[28px] shrink-0 rounded px-2 text-[9px] transition-colors sm:text-[10px] ${
                sidebarView === 'memoryStats' ? 'bg-surface-elevated text-accent' : 'text-text-muted hover:text-text-primary'
              }`}
              aria-pressed={sidebarView === 'memoryStats'}
            >
              Recall stats
            </button>
          </div>
          <div className="h-px bg-accent/40" />
        </div>
        <div
          className={
            sidebarView === 'stats'
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-1.5'
              : 'min-h-0 flex-1 overflow-y-auto px-1.5 py-1'
          }
        >
          {sidebarView === 'calendar' && (
            <CalendarView
              memories={memories}
              onMemoryClick={handleMemoryClick}
              onDateFilter={setDateFilter}
              selectedDateFrom={dateFilterFrom}
              selectedDateTo={dateFilterTo}
            />
          )}
          {sidebarView === 'stats' && (
            <StatsDashboard memories={memories} />
          )}
          {sidebarView === 'moodStats' && (
            <MoodStatsDashboard memories={memories} />
          )}
          {sidebarView === 'memoryStats' && (
            <MemoryStatsDashboard memories={memories} recallSessions={recallSessions} />
          )}
          {sidebarView === 'list' && (
            <>
          {selectedMemoryIds.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1 rounded border border-accent/50 bg-accent-glow p-1.5">
              <span className="font-mono text-[10px] text-text-primary">{selectedMemoryIds.length} selected</span>
              <button
                type="button"
                onClick={() => setBulkMoveOpen(true)}
                className="font-mono min-h-[28px] rounded border border-border bg-surface px-2 text-[10px] text-text-primary hover:bg-surface-elevated"
              >
                Move to group
              </button>
              <button
                type="button"
                onClick={() => {
                  if (skipDeleteConfirmation) {
                    bulkDelete(selectedMemoryIds);
                  } else {
                    setConfirmBulkDelete(true);
                  }
                }}
                className="font-mono min-h-[28px] rounded border border-danger/50 px-2 text-[10px] text-danger hover:bg-danger/10"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="font-mono min-h-[28px] rounded border border-border px-2 text-[10px] text-text-muted hover:text-text-primary"
              >
                Clear
              </button>
              {bulkMoveOpen && (
                <div className="w-full border-t border-border pt-1.5">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { bulkMoveToGroup(selectedMemoryIds, g.id); setBulkMoveOpen(false); }}
                      className="font-mono block w-full text-left py-1 px-2 text-[10px] text-text-primary hover:bg-surface-elevated"
                    >
                      {g.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { bulkMoveToGroup(selectedMemoryIds, null); setBulkMoveOpen(false); }}
                    className="font-mono block w-full text-left py-1 px-2 text-[10px] text-text-primary hover:bg-surface-elevated"
                  >
                    Ungrouped
                  </button>
                </div>
              )}
            </div>
          )}
          {visibleMemories.length === 0 && (memories.length === 0 || filterStarred) && (
            <p className="font-body py-1 text-center text-[11px] text-text-muted">
              {filterStarred ? 'No starred memories. Star a memory to see it here.' : 'No memories yet. Click the map to pin one.'}
            </p>
          )}
          <div className="space-y-0.5">
            <GroupSection
              id={UNGROUPED_ID}
              name="Ungrouped"
              memories={ungroupedMemories}
              searchQuery={searchQuery}
              collapsed={ungroupedCollapsed}
              hidden={false}
              onToggleCollapse={() => setUngroupedCollapsed((c) => !c)}
              onToggleHide={() => {}}
              onDelete={() => {}}
              onMemoryClick={handleMemoryClick}
              onMemoryToggleHide={handleMemoryToggleHide}
              onMemoryToggleStar={handleMemoryToggleStar}
              onMemoryToggleSelect={handleMemoryToggleSelect}
              selectedMemoryIds={selectedMemoryIds}
              onMemoryDelete={handleMemoryDelete}
              onMemoryLabelChange={handleMemoryLabelChange}
              onDropMemory={(memoryId) => updateMemory(memoryId, { groupId: null })}
              onReorderMemories={(orderedIds) => reorderMemoriesInGroup(null, orderedIds)}
              isUngrouped
              memoryLabels={memoryLabels}
            />
            {groups.map((g) => (
              <GroupSection
                key={g.id}
                id={g.id}
                name={g.name}
                memories={visibleMemories
                  .filter((m) => (m.groupId ?? null) === g.id)
                  .sort(sortCompare)}
                searchQuery={searchQuery}
                collapsed={g.collapsed}
                hidden={g.hidden ?? false}
                onToggleCollapse={() => updateGroup(g.id, { collapsed: !g.collapsed })}
                onToggleHide={() => updateGroup(g.id, { hidden: !(g.hidden ?? false) })}
                onDelete={() => {
                  if (skipDeleteConfirmation) {
                    removeGroup(g.id);
                  } else {
                    setConfirmDeleteGroup({ id: g.id, name: g.name });
                  }
                }}
                onMemoryClick={handleMemoryClick}
                onMemoryToggleHide={handleMemoryToggleHide}
                onMemoryToggleStar={handleMemoryToggleStar}
                onMemoryToggleSelect={handleMemoryToggleSelect}
                selectedMemoryIds={selectedMemoryIds}
                onMemoryDelete={handleMemoryDelete}
                onMemoryLabelChange={handleMemoryLabelChange}
                onDropMemory={(memoryId) => updateMemory(memoryId, { groupId: g.id })}
                onReorderMemories={(orderedIds) => reorderMemoriesInGroup(g.id, orderedIds)}
                isUngrouped={false}
                memoryLabels={memoryLabels}
                openForRename={openForRenameId === g.id}
                onClearOpenForRename={() => setOpenForRenameId(null)}
              />
            ))}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                createNewGroup();
              }}
              className="font-mono touch-target mt-1 flex min-h-[28px] w-full items-center gap-1 rounded-sm border border-dashed border-border py-1.5 pl-1.5 text-[11px] text-text-muted hover:border-accent hover:text-accent active:border-accent"
            >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New group
          </button>
          </div>
            </>
          )}
        </div>
        <div className="border-t border-border px-2 py-1.5 space-y-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.length === 0}
              className="font-mono min-h-[24px] flex-1 rounded border border-border px-1.5 text-[10px] text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Undo"
              title="Undo"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0}
              className="font-mono min-h-[24px] flex-1 rounded border border-border px-1.5 text-[10px] text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Redo"
              title="Redo"
            >
              Redo
            </button>
          </div>
          <SidebarVaultRow />
          <p className="font-mono text-[10px] text-text-secondary">
            {filterStarred ? `${visibleMemories.length} FAVORITES` : `${memories.length} MEMORIES ARCHIVED`}
          </p>
        </div>
        </div>
        {isMd && sidebarOpen && (
          <div
            role="separator"
            aria-label="Resize sidebar"
            onMouseDown={handleResizeStart}
            className="flex w-2 flex-shrink-0 cursor-col-resize items-stretch border-r border-transparent bg-transparent hover:border-accent/50 active:bg-accent/20"
          />
        )}
      </div>
      {!sidebarOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSidebarOpen(true);
          }}
          className="absolute left-4 z-[801] flex h-9 w-9 items-center justify-center rounded border border-border bg-surface/90 text-text-secondary backdrop-blur-sm transition-colors hover:bg-surface-elevated hover:text-accent active:scale-95"
          style={{ top: 'max(1rem, env(safe-area-inset-top, 0px))' }}
          aria-label="Open sidebar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rotate-180">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <ConfirmDialog
        key={confirmDeleteGroup ? 'open' : 'closed'}
        open={!!confirmDeleteGroup}
        title="Delete group"
        message={confirmDeleteGroup ? `Delete group "${confirmDeleteGroup.name}"? Memories will move to Ungrouped.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        dontAskAgainLabel="Do not show this message again"
        onConfirm={(dontAskAgain) => {
          if (confirmDeleteGroup) {
            if (dontAskAgain) setSkipDeleteConfirmation(true);
            removeGroup(confirmDeleteGroup.id);
            setConfirmDeleteGroup(null);
          }
        }}
        onCancel={() => setConfirmDeleteGroup(null)}
      />
      <ConfirmDialog
        key={confirmDeleteMemory ? 'open' : 'closed'}
        open={!!confirmDeleteMemory}
        title="Delete memory"
        message={confirmDeleteMemory ? `Delete "${confirmDeleteMemory.name}" from the atlas?` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        dontAskAgainLabel="Do not show this message again"
        onConfirm={(dontAskAgain) => {
          if (confirmDeleteMemory) {
            if (dontAskAgain) setSkipDeleteConfirmation(true);
            removeMemory(confirmDeleteMemory.id);
            setConfirmDeleteMemory(null);
          }
        }}
        onCancel={() => setConfirmDeleteMemory(null)}
      />
      <ConfirmDialog
        key={confirmBulkDelete ? 'open' : 'closed'}
        open={confirmBulkDelete}
        title="Delete"
        message={`Delete ${selectedMemoryIds.length} selected memory(ies) from the atlas?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        dontAskAgainLabel="Do not show this message again"
        onConfirm={(dontAskAgain) => {
          if (dontAskAgain) setSkipDeleteConfirmation(true);
          bulkDelete(selectedMemoryIds);
          setConfirmBulkDelete(false);
        }}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </>
  );
}
