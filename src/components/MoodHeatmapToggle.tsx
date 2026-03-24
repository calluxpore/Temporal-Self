import { useMemoryStore } from '../store/memoryStore';

type TopControlVariant = 'fixed' | 'bar';

export function MoodHeatmapToggle({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const moodHeatmapEnabled = useMemoryStore((s) => s.moodHeatmapEnabled);
  const setMoodHeatmapEnabled = useMemoryStore((s) => s.setMoodHeatmapEnabled);
  const activeClasses = moodHeatmapEnabled ? 'border-accent bg-accent-glow text-accent' : '';

  return (
    <div
      className={variant === 'bar' ? 'relative z-[900] flex-shrink-0 group' : 'fixed z-[900] group'}
      style={
        variant === 'bar'
          ? undefined
          : {
              top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 392px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }
      }
    >
      <button
        type="button"
        onClick={() => setMoodHeatmapEnabled(!moodHeatmapEnabled)}
        className={`flex touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95 ${variant === 'bar' ? 'h-10 w-10 min-h-[36px] min-w-[36px]' : 'h-12 w-12 min-h-[44px] min-w-[44px]'} ${activeClasses}`}
        aria-label={moodHeatmapEnabled ? 'Hide mood heatmap' : 'Show mood heatmap'}
        aria-pressed={moodHeatmapEnabled}
        title="Mood heatmap (Alt+G)"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={moodHeatmapEnabled ? 'text-accent' : 'text-text-secondary'}
        >
          <path d="M3 17c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 4.5-2" />
          <circle cx="6" cy="9" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="11" cy="7" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="9" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="6" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span
        className={
          variant === 'bar'
            ? 'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
            : 'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
        }
      >
        Mood heatmap (Alt+G)
      </span>
    </div>
  );
}
