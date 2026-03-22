import { useMemoryStore } from '../store/memoryStore';

const ROUND_BUTTON_CLASS =
  'flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95';

type TopControlVariant = 'fixed' | 'bar';

const TOOLTIP_CLASS =
  'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100';

const TOOLTIP_CLASS_BAR =
  'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100';

export function SettingsButton({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const settingsDrawerOpen = useMemoryStore((s) => s.settingsDrawerOpen);
  const setSettingsDrawerOpen = useMemoryStore((s) => s.setSettingsDrawerOpen);
  const setMemorySearchDrawerOpen = useMemoryStore((s) => s.setMemorySearchDrawerOpen);
  const tooltipClass = variant === 'bar' ? TOOLTIP_CLASS_BAR : TOOLTIP_CLASS;

  return (
    <div
      className={
        variant === 'bar' ? 'relative z-[1100] group flex-shrink-0' : 'pointer-events-auto fixed z-[1100] group'
      }
      style={
        variant === 'bar'
          ? undefined
          : {
              top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 672px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }
      }
    >
      <button
        type="button"
        onClick={() => {
          setMemorySearchDrawerOpen(false);
          setSettingsDrawerOpen(true);
        }}
        className={ROUND_BUTTON_CLASS + (settingsDrawerOpen ? ' border-accent bg-surface-elevated' : '')}
        aria-label="Settings"
        title="Settings"
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
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <span className={tooltipClass}>Settings</span>
    </div>
  );
}
