import { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { parseNotesFrontMatter } from '../utils/notesFrontMatter';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

type NotionNotesEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function NotionNotesEditor({ value, onChange }: NotionNotesEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const parsed = useMemo(() => parseNotesFrontMatter(value), [value]);

  const getBodyStartIndex = (raw: string): number => {
    const normalized = raw.replace(/\r\n/g, '\n');
    if (!normalized.startsWith('---')) return 0;
    const lines = normalized.split('\n');
    if (lines[0].trim() !== '---') return 0;
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIdx = i;
        break;
      }
    }
    if (endIdx === -1) return 0;
    let idx = 0;
    for (let i = 0; i <= endIdx; i++) {
      idx += lines[i].length;
      if (i < lines.length - 1) idx += 1; // newline
    }
    return idx;
  };

  const bodyStartIndex = useMemo(() => getBodyStartIndex(value), [value]);

  const stats = useMemo(() => {
    const body = parsed.body ?? '';
    const chars = body.length;
    const words = body.trim() ? body.trim().split(/\s+/).length : 0;
    return { chars, words };
  }, [parsed.body]);

  const getSelection = () => {
    const el = textareaRef.current;
    if (!el) return null;
    return { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
  };

  const focusAndRestore = (start: number, end: number) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(clamp(start, 0, el.value.length), clamp(end, 0, el.value.length));
  };

  const wrapSelection = (left: string, right: string) => {
    const sel = getSelection();
    const el = textareaRef.current;
    if (!sel || !el) return;
    if (sel.start < bodyStartIndex) return;
    const selected = value.slice(sel.start, sel.end);
    const next = value.slice(0, sel.start) + left + selected + right + value.slice(sel.end);
    onChange(next);
    // Keep selection around the original content (best-effort).
    const nextStart = sel.start + left.length;
    const nextEnd = nextStart + selected.length;
    // Restore after state update.
    requestAnimationFrame(() => focusAndRestore(nextStart, nextEnd));
  };

  const applyLinePrefix = (prefix: string) => {
    const sel = getSelection();
    const el = textareaRef.current;
    if (!sel || !el) return;
    if (sel.start < bodyStartIndex) return;

    const startLine = value.lastIndexOf('\n', sel.start - 1) + 1;
    const endLineIdx = value.indexOf('\n', sel.end);
    const endLine = endLineIdx === -1 ? value.length : endLineIdx;
    const block = value.slice(startLine, endLine);
    const lines = block.split('\n');
    const nextBlock = lines.map((l) => (l.trim().length ? `${prefix}${l}` : `${prefix}${l}`)).join('\n');
    const next = value.slice(0, startLine) + nextBlock + value.slice(endLine);
    onChange(next);

    const delta = prefix.length;
    requestAnimationFrame(() => focusAndRestore(sel.start + delta, sel.end + delta));
  };

  const bulletize = () => applyLinePrefix('- ');
  const numberize = () => applyLinePrefix('1. ');
  const quoteize = () => applyLinePrefix('> ');
  const headingize = () => applyLinePrefix('# ');

  const addLink = () => {
    const sel = getSelection();
    const el = textareaRef.current;
    if (!sel || !el) return;
    if (sel.start < bodyStartIndex) return;
    const label = value.slice(sel.start, sel.end) || 'link';
    const url = window.prompt('Paste URL')?.trim();
    if (!url) return;
    const safe = url.startsWith('http') ? url : `https://${url}`;
    const link = `[${label}](${safe})`;
    const next = value.slice(0, sel.start) + link + value.slice(sel.end);
    onChange(next);
    const nextCaret = sel.start + link.length;
    requestAnimationFrame(() => focusAndRestore(nextCaret, nextCaret));
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-elevated/40">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-text-muted">Notes</span>
          <span className="hidden sm:inline font-mono text-[10px] text-text-muted/80">
            {stats.words} words · {stats.chars} chars
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="font-mono min-h-[28px] rounded border border-border bg-surface px-2 py-1 text-[10px] text-text-primary hover:bg-surface-elevated"
            aria-pressed={preview}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {!preview ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-2">
            <button
              type="button"
              onClick={() => wrapSelection('**', '**')}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
            >
              Bold
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('*', '*')}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
            >
              Italic
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('~~', '~~')}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
            >
              Strike
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('`', '`')}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
            >
              Code
            </button>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={() => headingize()}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
              title="Prefix selected lines with #"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => bulletize()}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
              title="Prefix selected lines with -"
            >
              Bullets
            </button>
            <button
              type="button"
              onClick={() => numberize()}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
              title="Prefix selected lines with 1."
            >
              List
            </button>
            <button
              type="button"
              onClick={() => quoteize()}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
              title="Prefix selected lines with >"
            >
              Quote
            </button>
            <button
              type="button"
              onClick={() => addLink()}
              className="font-mono touch-target min-h-[28px] rounded px-2 text-[10px] text-text-muted hover:text-text-primary"
              title="Insert Markdown link from selection"
            >
              Link
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="YAML properties on top (--- ... ---). Then write Markdown below."
            rows={12}
            className="font-body w-full resize-none bg-transparent px-3 pb-4 pt-1 text-base text-text-primary placeholder-text-muted outline-none min-h-[260px]"
          />
        </>
      ) : (
        <div className="max-h-[45vh] overflow-y-auto px-3 pb-4 pt-2 font-body text-text-primary/90 leading-relaxed [&_p]:my-1 [&_h1]:mt-3 [&_h1]:text-2xl [&_h2]:mt-3 [&_h2]:text-xl [&_h3]:mt-2 [&_h3]:text-lg [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-text-secondary [&_a]:text-accent [&_a]:underline [&_pre]:my-3">
          {parsed.body.trim().length ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline underline-offset-2"
                  >
                    {children}
                  </a>
                ),
                pre({ children, ...props }) {
                  return (
                    <pre
                      className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-elevated p-3"
                      {...props}
                    >
                      {children}
                    </pre>
                  );
                },
                code({ className, children, ...props }) {
                  const language = /language-(\w+)/.exec(className ?? '')?.[1];
                  const isBlock = !!language;
                  return (
                    <code
                      className={
                        isBlock
                          ? 'font-mono text-sm text-text-primary'
                          : 'rounded bg-surface-elevated px-1 py-0.5 font-mono text-[0.85em] text-text-secondary'
                      }
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {parsed.body}
            </ReactMarkdown>
          ) : (
            <p className="font-mono text-sm text-text-muted">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}

