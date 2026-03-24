import { useMemoryStore } from '../store/memoryStore';

type TopControlVariant = 'fixed' | 'bar';

export function MapStyleToggle({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const mapStyle = useMemoryStore((s) => s.mapStyle);
  const setMapStyle = useMemoryStore((s) => s.setMapStyle);
  const isWatercolor = mapStyle === 'watercolor';
  const activeClasses = isWatercolor ? 'border-accent bg-accent-glow text-accent' : '';
  const hotkeyLabel = 'Alt+T';

  return (
    <div
      className={variant === 'bar' ? 'relative z-[900] flex-shrink-0 group' : 'fixed z-[900] group'}
      style={
        variant === 'bar'
          ? undefined
          : {
              top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 196px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }
      }
    >
      <button
        type="button"
        onClick={() => setMapStyle(isWatercolor ? 'default' : 'watercolor')}
        className={`flex touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95 ${variant === 'bar' ? 'h-10 w-10 min-h-[36px] min-w-[36px]' : 'h-12 w-12 min-h-[44px] min-w-[44px]'} ${activeClasses}`}
        aria-label={isWatercolor ? 'Switch to default map style' : 'Switch to watercolor map style'}
        aria-pressed={isWatercolor}
        title={`Map style (${hotkeyLabel})`}
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
          className={isWatercolor ? 'text-accent' : 'text-text-secondary'}
        >
          <path d="M3 7.5 8.5 5l7 3 5.5-2.5v11L15.5 19l-7-3L3 18.5z" />
          <path d="M8.5 5v11M15.5 8v11" />
        </svg>
      </button>
      <span
        className={
          variant === 'bar'
            ? 'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
            : 'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
        }
      >
        Map style ({hotkeyLabel})
      </span>
    </div>
  );
}
