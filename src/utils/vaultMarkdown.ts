import type { Memory } from '../types/memory';
import { parseNotesFrontMatter } from './notesFrontMatter';
import { vaultRelative } from './vaultPaths';

function escapeYamlDoubleQuoted(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function yamlQuote(s: string): string {
  return `"${escapeYamlDoubleQuoted(s)}"`;
}

/** Empty or literal "Untitled" → vault uses `untitled-<id>.md` (ids come from YAML only). */
export function isUntitledVaultTitle(title: string | undefined): boolean {
  const t = (title ?? '').trim();
  return t === '' || /^untitled$/i.test(t);
}

function isIllegalFilesystemChar(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  if (c <= 0x1f) return true;
  return '<>:"/\\|?*'.includes(ch);
}

/** Use the same visible title as the app; strip only characters unsafe on common filesystems. */
function sanitizeTitleForVaultFilename(title: string): string {
  const stripped = [...title.trim()]
    .filter((ch) => !isIllegalFilesystemChar(ch))
    .join('');
  const s = stripped
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?:\.| |\t|\u00a0)+$/g, '');
  return s.slice(0, 200);
}

const WIN_RESERVED_STEM = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Basename (no extension) for a titled memory — mirrors the `.md` file name. */
export function vaultTitledFileStem(title: string): string {
  const safe = sanitizeTitleForVaultFilename(title);
  return safe.length > 0 ? safe : 'memory';
}

/**
 * For titled notes: exact vault file name (`.md`) that would be used. Null for untitled (depends on id).
 */
export function projectedTitledVaultFilename(title: string): string | null {
  if (isUntitledVaultTitle(title)) return null;
  return `${vaultTitledFileStem(title)}.md`;
}

/** Error message if title cannot be used as a vault file name; null if OK. */
export function vaultTitleFilenameError(title: string): string | null {
  if (isUntitledVaultTitle(title)) return null;
  const stem = vaultTitledFileStem(title);
  if (WIN_RESERVED_STEM.test(stem)) {
    return `“${stem}” is reserved on Windows and cannot be used as a file name. Add a word to the title.`;
  }
  return null;
}

/**
 * Vault `.md` file name: titled notes use the exact title (sanitized for `<>:"/\\|?*` only);
 * untitled uses `untitled-<uuid>.md`. Memory id lives in YAML only for titled files.
 */
export function vaultMemoryFilename(memory: Memory): string {
  if (isUntitledVaultTitle(memory.title)) {
    return `untitled-${memory.id}.md`;
  }
  return `${vaultTitledFileStem(memory.title)}.md`;
}

/**
 * Label in lists/cards — matches the vault file stem (without `.md`).
 */
export function memoryNoteDisplayName(memory: Memory): string {
  const name = vaultMemoryFilename(memory);
  if (isUntitledVaultTitle(memory.title)) return 'Untitled';
  return name.replace(/\.md$/i, '');
}

function yamlScalar(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  return yamlQuote(v);
}

function yamlStringList(arr: string[] | undefined): string | null {
  if (arr === undefined) return null;
  if (arr.length === 0) return '[]';
  return `[${arr.map((x) => yamlQuote(x)).join(', ')}]`;
}

/**
 * Obsidian-friendly note: YAML front matter (Temporal Self metadata) + markdown body.
 * Image paths are vault-relative from the chosen root.
 */
