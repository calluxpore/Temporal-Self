/**
 * Extract Temporal Self memory id from markdown for vault indexing / reconcile.
 *
 * We only require standard YAML opening + an `id:` line with a UUID. We intentionally do **not**
 * require `temporal-self: 1` or lat/lng — if those checks fail, the note was invisible to disk
 * scans and reconcile wrongly removed it from the app while the file still existed.
 */
export function extractTemporalSelfMemoryId(markdown: string): string | null {
  let raw = markdown.slice(0, 24000);
  raw = raw.replace(/^\uFEFF/, '');
  raw = raw.replace(/^\s+/, '');
  if (!/^---\r?\n/.test(raw)) return null;
  const m = /\bid:\s*["'`\u201c\u201d\u2018\u2019]*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(raw);
  return m ? m[1].toLowerCase() : null;
}
