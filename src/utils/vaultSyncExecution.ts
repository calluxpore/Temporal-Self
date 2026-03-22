import { useMemoryStore } from '../store/memoryStore';
import { getVaultRootDirectoryHandle } from './idbStorage';
import { scheduleVaultDiskBaselineRefresh, suppressVaultReconcile } from './vaultReconcile';
import { runVaultSyncForMemories } from './vaultSyncRunner';

/** One in-flight chain so auto-sync and “Save to vault now” never overlap with stale memory lists. */
let syncChain: Promise<void> = Promise.resolve();

async function executeVaultDiskSync(): Promise<void> {
  suppressVaultReconcile(950);
  const isElectronVault = typeof window !== 'undefined' && !!window.temporalVault?.applySync;
  if (isElectronVault) {
    const s = useMemoryStore.getState();
    if (!s.vaultElectronPath?.trim()) return;
  } else {
    const h = await getVaultRootDirectoryHandle();
    if (!h) return;
  }

  const fresh = useMemoryStore.getState();
  const res = await runVaultSyncForMemories(fresh.memories, fresh.groups, {
    electronVaultPath: fresh.vaultElectronPath,
  });
  const setMeta = useMemoryStore.getState().setVaultLastSyncMeta;
  if (res.ok) {
    setMeta(new Date().toISOString(), null);
    scheduleVaultDiskBaselineRefresh();
  } else {
    setMeta(useMemoryStore.getState().vaultLastSyncAt, res.error);
  }
}

/** Queue a vault write using the latest store state when the job runs. */
export function enqueueVaultDiskSync(): void {
  syncChain = syncChain.then(() => executeVaultDiskSync()).catch(() => {});
}

/** Await after enqueue when you need to know the write finished (e.g. Settings “Save now”). */
export function awaitVaultSyncChain(): Promise<void> {
  return syncChain;
}
