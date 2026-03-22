import { useMemoryStore } from '../store/memoryStore';

type TopControlVariant = 'fixed' | 'bar';

const TOOLTIP_BAR =
  'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100';

export function MemorySearchButton({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const memorySearchDrawerOpen = useMemoryStore((s) => s.memorySearchDrawerOpen);
  const setMemorySearchDrawerOpen = useMemoryStore((s) => s.setMemorySearchDrawerOpen);
  const setSettingsDrawerOpen = useMemoryStore((s) => s.setSettingsDrawerOpen);

  return (
    <div
      className={variant === 'bar' ? 'relative z-[900] flex-shrink-0 group' : 'fixed z-[900] group'}
      style={
        variant === 'bar'
          ? undefined
          : {
              top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 168px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }
      }
    >
      <button
        type="button"
        onClick={() => {
          setSettingsDrawerOpen(false);
          setMemorySearchDrawerOpen(!memorySearchDrawerOpen);
        }}
        className={
          'flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95' +
          (memorySearchDrawerOpen ? ' border-accent bg-surface-elevated' : '')
        }
        aria-label={memorySearchDrawerOpen ? 'Close memory search' : 'Search memories'}
        aria-pressed={memorySearchDrawerOpen}
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
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </button>
      {variant === 'bar' && <span className={TOOLTIP_BAR}>Search memories</span>}
    </div>
  );
}
