import { useMemoryStore } from '../store/memoryStore';
import { isDueForReview, getRecallSessionOrderedIds } from '../utils/spacedRepetition';

type TopControlVariant = 'fixed' | 'bar';

export function RecallButton({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const memories = useMemoryStore((s) => s.memories);
  const setRecallModalMemoryId = useMemoryStore((s) => s.setRecallModalMemoryId);
  const setRecallSessionQueue = useMemoryStore((s) => s.setRecallSessionQueue);
  const resetRecallSession = useMemoryStore((s) => s.resetRecallSession);
  const logStudyRecallSessionStarted = useMemoryStore((s) => s.logStudyRecallSessionStarted);
  const dueCount = memories.filter(isDueForReview).length;

  const startRecall = () => {
    const orderedIds = getRecallSessionOrderedIds(memories);
    if (orderedIds.length === 0) return;
    resetRecallSession();
    logStudyRecallSessionStarted(dueCount);
    setRecallSessionQueue(orderedIds);
    setRecallModalMemoryId(orderedIds[0]);
  };

  const tooltipPositionClass =
    variant === 'bar'
      ? 'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
      : 'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100';

  return (
    <div
      className={variant === 'bar' ? 'relative z-[900] flex-shrink-0 group' : 'fixed z-[900] group'}
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
        onClick={startRecall}
        className="relative flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95"
        aria-label={dueCount > 0 ? `Recall: ${dueCount} due` : 'Practice recall (spaced repetition)'}
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
      <span className={tooltipPositionClass}>
        Recall
      </span>
    </div>
  );
}
