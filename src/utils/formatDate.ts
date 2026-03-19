/**
 * Format ISO date string for display. Use for list/card (short) or viewer (long).
 */
export function formatDate(iso: string, long = false): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, long
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
