import { useMemoryStore } from '../store/memoryStore';

export function TimelineToggle() {
  const timelineEnabled = useMemoryStore((s) => s.timelineEnabled);
  const setTimelineEnabled = useMemoryStore((s) => s.setTimelineEnabled);

  const toggle = () => {
    setTimelineEnabled(!timelineEnabled);
  };

  return (
    <div
      className="fixed z-[900] group"
      style={{
        top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 224px)',
        right: 'max(24px, env(safe-area-inset-right, 0px))',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95"
        aria-label={timelineEnabled ? 'Hide timeline' : 'Show timeline'}
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
          {/* Smooth path through points (timeline/route) */}
          <path d="M4 17c2-2 4-4 6-4s4 2 6 4 2 3 4 3" />
          <circle cx="4" cy="17" r="1.5" fill="currentColor" />
          <circle cx="10" cy="13" r="1.5" fill="currentColor" />
          <circle cx="16" cy="17" r="1.5" fill="currentColor" />
          <circle cx="20" cy="20" r="1.5" fill="currentColor" />
        </svg>
      </button>
      <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        Path
      </span>
    </div>
  );
}
