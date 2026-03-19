/**
 * Returns a label for a memory by index: A, B, … Z, then A1, B1, … Z1, A2, B2, …
 * Letter comes first; the numeric suffix (1, 2, 3, …) never ends.
 */
export function getMemoryLabel(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  const cycle = Math.floor(index / 26);
  return cycle === 0 ? letter : letter + cycle;
}
