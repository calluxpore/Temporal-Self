import { useMemoryStore } from '../store/memoryStore';

type TopControlVariant = 'fixed' | 'bar';

export function HeatmapToggle({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const heatmapEnabled = useMemoryStore((s) => s.heatmapEnabled);
  const setHeatmapEnabled = useMemoryStore((s) => s.setHeatmapEnabled);
  const activeClasses = heatmapEnabled ? 'border-accent bg-accent-glow text-accent' : '';

  return (
    <div
      className={variant === 'bar' ? 'relative z-[900] flex-shrink-0 group' : 'fixed z-[900] group'}
      style={
        variant === 'bar'
          ? undefined
          : {
              top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 280px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }
      }
    >
      <button
        type="button"
        onClick={() => setHeatmapEnabled(!heatmapEnabled)}
        className={`flex touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95 ${variant === 'bar' ? 'h-10 w-10 min-h-[36px] min-w-[36px]' : 'h-12 w-12 min-h-[44px] min-w-[44px]'} ${activeClasses}`}
        aria-label={heatmapEnabled ? 'Hide heatmap' : 'Show heatmap'}
        aria-pressed={heatmapEnabled}
        title="Heatmap (Alt+H)"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={heatmapEnabled ? 'text-accent' : 'text-text-secondary'}
          aria-hidden
        >
          {/* Overlapping intensity blobs — reads as density / heat, not geometric radius */}
          <circle cx="9" cy="14" r="4.5" opacity="0.22" />
          <circle cx="14" cy="12" r="5" opacity="0.32" />
          <circle cx="11" cy="10" r="4" opacity="0.42" />
          <circle cx="12" cy="13" r="2.8" opacity="0.65" />
        </svg>
      </button>
      <span
        className={
          variant === 'bar'
            ? 'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
            : 'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
        }
      >
        Heatmap (Alt+H)
      </span>
    </div>
  );
}
