import { useMemoryStore } from '../store/memoryStore';
import { listVaultMemoryIdsOnDisk } from './vaultDiskIds';

const SESSION_PREFIX = 'ts:vaultDiskIds:';

let suppressUntil = 0;
let lastReconcileKey: string | null = null;

function isElectronVault(): boolean {
  return typeof window !== 'undefined' && !!window.temporalVault?.applySync;
}

/** Storage key for “which memory ids we last saw on disk” (per vault folder / browser link). */
export function vaultReconcileSessionKey(): string | null {
  const st = useMemoryStore.getState();
  const p = st.vaultElectronPath?.trim();
  if (p) return `${SESSION_PREFIX}path:${p}`;
  if (isElectronVault()) return null;
  return `${SESSION_PREFIX}br:${st.vaultLinkNonce}`;
}

export function suppressVaultReconcile(ms: number): void {
  suppressUntil = Date.now() + ms;
}

function isSuppressed(): boolean {
  return Date.now() < suppressUntil;
}

/** Call after unlinking the vault or picking a different folder. */
export function resetVaultReconcileTracking(): void {
  if (typeof sessionStorage === 'undefined') return;
  if (lastReconcileKey) {
    try {
      sessionStorage.removeItem(lastReconcileKey);
    } catch {
      /* ignore */
    }
  }
  lastReconcileKey = null;
}

function readPrevIds(key: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x).toLowerCase()));
  } catch {
    return new Set();
  }
}

function writePrevIds(key: string, ids: Set<string>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify([...ids]));
    lastReconcileKey = key;
  } catch {
    /* quota / private mode */
  }
}

/**
 * Removes in-app memories whose `.md` files disappeared from the vault (e.g. deleted in Explorer or Obsidian).
 * Uses sessionStorage to remember last disk id set so deletes are detected even after restarting the app.
 */
export async function runVaultReconcileFromDisk(): Promise<void> {
  if (isSuppressed()) return;

  const st = useMemoryStore.getState();
  const key = vaultReconcileSessionKey();
  if (!key) return;

  if (key !== lastReconcileKey && lastReconcileKey && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(lastReconcileKey);
    } catch {
      /* ignore */
    }
  }

  const diskIds = await listVaultMemoryIdsOnDisk(st.vaultElectronPath);
  if (diskIds === null) return;

  const current = new Set(diskIds);
  const prev = readPrevIds(key);

  // Do NOT mass-delete when the folder is empty: new notes often have no `.md` on disk until the
  // next vault sync (debounced). Empty disk + vaultLastSyncAt would wrongly wipe the whole atlas.

  if (prev.size === 0 && current.size > 0) {
    writePrevIds(key, current);
    return;
  }

  // Empty id list from disk: do not reconcile-remove. Cloud/OneDrive placeholders or a bad
  // read can look like "everything deleted" and would wipe the in-app atlas.
  if (current.size === 0) {
    if (prev.size === 0) writePrevIds(key, current);
    return;
  }

  const toRemove = st.memories
    .filter((m) => prev.has(m.id.toLowerCase()) && !current.has(m.id.toLowerCase()))
    .map((m) => m.id);

  writePrevIds(key, current);

  if (toRemove.length > 0) {
    useMemoryStore.getState().removeMemoriesVaultMirror(toRemove);
  }
}

/**
 * Re-read which memory ids exist on disk and store that as the reconcile baseline.
 * Must be based on actual files — never on the in-app list — or a slow/cloud drive can list
 * incompletely right after sync and the next reconcile would drop memories still in the atlas.
 */
export async function refreshVaultDiskBaselineFromDisk(): Promise<void> {
  const key = vaultReconcileSessionKey();
  if (!key || typeof sessionStorage === 'undefined') return;
  const st = useMemoryStore.getState();
  const diskIds = await listVaultMemoryIdsOnDisk(st.vaultElectronPath);
  if (diskIds === null) return;
  writePrevIds(key, new Set(diskIds.map((x) => String(x).toLowerCase())));
}

/** Call after vault sync succeeds; delayed so new `.md` files are visible to directory reads. */
export function scheduleVaultDiskBaselineRefresh(): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    void refreshVaultDiskBaselineFromDisk();
  }, 550);
}
