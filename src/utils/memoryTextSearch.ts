import type { Memory, Group } from '../types/memory';
import { parseNotesFrontMatter } from './notesFrontMatter';
import { memoriesInSidebarOrder } from './memoryOrder';
import { memoryNoteDisplayName, vaultMemoryFilename } from './vaultMarkdown';

/** Calendar date from ISO (YYYY-MM-DD) without time — avoids matching every memory on "t", ":", "z", etc. */
function calendarDateFromCreatedAt(iso: string | undefined): string {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function haystackForMemory(memory: Memory, groups: Group[]): string {
  const parts: string[] = [];
  parts.push(memory.title ?? '');
  parts.push(memoryNoteDisplayName(memory));
  parts.push(vaultMemoryFilename(memory));
  parts.push(memory.date ?? '');
  const createdDay = calendarDateFromCreatedAt(memory.createdAt);
  if (createdDay) parts.push(createdDay);

  parts.push(memory.lat.toFixed(6), memory.lng.toFixed(6));
  parts.push(memory.lat.toFixed(4), memory.lng.toFixed(4));

  if (memory.customLabel) parts.push(memory.customLabel);
  (memory.tags ?? []).forEach((t) => parts.push(t));
  (memory.links ?? []).forEach((l) => parts.push(l));

  const parsed = parseNotesFrontMatter(memory.notes ?? '');
  parts.push(parsed.body);
  if (parsed.frontMatter.date) parts.push(parsed.frontMatter.date);
  if (parsed.frontMatter.location) parts.push(parsed.frontMatter.location);
  (parsed.frontMatter.tags ?? []).forEach((t) => parts.push(t));
  (parsed.frontMatter.links ?? []).forEach((l) => parts.push(l));

  const gid = memory.groupId ?? null;
  if (gid) {
    const g = groups.find((x) => x.id === gid);
    if (g) parts.push(g.name);
  }

  return parts.join('\n').toLowerCase();
}

/**
 * Drop tokens that match almost every memory (single ASCII char, or empty).
 * Keep single non-ASCII code units (e.g. one CJK character).
 */
export function normalizeSearchTokens(query: string): string[] {
  const raw = query.trim().toLowerCase();
  if (!raw) return [];
  return raw.split(/\s+/).filter((t) => {
    if (!t) return false;
    if (t.length >= 2) return true;
    if (t.length === 1) {
      const cp = t.codePointAt(0) ?? 0;
      return cp > 0x7f;
    }
    return false;
  });
}

function tokenMatchesHaystack(haystack: string, token: string): boolean {
  if (!token) return false;
  if (token.length >= 3) return haystack.includes(token);

  if (token.length === 2) {
    if (/^\d{2}$/.test(token)) return haystack.includes(token);
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(haystack);
  }

  return haystack.includes(token);
}

function matchTokensAgainstMemory(memory: Memory, groups: Group[], tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const haystack = haystackForMemory(memory, groups);
  return tokens.every((t) => tokenMatchesHaystack(haystack, t));
}

export function memoryMatchesQuery(memory: Memory, groups: Group[], query: string): boolean {
  return matchTokensAgainstMemory(memory, groups, normalizeSearchTokens(query));
}

export function filterMemoriesByTextQuery(memories: Memory[], groups: Group[], query: string): Memory[] {
  const tokens = normalizeSearchTokens(query);
  if (tokens.length === 0) return [];
  const ordered = memoriesInSidebarOrder(memories, groups);
  return ordered.filter((m) => matchTokensAgainstMemory(m, groups, tokens));
}
