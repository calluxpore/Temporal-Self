import { useMemoryStore } from '../store/memoryStore';

type TopControlVariant = 'fixed' | 'bar';

export function TerrainContoursToggle({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const enabled = useMemoryStore((s) => s.terrainContoursEnabled);
  const setEnabled = useMemoryStore((s) => s.setTerrainContoursEnabled);
  const activeClasses = enabled ? 'border-accent bg-accent-glow text-accent' : '';

  return (
    <div className={variant === 'bar' ? 'relative z-[900] flex-shrink-0 group' : 'fixed z-[900] group'}>
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className={`flex touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95 ${variant === 'bar' ? 'h-10 w-10 min-h-[36px] min-w-[36px]' : 'h-12 w-12 min-h-[44px] min-w-[44px]'} ${activeClasses}`}
        aria-label={enabled ? 'Hide terrain contours' : 'Show terrain contours'}
        aria-pressed={enabled}
        title="Terrain contours (Alt+J)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={enabled ? 'text-accent' : 'text-text-secondary'}>
          <path d="M3 18c3-3 5-3 8 0s5 3 10 0" />
          <path d="M3 13c3-3 5-3 8 0s5 3 10 0" />
          <path d="M3 8c3-3 5-3 8 0s5 3 10 0" />
        </svg>
      </button>
      <span className={variant === 'bar' ? 'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100' : 'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'}>
        Terrain contours (Alt+J)
      </span>
    </div>
  );
}
