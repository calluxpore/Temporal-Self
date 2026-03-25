export type NotesFrontMatter = {
  location?: string;
  date?: string;
  tags?: string[];
  links?: string[];
};

function unescapeYamlString(s: string): string {
  // Minimal unescape for values we generate (handles \" and \\ and \n).
  return s.replace(/\\(["\\n])/g, (_m, g1: string) => {
    if (g1 === 'n') return '\n';
    return g1;
  });
}

function escapeYamlDoubleQuoted(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function normalizeTagForYaml(tag: string): string {
  const t = tag.trim();
  if (!t) return '';
  return t.startsWith('#') ? t : `#${t}`;
}

function parseInlineList(value: string): string[] | undefined {
  const v = value.trim();
  if (!v.startsWith('[') || !v.endsWith(']')) return undefined;
  const inner = v.slice(1, -1).trim();
  if (!inner) return [];
  const parts = inner
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
        return unescapeYamlString(p.slice(1, -1));
      }
      return p;
    });
  return parts;
}

function parseScalarMaybeQuoted(s: string): string {
  const v = s.trim();
  if (v.startsWith('"') && v.endsWith('"')) return unescapeYamlString(v.slice(1, -1));
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

export function parseNotesFrontMatter(notes: string | null | undefined): { frontMatter: NotesFrontMatter; body: string } {
  const raw = (notes ?? '').replace(/\r\n/g, '\n');
  if (!raw.startsWith('---')) return { frontMatter: {}, body: raw };
  const lines = raw.split('\n');
  if (lines.length < 3) return { frontMatter: {}, body: raw };
  if (lines[0].trim() !== '---') return { frontMatter: {}, body: raw };

  // Find closing delimiter.
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return { frontMatter: {}, body: raw };

  const fmLines = lines.slice(1, endIdx);
  const fm: NotesFrontMatter = {};

  for (const line of fmLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2] ?? '';
    if (key === 'date') {
      fm.date = parseScalarMaybeQuoted(value);
    } else if (key === 'location') {
      fm.location = parseScalarMaybeQuoted(value);
    } else if (key === 'tags') {
      const list = parseInlineList(value);
      if (list) fm.tags = list;
    } else if (key === 'links') {
      const list = parseInlineList(value);
      if (list) fm.links = list;
    }
  }

  const body = lines.slice(endIdx + 1).join('\n');
  return { frontMatter: fm, body };
}

export function serializeNotesFrontMatter(frontMatter: NotesFrontMatter, body: string): string {
  const parts: string[] = [];
  parts.push('---');

  const date = frontMatter.date?.trim();
  if (date) parts.push(`date: "${escapeYamlDoubleQuoted(date)}"`);

  const location = frontMatter.location?.trim();
  if (location) parts.push(`location: ${location}`);

  if (frontMatter.tags !== undefined) {
    const tags = frontMatter.tags.map(normalizeTagForYaml).filter(Boolean);
    if (tags.length) parts.push(`tags: [${tags.map((t) => `"${escapeYamlDoubleQuoted(t)}"`).join(', ')}]`);
  }

  if (frontMatter.links !== undefined) {
    const links = frontMatter.links;
    if (links.length) parts.push(`links: [${links.map((u) => `"${escapeYamlDoubleQuoted(u)}"`).join(', ')}]`);
  }

  parts.push('---');

  const bodyClean = body.replace(/^\n+/, '');
  return parts.join('\n') + (bodyClean ? '\n' + bodyClean : '');
}

const AUDIO_TRANSCRIPTION_HEADING = '## Audio transcription';

/**
 * Inserts or replaces the "## Audio transcription" section in the notes body (below YAML).
 * Preserves front matter and all other body content.
 */
export function mergeAudioTranscriptionIntoNotes(notes: string, transcript: string): string {
  const cleaned = transcript.trim();
  if (!cleaned) return notes;

  const raw = (notes ?? '').replace(/\r\n/g, '\n');
  const stripRe = /(?:^|\n)## Audio transcription *\n[\s\S]*?(?=\n## [^#]|$)/g;
  const section = `${AUDIO_TRANSCRIPTION_HEADING}\n\n${cleaned}\n`;

  if (!raw.startsWith('---')) {
    const remainder = raw.replace(stripRe, '').replace(/^\n+/, '').replace(/\n+$/, '');
    return remainder ? `${remainder}\n\n${section.trimEnd()}\n` : `${section.trimEnd()}\n`;
  }

  const { frontMatter, body } = parseNotesFrontMatter(raw);
  const bodyRaw = body.replace(/^\n+/, '').replace(/\n+$/, '');
  const remainder = bodyRaw.replace(stripRe, '').replace(/^\n+/, '').replace(/\n+$/, '');
  const newBody = remainder ? `${remainder}\n\n${section.trimEnd()}\n` : `${section.trimEnd()}\n`;
  return serializeNotesFrontMatter(frontMatter, newBody);
}

