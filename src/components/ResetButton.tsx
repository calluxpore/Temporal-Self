import { useState } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { ConfirmDialog } from './ConfirmDialog';

export function ResetButton() {
  const resetAllData = useMemoryStore((s) => s.resetAllData);
  const [pendingReset, setPendingReset] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setPendingReset(true)}
        className="fixed z-[900] flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95"
        style={{
          top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 7rem)',
          right: 'max(1.5rem, env(safe-area-inset-right, 0px))',
        }}
        aria-label="Reset all"
        title="Clear all memories, groups, and recall stats"
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
          setPendingReset(false);
        }}
        onCancel={() => setPendingReset(false)}
      />
    </>
  );
}
