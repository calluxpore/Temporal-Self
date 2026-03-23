import { buildVaultSyncPlan, type VaultFileWrite } from './vaultPlan';
import {
  applyVaultWritesToDirectory,
  readTextFromPathInDirectory,
  cleanupStaleMemoryMarkdownBrowser,
  cleanupVaultOrphansBrowser,
  ensureVaultPermission,
} from './vaultBrowserSync';
import type { Group, Memory } from '../types/memory';
import { getVaultRootDirectoryHandle } from './idbStorage';
import { vaultRelative } from './vaultPaths';
import type { VaultSettings } from './vaultSettings';
import { normalizeVaultSettings } from './vaultSettings';

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export type IpcVaultWrite =
  | { path: string; kind: 'utf8'; content: string }
  | { path: string; kind: 'binary'; base64: string };

export function vaultWritesForIpc(writes: VaultFileWrite[]): IpcVaultWrite[] {
  return writes.map((w) =>
    w.kind === 'utf8'
      ? { path: w.path, kind: 'utf8' as const, content: w.content }
      : { path: w.path, kind: 'binary' as const, base64: uint8ToBase64(w.bytes) }
  );
}

export type VaultSyncResult = { ok: true } | { ok: false; error: string };

export async function runVaultSyncForMemories(
  memories: Memory[],
  groups: Group[],
  settings: VaultSettings,
  options: {
    electronVaultPath: string | null;
  }
): Promise<VaultSyncResult> {
  const plan = buildVaultSyncPlan(memories, groups, settings);
  const api = typeof window !== 'undefined' ? window.temporalVault : undefined;

  if (api?.applySync) {
    const root = options.electronVaultPath?.trim();
    if (!root) return { ok: false, error: 'No vault folder selected (desktop).' };
    const writes = vaultWritesForIpc(plan.writes);
    return await api.applySync(root, writes, plan.activeMemoryIds, plan.memoryMarkdownBasenames);
  }

  const handle = await getVaultRootDirectoryHandle();
  if (!handle) return { ok: false, error: 'No vault folder linked (browser).' };

  const okPerm = await ensureVaultPermission(handle);
  if (!okPerm) return { ok: false, error: 'Vault folder permission denied. Re-link the folder in Settings.' };

  try {
    await applyVaultWritesToDirectory(handle, plan.writes);
    await cleanupStaleMemoryMarkdownBrowser(handle, plan.activeMemoryIds, plan.memoryMarkdownBasenames);
    await cleanupVaultOrphansBrowser(handle, plan.activeMemoryIds);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Vault sync failed' };
  }
}

export async function loadVaultSettingsFromDisk(options: {
  electronVaultPath: string | null;
}): Promise<{ ok: true; settings: VaultSettings | null } | { ok: false; error: string }> {
  const api = typeof window !== 'undefined' ? window.temporalVault : undefined;
  if (api?.readTextFile) {
    const root = options.electronVaultPath?.trim();
    if (!root) return { ok: true, settings: null };
    const res = await api.readTextFile(root, vaultRelative.settingsJson);
    if (!res.ok) return { ok: false, error: res.error };
    if (res.text == null || !res.text.trim()) return { ok: true, settings: null };
    try {
      return { ok: true, settings: normalizeVaultSettings(JSON.parse(res.text)) };
    } catch {
      return { ok: false, error: 'Invalid vault settings JSON.' };
    }
  }

  const handle = await getVaultRootDirectoryHandle();
  if (!handle) return { ok: true, settings: null };

  const okPerm = await ensureVaultPermission(handle);
  if (!okPerm) return { ok: false, error: 'Vault folder permission denied. Re-link the folder in Settings.' };
  try {
    const text = await readTextFromPathInDirectory(handle, vaultRelative.settingsJson);
    if (text == null || !text.trim()) return { ok: true, settings: null };
    return { ok: true, settings: normalizeVaultSettings(JSON.parse(text)) };
  } catch {
    return { ok: false, error: 'Invalid vault settings JSON.' };
  }
}
