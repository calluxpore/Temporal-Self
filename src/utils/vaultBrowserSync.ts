import type { VaultFileWrite } from './vaultPlan';
import { extractTemporalSelfMemoryId } from './vaultMarkdownId';

async function readMarkdownId(memDir: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    const fh = await memDir.getFileHandle(name);
    const file = await fh.getFile();
    const text = await file.text();
    return extractTemporalSelfMemoryId(text);
  } catch {
    return null;
  }
}

async function getDir(root: FileSystemDirectoryHandle, relativePath: string): Promise<FileSystemDirectoryHandle> {
  const parts = relativePath.split('/').filter(Boolean);
  let current = root;
  for (const p of parts) {
    current = await current.getDirectoryHandle(p, { create: true });
  }
  return current;
}

async function writeToPath(root: FileSystemDirectoryHandle, relativePath: string, data: string | Uint8Array): Promise<void> {
  const norm = relativePath.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error('Invalid vault path');
  const dir = parts.length ? await getDir(root, parts.join('/')) : root;
  const fh = await dir.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  if (typeof data === 'string') {
    await w.write(data);
  } else {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    await w.write(copy);
  }
  await w.close();
}

export async function readTextFromPathInDirectory(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<string | null> {
  const norm = relativePath.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return null;
  let dir: FileSystemDirectoryHandle | null = root;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p).catch(() => null);
    if (!dir) return null;
  }
  const fh = await dir.getFileHandle(fileName).catch(() => null);
  if (!fh) return null;
  const file = await fh.getFile();
  return await file.text();
}

export async function applyVaultWritesToDirectory(root: FileSystemDirectoryHandle, writes: VaultFileWrite[]): Promise<void> {
  for (const wr of writes) {
    if (wr.kind === 'utf8') await writeToPath(root, wr.path, wr.content);
    else await writeToPath(root, wr.path, wr.bytes);
  }
}

/** Memory ids from Temporal Self `.md` files (YAML `id`, not the file name). */
export async function listVaultMemoryIdsFromDirectoryHandle(root: FileSystemDirectoryHandle): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  try {
    const ts = await root.getDirectoryHandle('Temporal-Self').catch(() => null);
    if (!ts) return out;
    const memDir = await ts.getDirectoryHandle('memories').catch(() => null);
    if (!memDir) return out;
    for await (const [name] of memDir.entries()) {
      if (!name.endsWith('.md')) continue;
      const id = await readMarkdownId(memDir, name);
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Remove `*-id.md` files whose basename no longer matches the current title (after renames). */
export async function cleanupStaleMemoryMarkdownBrowser(
  root: FileSystemDirectoryHandle,
  activeMemoryIds: string[],
  canonicalBasenames: string[]
): Promise<void> {
  const active = new Set(activeMemoryIds.map((x) => x.toLowerCase()));
  const keep = new Set(canonicalBasenames.map((n) => n.toLowerCase()));
  try {
    const ts = await root.getDirectoryHandle('Temporal-Self').catch(() => null);
    if (!ts) return;
    const memDir = await ts.getDirectoryHandle('memories').catch(() => null);
    if (!memDir) return;
    const names: string[] = [];
    for await (const [name] of memDir.entries()) names.push(name);
    for (const name of names) {
      if (!name.endsWith('.md')) continue;
      const id = await readMarkdownId(memDir, name);
      if (!id || !active.has(id)) continue;
      if (!keep.has(name.toLowerCase())) {
        try {
          await memDir.removeEntry(name);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

export async function cleanupVaultOrphansBrowser(
  root: FileSystemDirectoryHandle,
  activeMemoryIds: string[]
): Promise<void> {
  const active = new Set(activeMemoryIds.map((x) => x.toLowerCase()));
  try {
    const ts = await root.getDirectoryHandle('Temporal-Self').catch(() => null);
    if (!ts) return;

    try {
      const memDir = await ts.getDirectoryHandle('memories').catch(() => null);
      if (memDir) {
        const entries: string[] = [];
        for await (const [name] of memDir.entries()) entries.push(name);
        for (const name of entries) {
          if (!name.endsWith('.md')) continue;
          const id = await readMarkdownId(memDir, name);
          if (id && !active.has(id)) {
            try {
              await memDir.removeEntry(name);
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const att = await ts.getDirectoryHandle('attachments').catch(() => null);
      if (att) {
        const ids: string[] = [];
        for await (const [name] of att.entries()) ids.push(name);
        for (const id of ids) {
          if (!active.has(id.toLowerCase())) {
            try {
              await att.removeEntry(id, { recursive: true });
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

export async function ensureVaultPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  try {
    const q = await handle.queryPermission(opts);
    if (q === 'granted') return true;
    const r = await handle.requestPermission(opts);
    return r === 'granted';
  } catch {
    return false;
  }
}
