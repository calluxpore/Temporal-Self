import type { Group, Memory } from '../types/memory';
import { memoryToVaultMarkdown, collectMemoryImagePaths, vaultMemoryFilename, VAULT_README } from './vaultMarkdown';
import { vaultRelative } from './vaultPaths';
import type { VaultSettings } from './vaultSettings';

export type VaultFileWrite =
  | { path: string; kind: 'utf8'; content: string }
  | { path: string; kind: 'binary'; bytes: Uint8Array };

export function buildVaultSyncPlan(memories: Memory[], groups: Group[], settings: VaultSettings): {
  writes: VaultFileWrite[];
  activeMemoryIds: string[];
  /** Basenames under `memories/` — used to remove old filenames after title changes. */
  memoryMarkdownBasenames: string[];
} {
  const writes: VaultFileWrite[] = [];
  const activeMemoryIds = memories.map((m) => m.id);
  const memoryMarkdownBasenames = memories.map((m) => vaultMemoryFilename(m));

  writes.push({
    path: vaultRelative.readme,
    kind: 'utf8',
    content: VAULT_README,
  });

  writes.push({
    path: vaultRelative.groupsJson,
    kind: 'utf8',
    content: `${JSON.stringify(groups, null, 2)}\n`,
  });
  writes.push({
    path: vaultRelative.settingsJson,
    kind: 'utf8',
    content: `${JSON.stringify(settings, null, 2)}\n`,
  });

  for (const m of memories) {
    const { relPaths, binaries } = collectMemoryImagePaths(m);
    for (const b of binaries) {
      writes.push({ path: b.path, kind: 'binary', bytes: b.bytes });
    }
    const md = memoryToVaultMarkdown(m, relPaths);
    writes.push({
      path: `${vaultRelative.memories}/${vaultMemoryFilename(m)}`,
      kind: 'utf8',
      content: md,
    });
  }

  return { writes, activeMemoryIds, memoryMarkdownBasenames };
}
