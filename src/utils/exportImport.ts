import type { Memory, Group } from '../types/memory';

const EXPORT_JSON_VERSION = 1;

export interface ExportData {
  version: number;
  exportedAt: string;
  memories: Memory[];
  groups: Group[];
}

/** Build export payload for JSON backup. */
export function buildExportData(memories: Memory[], groups: Group[]): ExportData {
  return {
    version: EXPORT_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    memories,
    groups,
  };
}

/** Serialize to JSON and trigger download. */
export function exportToJson(memories: Memory[], groups: Group[]): void {
  const data = buildExportData(memories, groups);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `memory-atlas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const CSV_HEADERS = [
  'id',
  'lat',
  'lng',
  'title',
  'date',
  'notes',
  'hasImage',
  'createdAt',
  'groupId',
  'hidden',
  'order',
  'customLabel',
];

function escapeCsvCell(value: string): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Export memories to CSV (no image data; use JSON for full backup). */
export function exportToCsv(memories: Memory[]): void {
  const rows = [CSV_HEADERS.join(',')];
  for (const m of memories) {
    rows.push(
      [
        escapeCsvCell(m.id),
        m.lat,
        m.lng,
        escapeCsvCell(m.title),
        escapeCsvCell(m.date),
        escapeCsvCell(m.notes),
        m.imageDataUrl ? '1' : '0',
        escapeCsvCell(m.createdAt),
        escapeCsvCell(m.groupId ?? ''),
        m.hidden ? '1' : '0',
        String(m.order ?? ''),
        escapeCsvCell(m.customLabel ?? ''),
      ].join(',')
    );
  }
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `memory-atlas-memories-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse JSON file into ExportData. Throws on invalid format. */
export function parseExportJson(text: string): ExportData {
  const raw = JSON.parse(text) as unknown;
  if (raw == null || typeof raw !== 'object') throw new Error('Invalid export file');
  const o = raw as Record<string, unknown>;
  const memories = Array.isArray(o.memories) ? o.memories : [];
  const groups = Array.isArray(o.groups) ? o.groups : [];
  return {
    version: typeof o.version === 'number' ? o.version : 1,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
    memories: memories as Memory[],
    groups: groups as Group[],
  };
}

/** Normalize a single memory from import (ensure required fields). */
function normalizeMemory(m: unknown): Memory | null {
  if (m == null || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : crypto.randomUUID();
  const lat = typeof o.lat === 'number' ? o.lat : Number(o.lat);
  const lng = typeof o.lng === 'number' ? o.lng : Number(o.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  const imageDataUrl = typeof o.imageDataUrl === 'string' ? o.imageDataUrl : null;
  const imageDataUrls = Array.isArray(o.imageDataUrls) && o.imageDataUrls.length
    ? (o.imageDataUrls as string[]).filter((s): s is string => typeof s === 'string')
    : imageDataUrl
      ? [imageDataUrl]
      : undefined;
  return {
    id,
    lat,
    lng,
    title: typeof o.title === 'string' ? o.title : 'Untitled',
    date: typeof o.date === 'string' ? o.date : new Date().toISOString().slice(0, 10),
    notes: typeof o.notes === 'string' ? o.notes : '',
    imageDataUrl: imageDataUrl ?? undefined,
    imageDataUrls,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    groupId: o.groupId != null ? (typeof o.groupId === 'string' ? o.groupId : null) : null,
    hidden: o.hidden === true,
    order: typeof o.order === 'number' ? o.order : undefined,
    customLabel: typeof o.customLabel === 'string' ? o.customLabel : null,
    tags: Array.isArray(o.tags) ? (o.tags as unknown[]).filter((t): t is string => typeof t === 'string') : undefined,
    starred: o.starred === true,
    links: Array.isArray(o.links) ? (o.links as unknown[]).filter((u): u is string => typeof u === 'string') : undefined,
  };
}

/** Normalize a group from import. */
function normalizeGroup(g: unknown): Group | null {
  if (g == null || typeof g !== 'object') return null;
  const o = g as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : crypto.randomUUID();
  return {
    id,
    name: typeof o.name === 'string' ? o.name : 'Imported group',
    collapsed: o.collapsed === true,
    hidden: o.hidden === true,
  };
}

/** Parse CSV text into memories (no groups; groupId column used if present). */
export function parseCsvToMemories(text: string): Memory[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headerCells = parseCsvRow(lines[0]);
  const header = headerCells.map((h) => h.toLowerCase().trim());
  const idx = (name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? i : -1;
  };
  const get = (row: string[], key: string): string => {
    const i = idx(key);
    return i >= 0 ? row[i]?.replace(/^"|"$/g, '').replace(/""/g, '"') ?? '' : '';
  };
  const getNum = (row: string[], key: string): number => {
    const v = get(row, key);
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  };
  const memories: Memory[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    const lat = getNum(row, 'lat');
    const lng = getNum(row, 'lng');
    const id = get(row, 'id') || crypto.randomUUID();
    memories.push({
      id,
      lat,
      lng,
      title: get(row, 'title') || 'Untitled',
      date: get(row, 'date') || new Date().toISOString().slice(0, 10),
      notes: get(row, 'notes'),
      imageDataUrl: null,
      createdAt: get(row, 'createdat') || new Date().toISOString(),
      groupId: get(row, 'groupid') || null,
      hidden: get(row, 'hidden') === '1',
      order: getNum(row, 'order') || undefined,
      customLabel: get(row, 'customlabel') || null,
    });
  }
  return memories;
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (inQuotes) {
      cell += c;
    } else if (c === ',') {
      out.push(cell);
      cell = '';
    } else {
      cell += c;
    }
  }
  out.push(cell);
  return out;
}

/** Result of importing a file. */
export type ImportResult =
  | { ok: true; memories: Memory[]; groups: Group[] }
  | { ok: false; error: string };

/** Import from JSON string (full backup). */
export function importFromJson(text: string): ImportResult {
  try {
    const data = parseExportJson(text);
    const memories = data.memories.map(normalizeMemory).filter((m): m is Memory => m != null);
    const groups = data.groups.map(normalizeGroup).filter((g): g is Group => g != null);
    return { ok: true, memories, groups };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Invalid JSON',
    };
  }
}

/** Import from CSV string (memories only; groups not in CSV). */
export function importFromCsv(text: string): ImportResult {
  try {
    const memories = parseCsvToMemories(text);
    return { ok: true, memories, groups: [] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Invalid CSV',
    };
  }
}
