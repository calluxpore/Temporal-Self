export {};

declare global {
  interface Window {
    /** Exposed in Electron via preload; absent in plain web builds. */
    temporalVault?: {
      selectFolder: () => Promise<string | null>;
      openFolder: (vaultRoot: string) => Promise<{ ok: true } | { ok: false; error: string }>;
      listMemoryIds: (
        vaultRoot: string
      ) => Promise<{ ok: true; ids: string[] } | { ok: false; error: string; ids: string[] }>;
      startMemoriesWatch: (vaultRoot: string) => Promise<{ ok: boolean; error?: string }>;
      stopMemoriesWatch: () => Promise<{ ok: boolean }>;
      onMemoriesDirChanged?: (listener: () => void) => () => void;
      applySync: (
        vaultRoot: string,
        writes: Array<
          | { path: string; kind: 'utf8'; content: string }
          | { path: string; kind: 'binary'; base64: string }
        >,
        activeMemoryIds: string[],
        memoryMarkdownBasenames: string[]
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      readTextFile: (
        vaultRoot: string,
        relativePath: string
      ) => Promise<{ ok: true; text: string | null } | { ok: false; error: string }>;
    };
  }
}
