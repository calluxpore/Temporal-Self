import { useEffect, useRef } from 'react';
import type { Group, Memory } from '../types/memory';
import { useMemoryStore } from '../store/memoryStore';
import { enqueueVaultDiskSync } from '../utils/vaultSyncExecution';
import {
  resetVaultReconcileTracking,
  runVaultReconcileFromDisk,
} from '../utils/vaultReconcile';

/** After edits to titles/notes/body (same memory ids on disk). */
const DEBOUNCE_CONTENT_MS = 650;
/** After create/delete memory or add/remove group — vault files appear/disappear. */
const DEBOUNCE_STRUCTURAL_MS = 120;
/** After linking or changing vault folder — write full snapshot soon. */
const DEBOUNCE_LINK_MS = 80;

function pickVaultDeps(s: ReturnType<typeof useMemoryStore.getState>) {
  return {
    memories: s.memories,
    groups: s.groups,
    vaultElectronPath: s.vaultElectronPath,
    vaultLinkNonce: s.vaultLinkNonce,
  };
}

function memoryIdsKey(memories: Memory[]): string {
  return memories
    .map((m) => m.id)
    .sort()
    .join('|');
}

function groupIdsKey(groups: Group[]): string {
  return groups
    .map((g) => g.id)
    .sort()
    .join('|');
}

function syncVaultToDisk(): void {
  enqueueVaultDiskSync();
}

/**
 * While a vault folder is linked, mirrors memories + groups to Markdown on disk.
 * Create/delete use a short delay; note edits use a longer debounce.
 */
export function useVaultSync() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = useRef(pickVaultDeps(useMemoryStore.getState()));

  useEffect(() => {
    const isElectronVault = typeof window !== 'undefined' && !!window.temporalVault?.applySync;

    const scheduleSync = (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void syncVaultToDisk();
      }, delayMs);
    };

    const flushSoon = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void syncVaultToDisk();
    };

    const unsub = useMemoryStore.subscribe((s) => {
      const next = pickVaultDeps(s);
      const prev = prevRef.current;
      const electronReady = isElectronVault && !!next.vaultElectronPath?.trim();
      const depsChanged =
        next.memories !== prev.memories ||
        next.groups !== prev.groups ||
        next.vaultElectronPath !== prev.vaultElectronPath ||
        next.vaultLinkNonce !== prev.vaultLinkNonce;

      prevRef.current = next;

      if (isElectronVault && !electronReady) return;
      if (!depsChanged) return;

      const linkChanged =
        next.vaultElectronPath !== prev.vaultElectronPath || next.vaultLinkNonce !== prev.vaultLinkNonce;
      const structuralMemories = memoryIdsKey(next.memories) !== memoryIdsKey(prev.memories);
      const structuralGroups =
        next.groups.length !== prev.groups.length || groupIdsKey(next.groups) !== groupIdsKey(prev.groups);

      let delay = DEBOUNCE_CONTENT_MS;
      if (linkChanged) delay = DEBOUNCE_LINK_MS;
      else if (structuralMemories || structuralGroups) delay = DEBOUNCE_STRUCTURAL_MS;

      scheduleSync(delay);
    });

    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      const st = useMemoryStore.getState();
      const isEl = typeof window !== 'undefined' && !!window.temporalVault?.applySync;
      if (isEl && !st.vaultElectronPath?.trim()) return;
      flushSoon();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const pollMs = 2600;
    const poll = window.setInterval(() => void runVaultReconcileFromDisk(), pollMs);
    let pathSeen: string | null = null;
    let offDirWatch: (() => void) | undefined;

    const syncElectronWatch = () => {
      const api = window.temporalVault;
      if (!api?.startMemoriesWatch || !api?.stopMemoriesWatch) return;
      const path = useMemoryStore.getState().vaultElectronPath?.trim() || null;
      if (path === pathSeen) return;
      if (pathSeen) void api.stopMemoriesWatch();
      offDirWatch?.();
      offDirWatch = undefined;
      if (!path && pathSeen) resetVaultReconcileTracking();
      pathSeen = path;
      if (!path) return;
      void api.startMemoriesWatch(path);
      offDirWatch = api.onMemoriesDirChanged?.(() => void runVaultReconcileFromDisk());
    };

    const unsub = useMemoryStore.subscribe(() => {
      syncElectronWatch();
    });
    syncElectronWatch();
    void runVaultReconcileFromDisk();

    return () => {
      window.clearInterval(poll);
      unsub();
      offDirWatch?.();
      void window.temporalVault?.stopMemoriesWatch?.();
    };
  }, []);
}
