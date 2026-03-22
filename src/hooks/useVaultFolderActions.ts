import { useCallback, useEffect, useState } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import {
  clearVaultRootDirectoryHandle,
  getVaultRootDirectoryHandle,
  saveVaultRootDirectoryHandle,
} from '../utils/idbStorage';
import { awaitVaultSyncChain, enqueueVaultDiskSync } from '../utils/vaultSyncExecution';
import { resetVaultReconcileTracking } from '../utils/vaultReconcile';

/**
 * Choose / clear vault folder and save Markdown to disk. Shared by Settings drawer and sidebar.
 * @param active When false, skips refreshing browser directory-handle state (e.g. drawer closed).
 */
export function useVaultFolderActions(active: boolean) {
  const bumpVaultLinkNonce = useMemoryStore((s) => s.bumpVaultLinkNonce);
  const vaultElectronPath = useMemoryStore((s) => s.vaultElectronPath);
  const setVaultElectronPath = useMemoryStore((s) => s.setVaultElectronPath);
  const setVaultLastSyncMeta = useMemoryStore((s) => s.setVaultLastSyncMeta);

  const [browserLinked, setBrowserLinked] = useState(false);
  /** Directory name from File System Access API (full path not exposed in the browser). */
  const [browserFolderName, setBrowserFolderName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isElectron = typeof window !== 'undefined' && !!window.temporalVault?.selectFolder;

  useEffect(() => {
    if (!active || isElectron) {
      setBrowserLinked(false);
      setBrowserFolderName(null);
      return;
    }
    let cancelled = false;
    getVaultRootDirectoryHandle().then((h) => {
      if (cancelled) return;
      setBrowserLinked(!!h);
      setBrowserFolderName(h?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [active, isElectron, vaultElectronPath]);

  const runSaveNow = useCallback(async () => {
    setLocalError(null);
    setBusy(true);
    try {
      enqueueVaultDiskSync();
      await awaitVaultSyncChain();
      const err = useMemoryStore.getState().vaultLastSyncError;
      if (err) setLocalError(err);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not save to folder');
    } finally {
      setBusy(false);
    }
  }, []);

  const chooseElectronFolder = useCallback(async () => {
    setLocalError(null);
    const p = await window.temporalVault?.selectFolder();
    if (p) {
      setVaultElectronPath(p);
      bumpVaultLinkNonce();
      await runSaveNow();
    }
  }, [setVaultElectronPath, bumpVaultLinkNonce, runSaveNow]);

  const chooseBrowserFolder = useCallback(async () => {
    setLocalError(null);
    const w = window as typeof window & {
      showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    };
    if (!w.showDirectoryPicker) {
      setLocalError('This browser does not support choosing a folder. Try Chrome, Edge, or the desktop app.');
      return;
    }
    try {
      const handle = await w.showDirectoryPicker({ mode: 'readwrite' });
      await saveVaultRootDirectoryHandle(handle);
      setBrowserLinked(true);
      setVaultElectronPath(null);
      bumpVaultLinkNonce();
      await runSaveNow();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setLocalError(e instanceof Error ? e.message : 'Could not open folder');
    }
  }, [setVaultElectronPath, bumpVaultLinkNonce, runSaveNow]);

  const clearVaultLocation = useCallback(async () => {
    setLocalError(null);
    setVaultElectronPath(null);
    await clearVaultRootDirectoryHandle();
    setBrowserLinked(false);
    bumpVaultLinkNonce();
    resetVaultReconcileTracking();
    setVaultLastSyncMeta(null, null);
  }, [setVaultElectronPath, bumpVaultLinkNonce, setVaultLastSyncMeta]);

  const hasVaultLocation =
    !!vaultElectronPath?.trim() || (!isElectron && browserLinked);

  const chooseFolder = useCallback(() => {
    if (isElectron) void chooseElectronFolder();
    else void chooseBrowserFolder();
  }, [isElectron, chooseElectronFolder, chooseBrowserFolder]);

  return {
    isElectron,
    vaultElectronPath,
    browserLinked,
    browserFolderName,
    busy,
    localError,
    hasVaultLocation,
    runSaveNow,
    chooseElectronFolder,
    chooseBrowserFolder,
    chooseFolder,
    clearVaultLocation,
    setLocalError,
  };
}
