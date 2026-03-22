import type { Memory } from '../types/memory';
import { projectedTitledVaultFilename, vaultMemoryFilename, vaultTitleFilenameError } from './vaultMarkdown';

/** Another memory that would use the same vault `.md` name (case-insensitive). */
export function findVaultFilenameConflict(
  memories: Memory[],
  title: string,
  excludeMemoryId: string | null
): Memory | null {
  if (vaultTitleFilenameError(title)) return null;
  const projected = projectedTitledVaultFilename(title);
  if (!projected) return null;
  const p = projected.toLowerCase();
  for (const m of memories) {
    if (excludeMemoryId && m.id === excludeMemoryId) continue;
    if (vaultMemoryFilename(m).toLowerCase() === p) return m;
  }
  return null;
}

export function vaultDuplicateFilenameMessage(conflict: Memory): string {
  const name = vaultMemoryFilename(conflict);
  return `The file name "${name}" is already used by another memory. Choose a different title.`;
}
