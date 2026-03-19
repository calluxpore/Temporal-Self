import type React from 'react';

interface OnboardingOverlayProps {
  step: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Welcome to Temporal Self',
    body: 'You will pin memories to places, explore them by date, and practise recalling them later.',
  },
  {
    title: 'Add a memory',
    body: 'Click anywhere on the map to start a memory, then give it a title, date, notes, and optional photos.',
  },
  {
    title: 'List and groups',
    body: 'Use the left sidebar to browse memories, group them, star favourites, and hide or show items.',
  },
  {
    title: 'Calendar',
    body: 'Calendar view shows dots on days with memories; click a date to filter and add memories for that day.',
  },
  {
    title: 'Stats and Recall',
    body: 'Stats tabs show totals, date-wise breakdown, and how often you remembered or needed a hint.',
  },
  {
    title: 'Right-side controls',
    body: 'Use the right icons for theme, recall, reset, map layers, backup/import, screenshots, and reports.',
  },
];

export const ONBOARDING_STEP_COUNT = STEPS.length;

export function OnboardingOverlay({
  step,
  totalSteps,
  onNext,
  onSkip,
}: OnboardingOverlayProps): React.JSX.Element | null {
  const content = STEPS[step];
  if (!content) return null;

  const isLast = step === totalSteps - 1;

  return (
    <div
      className="fixed inset-0 z-[11500] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Getting started tour"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/95 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent/80">
              Getting started
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
              {content.title}
            </h2>
          </div>
          <span className="font-mono text-[11px] text-text-muted">
            {step + 1}/{totalSteps}
          </span>
        </div>
        <p className="font-body text-sm leading-relaxed text-text-secondary">
          {content.body}
        </p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="font-mono text-xs text-text-muted underline-offset-2 hover:underline"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onNext}
            className="font-mono min-h-[36px] rounded-full bg-accent px-4 py-2 text-xs font-medium text-background hover:opacity-90 active:opacity-95"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

