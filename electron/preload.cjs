const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('temporalVault', {
  selectFolder: () => ipcRenderer.invoke('vault:select-folder'),
  listMemoryIds: (vaultRoot) => ipcRenderer.invoke('vault:list-memory-ids', vaultRoot),
  startMemoriesWatch: (vaultRoot) => ipcRenderer.invoke('vault:start-memories-watch', vaultRoot),
  stopMemoriesWatch: () => ipcRenderer.invoke('vault:stop-memories-watch'),
  onMemoriesDirChanged: (listener) => {
    const ch = () => listener();
    ipcRenderer.on('vault:memories-dir-changed', ch);
    return () => ipcRenderer.removeListener('vault:memories-dir-changed', ch);
  },
  applySync: (vaultRoot, writes, activeMemoryIds, memoryMarkdownBasenames) =>
    ipcRenderer.invoke('vault:apply-sync', vaultRoot, writes, activeMemoryIds, memoryMarkdownBasenames),
  readTextFile: (vaultRoot, relativePath) =>
    ipcRenderer.invoke('vault:read-text-file', vaultRoot, relativePath),
});
