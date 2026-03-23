import { useEffect } from 'react';
import type React from 'react';
import { useMemoryStore } from '../store/memoryStore';

interface OnboardingOverlayProps {
  step: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

const STEPS: { title: string; body: string; sidebarView?: 'list' | 'calendar' | 'stats' | 'moodStats' | 'memoryStats' }[] = [
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
    sidebarView: 'list',
  },
  {
    title: 'Calendar',
    body: 'Calendar view shows dots on days with memories; click a date to filter and add memories for that day.',
    sidebarView: 'calendar',
  },
  {
    title: 'Memory stats',
    body: 'Memory stats show totals, places, photos, and date-wise breakdown.',
    sidebarView: 'stats',
  },
  {
    title: 'Mood stats',
    body: 'Mood stats analyze how you felt when capturing memories — balance, diversity, trends, and reflection.',
    sidebarView: 'moodStats',
  },
  {
    title: 'Recall stats',
    body: 'Recall stats show how often you remembered versus needed hints.',
    sidebarView: 'memoryStats',
  },
  {
    title: 'Choose your vault folder',
    body: 'Open Settings (Shift+S), then choose a vault folder so Temporal Self can sync Markdown notes and attachments for Obsidian.',
  },
  {
    title: 'Top controls',
    body: 'Use the top icons for theme, recall, reset, map layers, backup/import, screenshots, and reports.',
  },
];

export const ONBOARDING_STEP_COUNT = STEPS.length;

const CARD_POSITIONS: Array<{ top: string; left: string }> = [
  // Step 0: Welcome (center)
  { top: '50%', left: '50%' },
  // Step 1: Add a memory (near center/map)
  { top: '55%', left: '60%' },
  // Step 2: List and groups (left sidebar)
  { top: '48%', left: '26%' },
  // Step 3: Calendar (left sidebar)
  { top: '40%', left: '26%' },
  // Step 4: Memory stats (left sidebar)
  { top: '40%', left: '26%' },
  // Step 5: Mood stats (left sidebar)
  { top: '40%', left: '26%' },
  // Step 6: Recall stats (left sidebar)
  { top: '40%', left: '26%' },
  // Step 7: Vault in Settings (top-right settings button area)
  { top: '24%', left: '74%' },
  // Step 8: Top controls (top-center)
  { top: '28%', left: '50%' },
];

export function OnboardingOverlay({
  step,
  totalSteps,
  onNext,
  onSkip,
}: OnboardingOverlayProps): React.JSX.Element | null {
  const content = STEPS[step];
  const setSidebarView = useMemoryStore((s) => s.setSidebarView);
  useEffect(() => {
    if (!content?.sidebarView) return;
    setSidebarView(content.sidebarView);
  }, [content?.sidebarView, setSidebarView]);

  if (!content) return null;

  const isLast = step === totalSteps - 1;
  const pos = CARD_POSITIONS[step] ?? CARD_POSITIONS[0];

  const handleNext = () => {
    if (isLast) setSidebarView('list');
    onNext();
  };

  const handleSkip = () => {
    // Ending the tour should land the user on the default sidebar tab.
    setSidebarView('list');
    onSkip();
  };

  return (
    <div
      className="fixed inset-0 z-[11500] bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Getting started tour"
    >
      <div
        className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface/95 p-6 shadow-2xl"
        style={{ top: pos.top, left: pos.left }}
      >
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
            onClick={handleSkip}
            className="font-mono text-xs text-text-muted underline-offset-2 hover:underline"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="font-mono min-h-[36px] rounded-full bg-accent px-4 py-2 text-xs font-medium text-background hover:opacity-90 active:opacity-95"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

