import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useMemoryStore } from '../store/memoryStore';
import { useMapRef } from '../context/mapContextState';
import { useIsMd } from '../hooks/useMediaQuery';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { flyToBoundsChromePadding, flyToPointClearingMemorySearchDock } from '../utils/mapSearchChrome';
import { filterMemoriesByTextQuery, normalizeSearchTokens } from '../utils/memoryTextSearch';
import { formatCoords } from '../utils/formatCoords';
import { formatDate } from '../utils/formatDate';
import { parseNotesFrontMatter } from '../utils/notesFrontMatter';
import { memoryNoteDisplayName } from '../utils/vaultMarkdown';
import { getMemoryImages } from '../utils/imageUtils';
import type { Memory, Group } from '../types/memory';

function mergeTags(memory: Memory, fmTags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...(memory.tags ?? []), ...(fmTags ?? [])]) {
    const s = typeof t === 'string' ? t.trim() : '';
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function mergeLinks(memory: Memory, fmLinks: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [...(memory.links ?? []), ...(fmLinks ?? [])]) {
    const s = typeof u === 'string' ? u.trim() : '';
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Short plain-text preview from markdown body (search result row). */
function notesPreviewFromBody(body: string, maxLen: number): string | null {
  const t = body.replace(/\r\n/g, '\n').trim();
  if (!t) return null;
  const plain = t
    .replace(/^#+\s+.*/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~>#]|^\s*[-*+]\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

function MemorySearchResultRow({
  memory,
  groups,
  onSelect,
}: {
  memory: Memory;
  groups: Group[];
  onSelect: () => void;
}) {
  const parsed = useMemo(() => parseNotesFrontMatter(memory.notes ?? ''), [memory.notes]);
  const displayDate = parsed.frontMatter.date ?? memory.date;
  const yamlLocation = parsed.frontMatter.location?.trim() || null;
  const tags = useMemo(() => mergeTags(memory, parsed.frontMatter.tags), [memory, parsed.frontMatter.tags]);
  const links = useMemo(() => mergeLinks(memory, parsed.frontMatter.links), [memory, parsed.frontMatter.links]);
  const preview = useMemo(() => notesPreviewFromBody(parsed.body, 140), [parsed.body]);
  const groupName = memory.groupId ? groups.find((g) => g.id === memory.groupId)?.name ?? null : null;
  const thumb = useMemo(() => getMemoryImages(memory)[0] ?? null, [memory.imageDataUrl, memory.imageDataUrls]);
  const label = memory.customLabel?.trim() || null;

  let linksSummary: string | null = null;
  if (links.length === 1) {
    try {
      const host = new URL(links[0].startsWith('http') ? links[0] : `https://${links[0]}`).hostname;
      linksSummary = host.replace(/^www\./, '');
    } catch {
      linksSummary = links[0].length > 42 ? `${links[0].slice(0, 40)}…` : links[0];
    }
  } else if (links.length > 1) {
    linksSummary = `${links.length} links`;
  }

  return (
    <button
      type="button"
      role="option"
      onClick={onSelect}
      className="font-mono w-full rounded-lg border border-transparent px-2 py-2.5 text-left transition-colors hover:border-border hover:bg-surface-elevated md:px-3"
    >
      <div className="flex gap-3">
        {thumb ? (
          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated">
            <img src={thumb} alt="" className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-surface-elevated/50 text-[10px] text-text-muted">
            No photo
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {memory.starred && (
              <span className="mt-0.5 shrink-0 text-accent" title="Favorite" aria-hidden>
                ★
              </span>
            )}
            <span className="min-w-0 flex-1 font-display text-sm font-semibold leading-snug text-text-primary line-clamp-2">
              {memoryNoteDisplayName(memory)}
            </span>
            {label && (
              <span className="shrink-0 rounded bg-surface-elevated px-1.5 py-0.5 text-xs text-text-secondary" title="Map label">
                {label}
              </span>
            )}
          </div>
          <span className="mt-1 block text-[11px] text-text-secondary">
            {formatDate(displayDate, false)} · {formatCoords(memory.lat, memory.lng)}
          </span>
          {groupName && (
            <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-text-muted">Group · {groupName}</span>
          )}
          {yamlLocation && (
            <p className="mt-1 text-[11px] leading-snug text-text-muted line-clamp-2" title={yamlLocation}>
              {yamlLocation}
            </p>
          )}
          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-text-secondary"
                >
                  {t}
                </span>
              ))}
              {tags.length > 6 && (
                <span className="text-[10px] text-text-muted">+{tags.length - 6}</span>
              )}
            </div>
          )}
          {preview && (
            <p className="font-body mt-1.5 text-[11px] leading-relaxed text-text-muted line-clamp-2">{preview}</p>
          )}
          {linksSummary && (
            <p className="mt-1 text-[10px] text-accent/90 line-clamp-1" title={links.join('\n')}>
              {links.length > 1 ? linksSummary : `Link · ${linksSummary}`}
            </p>
          )}
          {memory.hidden && (
            <span className="mt-1 inline-block rounded border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-muted">
              Hidden on map
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function MemorySearchDrawer() {
  const open = useMemoryStore((s) => s.memorySearchDrawerOpen);
  const setMemorySearchDrawerOpen = useMemoryStore((s) => s.setMemorySearchDrawerOpen);
  const setMemorySearchMatchIds = useMemoryStore((s) => s.setMemorySearchMatchIds);
  const memories = useMemoryStore((s) => s.memories);
  const groups = useMemoryStore((s) => s.groups);
  const setCardTargetMemoryId = useMemoryStore((s) => s.setCardTargetMemoryId);
  const sidebarOpen = useMemoryStore((s) => s.sidebarOpen);
  const sidebarWidth = useMemoryStore((s) => s.sidebarWidth);

  const map = useMapRef();
  const isMd = useIsMd();
  const [active, setActive] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(panelRef, open);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 350);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (normalizeSearchTokens(debouncedQuery).length === 0) {
      setMemorySearchMatchIds(null);
      return;
    }
    const hits = filterMemoriesByTextQuery(memories, groups, debouncedQuery);
    setMemorySearchMatchIds(hits.map((m) => m.id));
  }, [open, debouncedQuery, memories, groups, setMemorySearchMatchIds]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMemorySearchDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setMemorySearchDrawerOpen]);

  const results = useMemo(
    () => (debouncedQuery ? filterMemoriesByTextQuery(memories, groups, debouncedQuery) : []),
    [debouncedQuery, memories, groups]
  );

  const mapChrome = useCallback(
    () => ({
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
      isMd,
      sidebarOpen,
      sidebarWidth,
    }),
    [isMd, sidebarOpen, sidebarWidth]
  );

  const fitAllOnMap = useCallback(() => {
    if (!map || results.length === 0) return;
    const chrome = mapChrome();
    if (results.length === 1) {
      flyToPointClearingMemorySearchDock(map, results[0].lat, results[0].lng, chrome, {
        maxZoom: 15,
        duration: 0.55,
      });
      return;
    }
    const bounds = L.latLngBounds(results.map((m) => [m.lat, m.lng] as L.LatLngTuple));
    const pad = flyToBoundsChromePadding(chrome);
    map.flyToBounds(bounds, { ...pad, duration: 0.55, maxZoom: 15 });
  }, [map, results, mapChrome]);

  const goToMemory = useCallback(
    (memory: Memory) => {
      setCardTargetMemoryId(memory.id);
      if (map) {
        flyToPointClearingMemorySearchDock(map, memory.lat, memory.lng, mapChrome(), {
          maxZoom: 17,
          duration: 0.5,
        });
      }
    },
    [map, mapChrome, setCardTargetMemoryId]
  );

  if (!open) return null;

  return (
    <>
      {/* pointer-events-none so the map still receives hover/clicks; first map click closes via MapClickHandler. */}
      {/* Above add/edit drawer (z-1101) so search stays usable while editing; below confirm dialogs (~1200). */}
      <div className="pointer-events-none fixed inset-0 z-[1120] bg-background/10" aria-hidden />

      <div
        ref={panelRef}
        className={`pointer-events-auto fixed inset-y-0 right-0 z-[1121] flex w-[min(540px,92vw)] sm:w-[min(620px,88vw)] lg:w-[min(780px,70vw)] xl:w-[min(860px,60vw)] flex-col rounded-l-xl border-l border-y border-border bg-surface shadow-xl transition-transform duration-300 ease-out ${
          active ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Search memories"
      >
        <div
          className="flex flex-1 flex-col overflow-hidden overscroll-contain p-4 py-6 md:p-8"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-text-primary md:text-2xl">Search memories</h2>
              <p className="mt-1 font-mono text-xs text-text-muted">
                Title, notes, tags, links, dates, coordinates, group name. Words must be at least 2 letters/digits
                (or one non‑Latin character); space means every word must match. While this panel is open, the map
                keeps pins in the area left of the drawer so you can click them; click empty map to close search.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMemorySearchDrawerOpen(false)}
              className="touch-target flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-border bg-surface/70 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary active:opacity-80"
              aria-label="Close search"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <label className="font-mono sr-only" htmlFor="memory-search-input">
            Search query
          </label>
          <input
            id="memory-search-input"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter…"
            className="font-mono w-full min-h-[48px] rounded-lg border border-border bg-surface-elevated/60 px-4 py-3 text-base text-text-primary placeholder-text-muted outline-none focus:border-accent md:text-sm"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={results.length === 0}
              onClick={fitAllOnMap}
              className="font-mono min-h-[44px] rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-accent transition-colors hover:border-accent hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              Fit all results on map
            </button>
            {normalizeSearchTokens(debouncedQuery).length > 0 && (
              <span className="font-mono flex items-center text-xs text-text-muted">
                {results.length} match{results.length === 1 ? '' : 'es'}
              </span>
            )}
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-t border-border pt-4">
            {!debouncedQuery.trim() ? (
              <p className="font-mono text-sm text-text-muted">Enter text to search your archive.</p>
            ) : normalizeSearchTokens(debouncedQuery).length === 0 ? (
              <p className="font-mono text-sm text-text-muted">
                Add longer words (2+ letters or digits). Single Latin letters are ignored so the map is not flooded with
                matches.
              </p>
            ) : results.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">No memories match that search.</p>
            ) : (
              <ul className="flex flex-col gap-2" role="listbox" aria-label="Search results">
                {results.map((m) => (
                  <li key={m.id}>
                    <MemorySearchResultRow memory={m} groups={groups} onSelect={() => goToMemory(m)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