export function memoryToVaultMarkdown(memory: Memory, imageRelPaths: string[]): string {
  const { frontMatter: noteFm, body: noteBody } = parseNotesFrontMatter(memory.notes);

  const tags = memory.tags?.length ? memory.tags : noteFm.tags;
  const links = memory.links?.length ? memory.links : noteFm.links;

  const lines: string[] = ['---', 'temporal-self: "1"', `id: ${yamlQuote(memory.id)}`, `title: ${yamlQuote(memory.title)}`];

  const date = memory.date || noteFm.date;
  if (date) lines.push(`date: ${yamlQuote(date)}`);

  lines.push(`created: ${yamlQuote(memory.createdAt)}`);
  lines.push(`lat: ${yamlScalar(memory.lat)}`);
  lines.push(`lng: ${yamlScalar(memory.lng)}`);

  if (memory.groupId != null) lines.push(`groupId: ${yamlQuote(memory.groupId)}`);
  else lines.push('groupId: null');

  lines.push(`hidden: ${memory.hidden === true}`);
  lines.push(`starred: ${memory.starred === true}`);

  if (memory.order !== undefined) lines.push(`order: ${yamlScalar(memory.order)}`);

  if (memory.customLabel != null && memory.customLabel !== '')
    lines.push(`customLabel: ${yamlQuote(memory.customLabel)}`);

  const tagsLine = yamlStringList(tags);
  if (tagsLine) lines.push(`tags: ${tagsLine}`);

  const linksLine = yamlStringList(links);
  if (linksLine) lines.push(`links: ${linksLine}`);

  if (memory.nextReviewAt != null) lines.push(`nextReviewAt: ${yamlQuote(memory.nextReviewAt)}`);
  lines.push(`reviewCount: ${yamlScalar(memory.reviewCount ?? 0)}`);
  lines.push(`intervalDays: ${yamlScalar(memory.intervalDays ?? 0)}`);
  lines.push(`easeFactor: ${yamlScalar(memory.easeFactor ?? 2.5)}`);
  lines.push(`failedReviewCount: ${yamlScalar(memory.failedReviewCount ?? 0)}`);

  if (imageRelPaths.length > 0) {
    lines.push(`images: [${imageRelPaths.map((p) => yamlQuote(p)).join(', ')}]`);
  }

  lines.push('---', '');

  const loc = noteFm.location?.trim();
  if (loc) {
    lines.push(`**Location:** ${loc}`, '');
  }

  lines.push(noteBody.trimEnd());
  const out = lines.join('\n');
  return out.endsWith('\n') ? out : `${out}\n`;
}

export const VAULT_README = `# Temporal Self folder

This folder is written by **Temporal Self**. It is safe to browse and edit notes in Obsidian; the app keeps its own copy in the browser (IndexedDB) and **re-syncs** markdown from the app on change. While a vault folder is linked, **deleting a memory note here** (or in Explorer) removes that memory from the app after a short refresh—same idea as deleting a note in Obsidian.

- \`memories/\` — one \`.md\` file per memory (YAML front matter includes \`id\`). The file name matches the **title** (illegal path characters removed). Empty or \`Untitled\` titles use \`untitled-<id>.md\`; the app will not save two titled memories with the same file name.
- \`attachments/<memory-id>/\` — photos exported from the app.
- \`groups.json\` — group names and ids (edit with care; prefer changing groups in the app).

`;

export function dataUrlToUint8Array(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const b64 = m[2];
  let ext = 'bin';
  if (mime.includes('png')) ext = 'png';
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
  else if (mime.includes('webp')) ext = 'webp';
  else if (mime.includes('gif')) ext = 'gif';
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, ext };
  } catch {
    return null;
  }
}

export function collectMemoryImagePaths(memory: Memory): { relPaths: string[]; binaries: { path: string; bytes: Uint8Array }[] } {
  const urls: string[] = [];
  if (memory.imageDataUrls?.length) urls.push(...memory.imageDataUrls);
  else if (memory.imageDataUrl) urls.push(memory.imageDataUrl);

  const relPaths: string[] = [];
  const binaries: { path: string; bytes: Uint8Array }[] = [];

  urls.forEach((url, i) => {
    const parsed = dataUrlToUint8Array(url);
    if (!parsed) return;
    const rel = `${vaultRelative.attachments}/${memory.id}/${i}.${parsed.ext}`;
    relPaths.push(rel);
    binaries.push({ path: rel, bytes: parsed.bytes });
  });

  return { relPaths, binaries };
}
