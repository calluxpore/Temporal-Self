import { useRef, useState, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Use when dialog must appear above another overlay (e.g. z-index 1200). */
  zIndex?: number;
  /** When set, shows "Do not show this message again" checkbox; onConfirm receives its state. */
  dontAskAgainLabel?: string;
  onConfirm: (dontAskAgain?: boolean) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  zIndex,
  dontAskAgainLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dontAskAgainChecked, setDontAskAgainChecked] = useState(false);
  useFocusTrap(ref, open);

  useEffect(() => {
    if (!open) setDontAskAgainChecked(false);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: zIndex ?? 1100 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <div
        ref={ref}
        className="w-full max-w-sm rounded-lg border border-border bg-background p-4 shadow-xl"
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <h2 id="confirm-title" className="font-display text-lg font-semibold text-text-primary">
          {title}
        </h2>
        <p id="confirm-desc" className="mt-2 text-text-secondary">
          {message}
        </p>
        {dontAskAgainLabel && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
            <input
              type="checkbox"
              checked={dontAskAgainChecked}
              onChange={(e) => setDontAskAgainChecked(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-accent"
            />
            <span>{dontAskAgainLabel}</span>
          </label>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-border bg-surface px-3 py-1.5 text-text-primary hover:bg-surface-elevated"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(dontAskAgainLabel ? dontAskAgainChecked : undefined)}
            className={`rounded px-3 py-1.5 ${danger ? 'bg-danger text-white hover:opacity-90' : 'bg-accent text-white hover:opacity-90'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
