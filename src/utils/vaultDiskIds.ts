import { getVaultRootDirectoryHandle } from './idbStorage';
import { ensureVaultPermission, listVaultMemoryIdsFromDirectoryHandle } from './vaultBrowserSync';

/** UUIDs from `Temporal-Self/memories/*.md` filenames; null if no vault linked / unreadable. */
export async function listVaultMemoryIdsOnDisk(electronVaultPath: string | null): Promise<string[] | null> {
  const api = typeof window !== 'undefined' ? window.temporalVault : undefined;

  if (api?.listMemoryIds) {
    const root = electronVaultPath?.trim();
    if (!root) return null;
    const r = await api.listMemoryIds(root);
    if (!r.ok) return null;
    return r.ids.map((id) => id.toLowerCase());
  }

  const handle = await getVaultRootDirectoryHandle();
  if (!handle) return null;
  const ok = await ensureVaultPermission(handle);
  if (!ok) return null;
  return listVaultMemoryIdsFromDirectoryHandle(handle);
}
