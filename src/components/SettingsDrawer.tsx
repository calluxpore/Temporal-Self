import { useEffect, useRef, useState } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { VAULT_APP_DIR } from '../utils/vaultPaths';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useVaultFolderActions } from '../hooks/useVaultFolderActions';

export function SettingsDrawer() {
  const open = useMemoryStore((s) => s.settingsDrawerOpen);
  const setSettingsDrawerOpen = useMemoryStore((s) => s.setSettingsDrawerOpen);

  const vaultLastSyncAt = useMemoryStore((s) => s.vaultLastSyncAt);
  const vaultLastSyncError = useMemoryStore((s) => s.vaultLastSyncError);
  const memories = useMemoryStore((s) => s.memories);
  const groups = useMemoryStore((s) => s.groups);

  const [active, setActive] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const {
    isElectron,
    vaultElectronPath,
    browserFolderName,
    busy,
    localError,
    hasVaultLocation,
    runSaveNow,
    chooseFolder,
    clearVaultLocation,
  } = useVaultFolderActions(open);

  const vaultLocationAddress = isElectron
    ? vaultElectronPath?.trim() || null
    : hasVaultLocation
      ? browserFolderName ?? 'Linked folder'
      : null;

  useEffect(() => {
    if (!open) {
      const id = requestAnimationFrame(() => setActive(false));
      return () => cancelAnimationFrame(id);
    }
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setSettingsDrawerOpen]);

  const displayError = localError || vaultLastSyncError;

  if (!open) return null;

  return (
    <>
      {/* Capture clicks over the map so the first tap closes the drawer instead of creating a memory. */}
      <div
        className="fixed inset-0 z-[1100] cursor-default bg-background/10"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setSettingsDrawerOpen(false);
        }}
        aria-hidden
      />

      <div
        ref={panelRef}
        className={`pointer-events-auto fixed inset-y-0 right-0 z-[1101] flex w-[min(540px,92vw)] sm:w-[min(620px,88vw)] lg:w-[min(780px,70vw)] xl:w-[min(860px,60vw)] flex-col rounded-l-xl border-l border-y border-border bg-surface shadow-xl transition-transform duration-300 ease-out ${
          active ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div
          className="flex flex-1 flex-col overflow-y-auto overscroll-contain p-4 py-6 md:p-8"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-text-primary md:text-2xl">Settings</h2>
              <p className="mt-1 font-mono text-xs text-text-muted">App preferences and files on disk</p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsDrawerOpen(false)}
              className="touch-target flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-border bg-surface/70 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary active:opacity-80"
              aria-label="Close settings"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <section className="border-t border-border pt-6">
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              Vault folder
            </h3>
            <p className="mt-2 font-body text-sm leading-relaxed text-text-primary/90">
              Pick the folder your notes app uses (for example your Obsidian vault). Temporal Self writes a{' '}
              <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-[11px]">{VAULT_APP_DIR}/</code>{' '}
              directory there: one Markdown file per memory, attachments, and{' '}
              <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-[11px]">groups.json</code>. The app
              keeps your live data in the browser; this folder is an extra copy for your notes workflow.
              <span className="mt-2 block text-text-secondary">
                While a folder is linked, changes sync automatically—new and deleted memories update on disk within about
                a second; typing in notes debounces briefly before writing. Deleting a memory&apos;s{' '}
                <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-[11px]">.md</code> file in Explorer
                or Obsidian removes it from the app (desktop app watches the folder; browser checks every few seconds).
              </span>
            </p>

            {hasVaultLocation && vaultLocationAddress && (
              <div className="mt-4 rounded-lg border border-border bg-surface-elevated/40 p-3">
                <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Vault location
                </p>
                <p
                  className="mt-1 break-all font-mono text-sm leading-snug text-text-primary"
                  title={isElectron ? vaultLocationAddress : undefined}
                >
                  {vaultLocationAddress}
                </p>
                {!isElectron && (
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-text-muted">
                    Browsers only expose the folder name, not the full path. You may be asked again for permission when saving.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void chooseFolder()}
                  className="font-mono mt-3 w-full min-h-[44px] rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:bg-surface-elevated md:py-2.5"
                >
                  Create a new vault
                </button>
                <p className="mt-2 font-mono text-[10px] text-text-muted">
                  Choose a different folder on disk. Your app data stays in the browser; the new folder gets a fresh{' '}
                  <code className="rounded bg-surface-elevated px-0.5">{VAULT_APP_DIR}/</code> on next save.
                </p>
              </div>
            )}

            {!hasVaultLocation && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void chooseFolder()}
                  className="font-mono w-full min-h-[44px] rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-accent transition-colors hover:bg-surface md:py-2.5"
                >
                  Choose vault folder…
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !hasVaultLocation}
                onClick={() => void runSaveNow()}
                className="font-mono min-h-[44px] rounded-lg border border-border bg-accent px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save to vault now'}
              </button>
              <button
                type="button"
                onClick={() => void clearVaultLocation()}
                disabled={!hasVaultLocation}
                className="font-mono min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm text-danger transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
              >
                Stop using this folder
              </button>
            </div>

            <p className="mt-4 font-mono text-[10px] leading-relaxed text-text-muted">
              {memories.length} memories · {groups.length} groups
              {vaultLastSyncAt && (
                <>
                  <br />
                  Last saved to vault: {new Date(vaultLastSyncAt).toLocaleString()}
                </>
              )}
            </p>

            {displayError && (
              <p className="mt-3 font-mono text-xs text-danger" role="alert">
                {displayError}
              </p>
            )}
          </section>

          <section className="mt-8 border-t border-border pt-6">
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              Keyboard shortcuts
            </h3>
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse">
                <tbody className="font-mono text-xs">
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">`</td>
                    <td className="px-3 py-2 text-text-primary">Toggle left drawer</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + D</td>
                    <td className="px-3 py-2 text-text-primary">Toggle theme</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + R</td>
                    <td className="px-3 py-2 text-text-primary">Start recall</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + C</td>
                    <td className="px-3 py-2 text-text-primary">Open reset dialog</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + S</td>
                    <td className="px-3 py-2 text-text-primary">Toggle path style</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Ctrl + S</td>
                    <td className="px-3 py-2 text-text-primary">Open memory search</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + P</td>
                    <td className="px-3 py-2 text-text-primary">Toggle timeline path</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + H</td>
                    <td className="px-3 py-2 text-text-primary">Toggle heatmap</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + M</td>
                    <td className="px-3 py-2 text-text-primary">Toggle markers</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + E</td>
                    <td className="px-3 py-2 text-text-primary">Open export menu</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Alt + I</td>
                    <td className="px-3 py-2 text-text-primary">Open import picker</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Ctrl + I</td>
                    <td className="px-3 py-2 text-text-primary">Save map screenshot</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Ctrl + R</td>
                    <td className="px-3 py-2 text-text-primary">Generate report</td>
                  </tr>
                  <tr>
                    <td className="bg-surface-elevated/50 px-3 py-2 text-text-secondary">Shift + S</td>
                    <td className="px-3 py-2 text-text-primary">Open settings</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
