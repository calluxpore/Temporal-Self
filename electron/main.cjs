const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.ELECTRON_DEV === '1';

let mainWindow = null;

let memoriesWatcher = null;
let memoriesWatchDebounce = null;
let memoriesWatchSender = null;

/** Match renderer `extractTemporalSelfMemoryId`: `---` + `id:` uuid near top only (no temporal-self / lat gate). */
function extractVaultMemoryIdFromMarkdownFile(fullPath) {
  try {
    let raw = fs.readFileSync(fullPath, 'utf8').slice(0, 24000);
    raw = raw.replace(/^\uFEFF/, '');
    raw = raw.replace(/^\s+/, '');
    if (!/^---\r?\n/.test(raw)) return null;
    const m = /\bid:\s*["'`\u201c\u201d\u2018\u2019]*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(raw);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function resolvedVaultPath(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.includes('\0')) {
    throw new Error('Invalid path');
  }
  const rootResolved = path.resolve(root);
  const full = path.resolve(path.join(rootResolved, relativePath));
  const rel = path.relative(rootResolved, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path escapes vault root');
  }
  return full;
}

function cleanupStaleMemoryMarkdownRenames(rootResolved, activeMemoryIds, canonicalBasenames) {
  if (!Array.isArray(canonicalBasenames)) return;
  const active = new Set(activeMemoryIds.map((x) => String(x).toLowerCase()));
  const keep = new Set(canonicalBasenames.map((x) => String(x).toLowerCase()));
  const dir = path.join(path.resolve(rootResolved), 'Temporal-Self', 'memories');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(dir, name);
    const id = extractVaultMemoryIdFromMarkdownFile(full);
    if (!id || !active.has(id)) continue;
    if (!keep.has(name.toLowerCase())) {
      try {
        fs.unlinkSync(full);
      } catch {
        /* ignore */
      }
    }
  }
}

function cleanupMemoriesMarkdown(rootResolved, activeMemoryIds) {
  const set = new Set(activeMemoryIds.map((x) => String(x).toLowerCase()));
  const dir = path.join(path.resolve(rootResolved), 'Temporal-Self', 'memories');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(dir, name);
    const id = extractVaultMemoryIdFromMarkdownFile(full);
    if (!id) continue;
    if (!set.has(id)) {
      try {
        fs.unlinkSync(full);
      } catch {
        /* ignore */
      }
    }
  }
}

function listMemoryIdsFromVaultDir(rootResolved) {
  const dir = path.join(path.resolve(rootResolved), 'Temporal-Self', 'memories');
  if (!fs.existsSync(dir)) return [];
  const seen = new Set();
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const id = extractVaultMemoryIdFromMarkdownFile(path.join(dir, name));
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function stopMemoriesWatcher() {
  if (memoriesWatchDebounce) {
    clearTimeout(memoriesWatchDebounce);
    memoriesWatchDebounce = null;
  }
  if (memoriesWatcher) {
    try {
      memoriesWatcher.close();
    } catch {
      /* ignore */
    }
    memoriesWatcher = null;
  }
  memoriesWatchSender = null;
}

function notifyVaultMemoriesChanged() {
  const w =
    (memoriesWatchSender && !memoriesWatchSender.isDestroyed() ? memoriesWatchSender : null) ||
    BrowserWindow.getFocusedWindow() ||
    mainWindow;
  if (w && !w.isDestroyed()) w.webContents.send('vault:memories-dir-changed');
}

function cleanupAttachmentsDirs(rootResolved, activeMemoryIds) {
  const set = new Set(activeMemoryIds.map((x) => String(x).toLowerCase()));
  const dir = path.join(path.resolve(rootResolved), 'Temporal-Self', 'attachments');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!set.has(String(name).toLowerCase())) {
      try {
        fs.rmSync(path.join(dir, name), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Temporal Self',
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('vault:select-folder', async () => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const r = await dialog.showOpenDialog(win ?? undefined, {
    properties: ['openDirectory'],
    title: 'Choose vault folder (e.g. Obsidian vault root)',
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

ipcMain.handle('vault:list-memory-ids', async (_event, vaultRoot) => {
  try {
    const rootResolved = path.resolve(String(vaultRoot));
    if (!fs.existsSync(rootResolved)) {
      return { ok: false, error: 'Vault folder does not exist', ids: [] };
    }
    const ids = listMemoryIdsFromVaultDir(rootResolved);
    return { ok: true, ids };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), ids: [] };
  }
});

ipcMain.handle('vault:start-memories-watch', async (event, vaultRoot) => {
  stopMemoriesWatcher();
  try {
    const rootResolved = path.resolve(String(vaultRoot));
    const dir = path.join(rootResolved, 'Temporal-Self', 'memories');
    fs.mkdirSync(dir, { recursive: true });
    memoriesWatchSender = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    memoriesWatcher = fs.watch(dir, () => {
      if (memoriesWatchDebounce) clearTimeout(memoriesWatchDebounce);
      memoriesWatchDebounce = setTimeout(() => {
        memoriesWatchDebounce = null;
        notifyVaultMemoriesChanged();
      }, 280);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

ipcMain.handle('vault:stop-memories-watch', async () => {
  stopMemoriesWatcher();
  return { ok: true };
});

ipcMain.handle('vault:apply-sync', async (_event, vaultRoot, writes, activeMemoryIds, memoryMarkdownBasenames) => {
  try {
    const rootResolved = path.resolve(String(vaultRoot));
    if (!fs.existsSync(rootResolved)) {
      return { ok: false, error: 'Vault folder does not exist' };
    }
    if (!Array.isArray(writes)) return { ok: false, error: 'Invalid sync payload' };
    if (!Array.isArray(activeMemoryIds)) return { ok: false, error: 'Invalid sync payload' };
    const mdNames = Array.isArray(memoryMarkdownBasenames) ? memoryMarkdownBasenames : [];

    for (const w of writes) {
      if (!w || typeof w.path !== 'string') continue;
      const dest = resolvedVaultPath(rootResolved, w.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (w.kind === 'utf8') {
        fs.writeFileSync(dest, String(w.content ?? ''), 'utf8');
      } else if (w.kind === 'binary' && typeof w.base64 === 'string') {
        const buf = Buffer.from(w.base64, 'base64');
        fs.writeFileSync(dest, buf);
      }
    }
    cleanupStaleMemoryMarkdownRenames(rootResolved, activeMemoryIds, mdNames);
    cleanupMemoriesMarkdown(rootResolved, activeMemoryIds);
    cleanupAttachmentsDirs(rootResolved, activeMemoryIds);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
