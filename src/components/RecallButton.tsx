import { useMemoryStore } from '../store/memoryStore';
import { isDueForReview, getRecallSessionOrderedIds } from '../utils/spacedRepetition';
import { memoriesInSidebarOrder } from '../utils/memoryOrder';

type TopControlVariant = 'fixed' | 'bar';

function hasValidCoordinates(lat: unknown, lng: unknown): boolean {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

export function RecallButton({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const memories = useMemoryStore((s) => s.memories);
  const groups = useMemoryStore((s) => s.groups);
  const setRecallModalMemoryId = useMemoryStore((s) => s.setRecallModalMemoryId);
  const setRecallMode = useMemoryStore((s) => s.setRecallMode);
  const setRecallSessionQueue = useMemoryStore((s) => s.setRecallSessionQueue);
  const setRecallSessionInitialCount = useMemoryStore((s) => s.setRecallSessionInitialCount);
  const resetRecallSession = useMemoryStore((s) => s.resetRecallSession);
  const logStudyRecallSessionStarted = useMemoryStore((s) => s.logStudyRecallSessionStarted);
  const dueCount = memories.filter(isDueForReview).length;
  const spatialEligibleCount = memories.filter((m) => hasValidCoordinates(m.lat, m.lng)).length;

  const startFlashcardRecall = () => {
    const orderedIds = getRecallSessionOrderedIds(memories);
    if (orderedIds.length === 0) return;
    resetRecallSession();
    logStudyRecallSessionStarted(dueCount);
    setRecallMode('flashcard');
    setRecallSessionInitialCount(dueCount);
    setRecallSessionQueue(orderedIds);
    setRecallModalMemoryId(orderedIds[0]);
  };

  const startSpatialWalk = () => {
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
    const spatialDueCount = memories.filter((m) => isDueForReview(m) && hasValidCoordinates(m.lat, m.lng)).length;
    resetRecallSession();
    logStudyRecallSessionStarted(spatialDueCount);
    setRecallMode('spatial');
    setRecallSessionInitialCount(orderedIds.length);
    setRecallSessionQueue(orderedIds);
    setRecallModalMemoryId(orderedIds[0]);
  };

  return (
    <div
      className={variant === 'bar' ? 'relative z-[900] flex flex-shrink-0 items-center gap-1.5' : 'fixed z-[900] flex items-center gap-2'}
      style={
        variant === 'bar'
          ? undefined
          : {
              top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 56px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }
      }
    >
      <button
        type="button"
        onClick={startFlashcardRecall}
        className={`relative flex touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95 ${
          variant === 'bar' ? 'h-10 w-10 min-h-[36px] min-w-[36px]' : 'h-12 w-12 min-h-[44px] min-w-[44px]'
        }`}
        aria-label={dueCount > 0 ? `Flashcards: ${dueCount} due` : 'Practice flashcards (spaced repetition)'}
        title="Flashcards (Alt+R)"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-secondary"
        >
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
        </svg>
        {dueCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-white"
            aria-hidden
          >
            {dueCount > 99 ? '99+' : dueCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={startSpatialWalk}
        disabled={spatialEligibleCount === 0}
        className={`relative flex touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
          variant === 'bar' ? 'h-10 w-10 min-h-[36px] min-w-[36px]' : 'h-12 w-12 min-h-[44px] min-w-[44px]'
        }`}
        aria-label={spatialEligibleCount > 0 ? `Spatial walk: ${spatialEligibleCount} eligible` : 'Spatial walk unavailable'}
        title={spatialEligibleCount === 0 ? 'Spatial walk (Alt+W) — no memories with coordinates' : 'Spatial walk (Alt+W)'}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-secondary"
        >
          <circle cx="5" cy="18" r="1.8" />
          <circle cx="19" cy="6" r="1.8" />
          <path d="M6.8 17.2c3.4-1.8 4.3-4.7 6.7-6.3 1.5-1 3.3-1.4 5.5-1.1" />
          <path d="M11.5 8.5l2.2 2.2 2.7-2.7" />
        </svg>
        {spatialEligibleCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-white"
            aria-hidden
          >
            {spatialEligibleCount > 99 ? '99+' : spatialEligibleCount}
          </span>
        )}
      </button>
    </div>
  );
}
