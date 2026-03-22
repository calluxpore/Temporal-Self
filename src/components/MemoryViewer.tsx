import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useMemoryStore } from '../store/memoryStore';
import { formatDate } from '../utils/formatDate';
import { formatCoords } from '../utils/formatCoords';
import { getMemoryImages } from '../utils/imageUtils';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { parseNotesFrontMatter } from '../utils/notesFrontMatter';
import { ConfirmDialog } from './ConfirmDialog';
import type { Memory } from '../types/memory';
import { memoryNoteDisplayName } from '../utils/vaultMarkdown';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Safe href for exported HTML: only http/https to prevent javascript: or data: XSS. */
function safeLinkHref(u: string): string {
  const t = u.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return 'https://' + t;
}

function exportMemoryAsHtml(memory: Memory): void {
  const img = getMemoryImages(memory)[0];
  const parsed = parseNotesFrontMatter(memory.notes ?? '');
  const links = parsed.frontMatter.links ?? memory.links ?? [];
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(memoryNoteDisplayName(memory))} – Temporal Self</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:2rem auto;padding:0 1rem;color:#1a1917;background:#f5f3ef;}
h1{font-size:1.5rem;} .muted{color:#6b6872;font-size:0.875rem;} .notes{white-space:pre-wrap;margin-top:1rem;}
img{max-width:100%;height:auto;border-radius:8px;} a{color:#2563eb;}</style></head>
<body>
${img ? `<img src="${img}" alt=""/>` : ''}
<h1>${escapeHtml(memoryNoteDisplayName(memory))}</h1>
<p class="muted">${formatDate(parsed.frontMatter.date ?? memory.date, true)} · ${memory.lat.toFixed(4)}, ${memory.lng.toFixed(4)}</p>
${parsed.body ? `<div class="notes">${escapeHtml(parsed.body)}</div>` : ''}
${links.length ? `<p class="muted">Links: ${links.map((u) => `<a href="${escapeHtml(
    safeLinkHref(u)
  )}">${escapeHtml(u)}</a>`).join(', ')}</p>` : ''}
<p class="muted" style="margin-top:2rem;">Temporal Self</p>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `memory-${memoryNoteDisplayName(memory).replace(/\s+/g, '-').slice(0, 30)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

interface MemoryViewerProps {
  memory: Memory;
  onClose: () => void;
}

export function MemoryViewer({ memory, onClose }: MemoryViewerProps) {
  const removeMemory = useMemoryStore((s) => s.removeMemory);
  const updateMemory = useMemoryStore((s) => s.updateMemory);
  const skipDeleteConfirmation = useMemoryStore((s) => s.skipDeleteConfirmation);
  const setSkipDeleteConfirmation = useMemoryStore((s) => s.setSkipDeleteConfirmation);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [hasHover, setHasHover] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : false
  );
  const photoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = window.matchMedia('(hover: hover)');
    const fn = () => setHasHover(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = photoRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      setParallax({ x: dx * 8, y: dy * 8 });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setParallax({ x: 0, y: 0 });
  }, []);

  const handleRemove = () => {
    if (skipDeleteConfirmation) {
      removeMemory(memory.id);
      onClose();
    } else {
      setShowRemoveConfirm(true);
    }
  };
  const confirmRemove = (dontAskAgain?: boolean) => {
    if (dontAskAgain) setSkipDeleteConfirmation(true);
    removeMemory(memory.id);
    onClose();
    setShowRemoveConfirm(false);
  };

  const [active, setActive] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const images = getMemoryImages(memory);
  const [imageIndex, setImageIndex] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(viewerRef, true);
  const currentImage = images[imageIndex] ?? null;

  const parsed = parseNotesFrontMatter(memory.notes ?? '');
  const displayDate = parsed.frontMatter.date ?? memory.date;
  const displayTags = parsed.frontMatter.tags ?? memory.tags ?? [];
  const displayLinks = parsed.frontMatter.links ?? memory.links ?? [];
  const { location, loading: locationLoading } = useReverseGeocode(memory.lat, memory.lng);

  useEffect(() => {
    const t = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      ref={viewerRef}
      className={`memory-viewer-enter fixed inset-0 z-[1000] flex flex-col bg-background md:flex-row ${active ? 'active' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Memory details"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="touch-target absolute right-4 top-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center text-text-secondary transition-colors hover:text-text-primary active:opacity-80"
        style={{
          top: 'max(1rem, env(safe-area-inset-top, 0px))',
          right: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
        aria-label="Close"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="flex flex-1 flex-col justify-between overflow-y-auto overscroll-contain p-4 pb-8 md:order-1 md:max-w-[50%] md:p-6 md:pr-12 md:pt-16">
        <div>
          <p className="font-mono text-sm text-accent">
            {formatCoords(memory.lat, memory.lng)}
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-text-primary md:text-5xl">
            {memoryNoteDisplayName(memory)}
          </h2>
          <p className="font-mono mt-2 text-sm text-text-secondary">
            {formatDate(displayDate, true)}
          </p>
          {(parsed.frontMatter.location ?? location) && (
            <p className="font-mono mt-1 text-sm text-text-primary/90" title="Location">
              {parsed.frontMatter.location ?? (locationLoading ? '…' : location ?? '')}
            </p>
          )}
          {displayTags && displayTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {displayTags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-surface-elevated px-2 py-0.5 font-mono text-xs text-text-secondary"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {parsed.body && (
            <div className="font-body mt-6 text-text-primary/90 leading-relaxed [&_p]:my-1 [&_h1]:text-xl [&_h2]:text-lg [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-accent [&_a]:underline">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent">
                      {children}
                    </a>
                  ),
                  img: ({ src, alt, ...props }) => (
                    <img
                      src={src}
                      alt={alt ?? ''}
                      className="my-3 max-h-[min(70vh,640px)] max-w-full rounded-lg border border-border object-contain"
                      {...props}
                    />
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
                            : 'rounded bg-surface-elevated px-1 py-0.5 font-mono text-[0.9em] text-text-secondary'
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
            </div>
          )}
          {displayLinks && displayLinks.length > 0 && (
            <div className="mt-4">
              <div className="font-mono text-[10px] text-text-muted mb-1">Links</div>
              <ul className="space-y-1">
                {displayLinks.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url.startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-accent break-all hover:underline"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => updateMemory(memory.id, { starred: !(memory.starred ?? false) })}
            aria-label={memory.starred ? 'Unstar' : 'Star'}
            className="font-mono touch-target flex min-h-[44px] items-center gap-2 px-3 text-sm text-text-secondary transition-colors hover:text-accent active:opacity-80"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={memory.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {memory.starred ? 'Unstar' : 'Star'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="font-mono touch-target min-h-[44px] px-3 text-sm text-text-secondary hover:text-accent"
            aria-label="Print"
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => exportMemoryAsHtml(memory)}
            className="font-mono touch-target min-h-[44px] px-3 text-sm text-text-secondary hover:text-accent"
            aria-label="Export as HTML"
          >
            Export HTML
          </button>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove memory from atlas"
            className="font-mono touch-target min-h-[44px] min-w-[80px] px-3 text-sm text-danger underline-offset-2 hover:underline active:opacity-80"
          >
            REMOVE FROM ATLAS
          </button>
        </div>
      </div>
      <ConfirmDialog
        key={showRemoveConfirm ? 'open' : 'closed'}
        open={showRemoveConfirm}
        title="Remove memory"
        message="Remove this memory from the atlas?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        dontAskAgainLabel="Do not show this message again"
        onConfirm={(dontAskAgain) => confirmRemove(dontAskAgain)}
        onCancel={() => setShowRemoveConfirm(false)}
      />

      <div
        ref={photoRef}
        className="relative order-first flex h-[40vh] flex-shrink-0 items-center justify-center overflow-auto bg-surface-elevated p-2 md:order-2 md:h-full md:min-h-0 md:flex-1 md:p-4"
        onMouseMove={hasHover ? handleMouseMove : undefined}
        onMouseLeave={hasHover ? handleMouseLeave : undefined}
      >
        {currentImage ? (
          <img
            src={currentImage}
            alt=""
            className="max-h-full max-w-full object-contain transition-transform duration-150 ease-out"
            style={
              hasHover
                ? { transform: `translate(${parallax.x}px, ${parallax.y}px)` }
                : undefined
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted font-mono text-sm">
            No photo
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setImageIndex((i) => (i === 0 ? images.length - 1 : i - 1))}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-text-primary shadow hover:bg-surface-elevated"
              aria-label="Previous photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setImageIndex((i) => (i === images.length - 1 ? 0 : i + 1))}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-text-primary shadow hover:bg-surface-elevated"
              aria-label="Next photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-background/80 px-2 py-0.5 font-mono text-xs text-text-secondary">
              {imageIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
