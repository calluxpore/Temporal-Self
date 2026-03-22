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

  if (
    prev.size === 0 &&
    current.size === 0 &&
    st.memories.length > 0 &&
    st.vaultLastSyncAt &&
    !st.vaultLastSyncError
  ) {
    writePrevIds(key, current);
    useMemoryStore.getState().removeMemoriesVaultMirror(st.memories.map((m) => m.id));
    return;
  }

  if (prev.size === 0 && current.size > 0) {
    writePrevIds(key, current);
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

/** After a successful push to disk, disk ids match app — reset baseline without waiting for a directory scan. */
export function onVaultPushSucceeded(memoryIds: string[]): void {
  const key = vaultReconcileSessionKey();
  if (!key || typeof sessionStorage === 'undefined') return;
  const s = new Set(memoryIds.map((id) => id.toLowerCase()));
  writePrevIds(key, s);
}
