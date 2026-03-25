import { useMemoryStore } from '../store/memoryStore';

type TopControlVariant = 'fixed' | 'bar';

export function RadiusCirclesToggle({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const radiusCirclesEnabled = useMemoryStore((s) => s.radiusCirclesEnabled);
  const setRadiusCirclesEnabled = useMemoryStore((s) => s.setRadiusCirclesEnabled);
  const activeClasses = radiusCirclesEnabled ? 'border-accent bg-accent-glow text-accent' : '';

  return (
    <div
      className={variant === 'bar' ? 'relative z-[900] flex-shrink-0 group' : 'fixed z-[900] group'}
      style={
        variant === 'bar'
          ? undefined
          : {
              top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 364px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }
      }
    >
      <button
        type="button"
        onClick={() => setRadiusCirclesEnabled(!radiusCirclesEnabled)}
        className={`flex touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95 ${variant === 'bar' ? 'h-10 w-10 min-h-[36px] min-w-[36px]' : 'h-12 w-12 min-h-[44px] min-w-[44px]'} ${activeClasses}`}
        aria-label={radiusCirclesEnabled ? 'Hide memory radius circles' : 'Show memory radius circles'}
        aria-pressed={radiusCirclesEnabled}
        title="Radius circles (Alt+O)"
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
          className={radiusCirclesEnabled ? 'text-accent' : 'text-text-secondary'}
          aria-hidden
        >
          {/* Ring + center + radius arm — reads as distance from a point, not density */}
          <circle cx="12" cy="12" r="8" opacity="0.9" />
          <line x1="12" y1="12" x2="19" y2="12" />
          <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span
        className={
          variant === 'bar'
            ? 'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
            : 'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
        }
      >
        Radius circles (Alt+O)
      </span>
    </div>
  );
}
