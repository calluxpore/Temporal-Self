import type { Memory } from '../types/memory';

/** Filter memories by date range (inclusive). Dates in YYYY-MM-DD. */
export function filterMemoriesByDate(
  memories: Memory[],
  from: string | null,
  to: string | null
): Memory[] {
  if (!from && !to) return memories;
  return memories.filter((m) => {
    const d = m.date;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}
