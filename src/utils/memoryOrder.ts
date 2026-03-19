import type { Memory, Group } from '../types/memory';

export type SortBy = 'default' | 'date' | 'title' | 'location' | 'createdAt';

/** Sort key: order (undefined = end), then createdAt. */
export function compareOrderThenCreatedAt(a: Memory, b: Memory): number {
  const oa = a.order ?? Infinity;
  const ob = b.order ?? Infinity;
  if (oa !== ob) return oa - ob;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function compareDate(a: Memory, b: Memory): number {
  return a.date.localeCompare(b.date) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
function compareTitle(a: Memory, b: Memory): number {
  return (a.title || '').localeCompare(b.title || '') || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
function compareLocation(a: Memory, b: Memory): number {
  if (a.lat !== b.lat) return a.lat - b.lat;
  if (a.lng !== b.lng) return a.lng - b.lng;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
function compareCreatedAt(a: Memory, b: Memory): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/** Compare two memories by sortBy and sortOrder. */
export function compareMemories(
  a: Memory,
  b: Memory,
  sortBy: SortBy,
  sortOrder: 'asc' | 'desc'
): number {
  let cmp: number;
  if (sortBy === 'default') {
    cmp = compareOrderThenCreatedAt(a, b);
  } else if (sortBy === 'date') {
    cmp = compareDate(a, b);
  } else if (sortBy === 'title') {
    cmp = compareTitle(a, b);
  } else if (sortBy === 'location') {
    cmp = compareLocation(a, b);
  } else {
    cmp = compareCreatedAt(a, b);
  }
  return sortOrder === 'desc' ? -cmp : cmp;
}

/** Return memories in sidebar order: ungrouped first (sorted), then each group (sorted). */
export function memoriesInSidebarOrder(memories: Memory[], groups: Group[]): Memory[] {
  const ungrouped = memories
    .filter((m) => !(m.groupId ?? null))
    .sort(compareOrderThenCreatedAt);
  const result: Memory[] = [...ungrouped];
  for (const g of groups) {
    const inGroup = memories
      .filter((m) => (m.groupId ?? null) === g.id)
      .sort(compareOrderThenCreatedAt);
    result.push(...inGroup);
  }
  return result;
}
