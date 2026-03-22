/**
 * Read Temporal Self memory id from exported markdown (YAML front matter).
 * Used when note filenames no longer embed the uuid.
 */
export function extractTemporalSelfMemoryId(markdown: string): string | null {
  const head = markdown.slice(0, 4000);
  if (!/temporal-self:\s*["']?1["']?/i.test(head)) return null;
  const m = /\bid:\s*"?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"?/i.exec(head);
  return m ? m[1].toLowerCase() : null;
}
