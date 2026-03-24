/**
 * Spaced repetition: SM-2 algorithm (SuperMemo 2 / Anki-style).
 *
 * - I(1) = 1 day, I(2) = 6 days, I(n) = I(n-1) × EF for n > 2
 * - Quality 0–5: 5 = perfect, 4 = correct after hesitation, 3 = correct with difficulty,
 *   2 = incorrect (correct seemed easy), 1 = incorrect, 0 = blackout
 * - If quality < 3: reset to I(1), do not change EF
 * - EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)); minimum EF = 1.3
 * - Intervals are rounded up to whole days
 */

const INITIAL_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

export type SM2State = {
  reviewCount: number;
  intervalDays: number;
  easeFactor: number;
};

export type SM2Result = {
  nextReviewAt: string;
  reviewCount: number;
  intervalDays: number;
  easeFactor: number;
};

/**
 * Compute next review schedule using SM-2.
 * @param quality 0–5 (5 = perfect recall, 0 = complete blackout; < 3 resets the item)
 * @param state current repetition state (use defaults for new items)
 */
export function sm2Schedule(quality: number, state: Partial<SM2State>): SM2Result {
  const reviewCount = state.reviewCount ?? 0;
  const intervalDays = state.intervalDays ?? 0;
  let easeFactor = state.easeFactor ?? INITIAL_EASE_FACTOR;

  if (quality < 3) {
    // Reset to beginning: next review in 1 day, repetitions restart, EF unchanged
    const nextDate = addDays(new Date(), 1);
    return {
      nextReviewAt: nextDate.toISOString(),
      reviewCount: 0,
      intervalDays: 1,
      easeFactor,
    };
  }

  // Successful recall: compute next interval using current EF (before update)
  let nextIntervalDays: number;
  if (reviewCount === 0) {
    nextIntervalDays = 1;
  } else if (reviewCount === 1) {
    nextIntervalDays = 6;
  } else {
    nextIntervalDays = Math.ceil(intervalDays * easeFactor);
  }
  nextIntervalDays = Math.max(1, nextIntervalDays);

  // Update E-Factor: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
  const q = quality;
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  easeFactor = Math.max(MIN_EASE_FACTOR, Math.round(easeFactor * 100) / 100);

  const nextDate = addDays(new Date(), nextIntervalDays);
  return {
    nextReviewAt: nextDate.toISOString(),
    reviewCount: reviewCount + 1,
    intervalDays: nextIntervalDays,
    easeFactor,
  };
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

export function toISODateString(d: Date): string {
  return d.toISOString();
}

/** First review 2 days after creation. */
export function getFirstReviewDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d;
}

/** True if memory is due for review (nextReviewAt is null or in the past). */
export function isDueForReview(m: { nextReviewAt?: string | null }): boolean {
  if (m.nextReviewAt == null || m.nextReviewAt === '') return true;
  try {
    return new Date(m.nextReviewAt).getTime() <= Date.now();
  } catch {
    return true;
  }
}

/** Quality for "I remember" (perfect recall). */
export const QUALITY_REMEMBERED = 5;
/** Quality for "Show me" (failed recall – reset in SM-2). */
export const QUALITY_FAILED = 2;

/** Item with fields needed to pick next for recall. */
export type RecallCandidate = { id: string; nextReviewAt?: string | null; createdAt: string };

/**
 * Pick the next memory to show in a recall session: due first (by nextReviewAt, then createdAt).
 * Returns null if none are due; use fallback (e.g. first memory) when starting a session.
 */
export function getNextMemoryToReview(
  memories: RecallCandidate[]
): RecallCandidate | null {
  const due = memories.filter(isDueForReview);
  if (due.length === 0) return null;
  due.sort((a, b) => {
    const aDue = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0;
    const bDue = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0;
    if (aDue !== bDue) return aDue - bDue;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  return due[0];
}

/**
 * Build ordered list of memory ids for a recall session: due first (by nextReviewAt, then createdAt),
 * then non-due (by createdAt). Ensures we can go through every memory in one session.
 */
export function getRecallSessionOrderedIds(memories: RecallCandidate[]): string[] {
  const due: RecallCandidate[] = [];
  const notDue: RecallCandidate[] = [];
  for (const m of memories) {
    if (isDueForReview(m)) due.push(m);
    else notDue.push(m);
  }
  const sortByDueThenCreated = (a: RecallCandidate, b: RecallCandidate) => {
    const aDue = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0;
    const bDue = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0;
    if (aDue !== bDue) return aDue - bDue;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  };
  const sortByCreated = (a: RecallCandidate, b: RecallCandidate) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  due.sort(sortByDueThenCreated);
  notDue.sort(sortByCreated);
  return [...due.map((m) => m.id), ...notDue.map((m) => m.id)];
}

/** Build ordered list of due memory ids only (by nextReviewAt, then createdAt). */
export function getDueRecallSessionOrderedIds(memories: RecallCandidate[]): string[] {
  return memories
    .filter(isDueForReview)
    .sort((a, b) => {
      const aDue = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0;
      const bDue = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .map((m) => m.id);
}
