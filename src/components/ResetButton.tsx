import { useState } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { clearVaultRootDirectoryHandle } from '../utils/idbStorage';
import { ConfirmDialog } from './ConfirmDialog';

type TopControlVariant = 'fixed' | 'bar';

export function ResetButton({ variant = 'fixed' }: { variant?: TopControlVariant }) {
  const resetAllData = useMemoryStore((s) => s.resetAllData);
  const [pendingReset, setPendingReset] = useState(false);

  const tooltipPositionClass =
    variant === 'bar'
      ? 'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100'
      : 'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100';

  return (
    <>
      <div
        className={variant === 'bar' ? 'relative z-[900] flex-shrink-0 group' : 'fixed z-[900] group'}
        style={
          variant === 'bar'
            ? undefined
            : {
                top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 112px)',
                left: '50%',
                transform: 'translateX(-50%)',
              }
        }
      >
        <button
          type="button"
          onClick={() => setPendingReset(true)}
          className="flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95"
          aria-label="Reset all"
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
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
        <span className={tooltipPositionClass}>
          Reset
        </span>
      </div>
      <ConfirmDialog
        key={pendingReset ? 'open' : 'closed'}
        open={pendingReset}
        title="Reset everything?"
        message="Clear all memories, groups, and recall stats? This cannot be undone. Start completely fresh."
        confirmLabel="Clear all"
        cancelLabel="Cancel"
        danger
        zIndex={1300}
        onConfirm={() => {
          resetAllData();
          void clearVaultRootDirectoryHandle();
          setPendingReset(false);
        }}
        onCancel={() => setPendingReset(false)}
      />
    </>
  );
}
