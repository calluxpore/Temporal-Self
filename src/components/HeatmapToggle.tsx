import { useMemoryStore } from '../store/memoryStore';

export function HeatmapToggle() {
  const heatmapEnabled = useMemoryStore((s) => s.heatmapEnabled);
  const setHeatmapEnabled = useMemoryStore((s) => s.setHeatmapEnabled);

  return (
    <button
      type="button"
      onClick={() => setHeatmapEnabled(!heatmapEnabled)}
      className="fixed z-[900] flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95"
      style={{
        top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 14rem)',
        right: 'max(1.5rem, env(safe-area-inset-right, 0px))',
      }}
      aria-label={heatmapEnabled ? 'Hide heatmap' : 'Show heatmap'}
      title={heatmapEnabled ? 'Hide heatmap' : 'Show heatmap (shows where memories are concentrated)'}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-text-secondary"
      >
        <circle cx="12" cy="12" r="10" opacity="0.3" />
        <circle cx="12" cy="12" r="6" opacity="0.5" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    </button>
  );
}
