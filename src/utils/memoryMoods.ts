import type { MemoryMood } from '../types/memory';

/** Rough valence for analytics (−2 most negative … +2 most positive). */
export const MOOD_VALENCE: Record<MemoryMood, number> = {
  distraught: -2,
  concerned: -1,
  neutral: 0,
  content: 1,
  radiant: 2,
};

export type MemoryMoodOption = {
  id: MemoryMood;
  emoji: string;
  /** Short heading */
  label: string;
  /** Extra nuance for tooltips / screen readers */
  description: string;
};

export const MEMORY_MOOD_OPTIONS: readonly MemoryMoodOption[] = [
  {
    id: 'radiant',
    emoji: '🤩',
    label: 'Radiant',
    description: 'Elated — star-struck or over-the-moon.',
  },
  {
    id: 'content',
    emoji: '🙂',
    label: 'Content',
    description: 'Pleasant — stable, everyday happiness.',
  },
  {
    id: 'neutral',
    emoji: '😐',
    label: 'Neutral',
    description: 'Indifferent — not much of either.',
  },
  {
    id: 'concerned',
    emoji: '😟',
    label: 'Concerned',
    description: 'Down — worried or a dip toward sad.',
  },
  {
    id: 'distraught',
    emoji: '😭',
    label: 'Distraught',
    description: 'Grieving — intense sadness or overwhelmed.',
  },
] as const;

const MOOD_IDS = new Set<string>(MEMORY_MOOD_OPTIONS.map((o) => o.id));

export function parseMemoryMood(value: unknown): MemoryMood | null {
  if (typeof value !== 'string') return null;
  return MOOD_IDS.has(value) ? (value as MemoryMood) : null;
}

export function moodOption(id: MemoryMood): MemoryMoodOption | undefined {
  return MEMORY_MOOD_OPTIONS.find((o) => o.id === id);
}
