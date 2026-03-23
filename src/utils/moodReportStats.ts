import type { Memory, MemoryMood } from '../types/memory';
import { MEMORY_MOOD_OPTIONS, MOOD_VALENCE, parseMemoryMood } from './memoryMoods';

function entropyBits(counts: number[], total: number): number | null {
  if (total <= 0) return null;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

export type MoodReportSnapshot = {
  total: number;
  tagged: number;
  coveragePct: number;
  counts: Record<MemoryMood, number>;
  maxCount: number;
  avgValence: number | null;
  /** Plain-English summary for the PDF. */
  balanceLabel: string;
  posShare: number;
  neuShare: number;
  negShare: number;
  entropyBits: number | null;
  diversityPct: number | null;
  dominant: { id: MemoryMood; label: string; n: number } | null;
};

export function computeMoodReportSnapshot(memories: Memory[]): MoodReportSnapshot {
  const total = memories.length;
  const withMood = memories.filter((m) => parseMemoryMood(m.mood) != null);
  const tagged = withMood.length;
  const coveragePct = total > 0 ? Math.round((tagged / total) * 100) : 0;

  const counts: Record<MemoryMood, number> = {
    radiant: 0,
    content: 0,
    neutral: 0,
    concerned: 0,
    distraught: 0,
  };
  let valenceSum = 0;
  for (const m of withMood) {
    const id = parseMemoryMood(m.mood)!;
    counts[id] += 1;
    valenceSum += MOOD_VALENCE[id];
  }
  const maxCount = Math.max(1, ...Object.values(counts));

  const avgValence = tagged > 0 ? valenceSum / tagged : null;
  const positiveTagged = counts.radiant + counts.content;
  const negativeTagged = counts.concerned + counts.distraught;
  const pct = (n: number) => (tagged > 0 ? Math.round((n / tagged) * 100) : 0);
  const posShare = pct(positiveTagged);
  const negShare = pct(negativeTagged);
  const neuShare = pct(counts.neutral);

  const entropy = entropyBits(
    MEMORY_MOOD_OPTIONS.map((o) => counts[o.id]),
    tagged
  );
  const maxEntropy = Math.log2(MEMORY_MOOD_OPTIONS.length);
  const diversityPct = entropy != null && maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : null;

  let dominant: { id: MemoryMood; label: string; n: number } | null = null;
  for (const o of MEMORY_MOOD_OPTIONS) {
    const n = counts[o.id];
    if (!dominant || n > dominant.n) dominant = { id: o.id, label: o.label, n };
  }
  if (dominant && dominant.n === 0) dominant = null;

  const balanceLabel =
    avgValence == null
      ? '—'
      : avgValence >= 1.25
        ? 'Strongly positive'
        : avgValence >= 0.35
          ? 'Leaning positive'
          : avgValence > -0.35
            ? 'Balanced / mixed'
            : avgValence > -1.25
              ? 'Leaning toward difficult'
              : 'Heavy on difficult feelings';

  return {
    total,
    tagged,
    coveragePct,
    counts,
    maxCount,
    avgValence,
    balanceLabel,
    posShare,
    neuShare,
    negShare,
    entropyBits: entropy,
    diversityPct,
    dominant,
  };
}
