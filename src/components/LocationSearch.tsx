import { useState, useRef, useEffect, useCallback } from 'react';
import { useMapRef } from '../context/MapContext';
import { useMemoryStore } from '../store/memoryStore';
import { useIsMd } from '../hooks/useMediaQuery';
import type { SearchHighlightBbox } from '../store/memoryStore';

/** [south, north, west, east] - when present and not a tiny box, treat as area. */
export interface GeoResult {
  lat: number;
  lng: number;
  display_name: string;
  bbox?: SearchHighlightBbox;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const DEBOUNCE_MS = 500;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

async function searchNominatim(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    addressdetails: '0',
    limit: '6',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MemoryAtlas/1.0 (https://github.com/memory-atlas)',
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(
    (r: {
      place_id: number;
      lat: string;
      lon: string;
      display_name: string;
      boundingbox?: string[];
    }) => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      let bbox: SearchHighlightBbox | undefined;
      if (Array.isArray(r.boundingbox) && r.boundingbox.length >= 4) {
        const [s, n, w, e] = r.boundingbox.map(Number);
        const latSpan = n - s;
        const lngSpan = e - w;
        if (latSpan > 0.0001 || lngSpan > 0.0001) bbox = [s, n, w, e];
      }
      return { lat, lng, display_name: r.display_name, bbox };
    }
  );
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; city?: string; state?: string; country?: string };
}

async function searchPhoton(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: '8',
  });
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  const features: PhotonFeature[] = data?.features ?? [];
  return features
    .filter((f) => f.geometry?.coordinates?.length >= 2)
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties;
      const parts = [p?.name, p?.street, p?.city, p?.state, p?.country].filter(Boolean);
      const display_name = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
      return { lat, lng, display_name };
    });
}

async function searchLocation(
  query: string,
  signal?: AbortSignal
): Promise<{ results: GeoResult[]; error?: string }> {
  const q = query.trim();
  if (!q || q.length < 2) return { results: [] };
  try {
    let results = await searchNominatim(q, signal);
    if (results.length === 0) results = await searchPhoton(q, signal);
    return { results };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { results: [], error: 'Search failed. Try again.' };
  }
}

export function LocationSearch() {
  const map = useMapRef();
  const isMd = useIsMd();
  const sidebarOpen = useMemoryStore((s) => s.sidebarOpen);
  const sidebarWidth = useMemoryStore((s) => s.sidebarWidth);
  const setSearchHighlight = useMemoryStore((s) => s.setSearchHighlight);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    searchLocation(debouncedQuery, controller.signal)
      .then(({ results: data, error: err }) => {
        setResults(data);
        setError(err ?? null);
        setSelectedIndex(-1);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') {
          setResults([]);
          setError('Search failed. Try again.');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (result: GeoResult) => {
      const highlight =
        result.bbox != null
          ? { type: 'area' as const, bbox: result.bbox }
          : { type: 'point' as const, lat: result.lat, lng: result.lng };
      setSearchHighlight(highlight);
      setQuery('');
      setResults([]);
      setError(null);
      setOpen(false);
      if (map) {
        if (result.bbox != null) {
          const [south, north, west, east] = result.bbox;
          map.flyToBounds(
            [
              [south, west],
              [north, east],
            ],
            { padding: [40, 40], duration: 0.6, maxZoom: 16 }
          );
        } else {
          map.flyTo([result.lat, result.lng], 14, { duration: 0.6 });
        }
      }
    },
    [map, setSearchHighlight]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : i));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const hasSearched = query.trim().length >= 2 && debouncedQuery === query;
  const showDropdown =
    open &&
    (results.length > 0 || loading || error !== null || (hasSearched && !loading));

  return (
    <div
      ref={containerRef}
      className="fixed bottom-8 z-[700] w-full max-w-md -translate-x-1/2 px-4 safe-area-bottom transition-[left] duration-300"
      style={{
        bottom: 'max(2rem, env(safe-area-inset-bottom, 0px))',
        left:
          isMd && sidebarOpen
            ? `calc(${sidebarWidth}px + (100vw - ${sidebarWidth}px) / 2)`
            : '50%',
      }}
    >
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search a location..."
          className="font-mono w-full min-h-[44px] touch-target rounded-full border border-border bg-surface/95 py-3 pl-4 pr-12 text-base text-text-primary placeholder-text-muted outline-none backdrop-blur-sm focus:border-accent md:py-2.5 md:text-sm"
          aria-label="Search location"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {loading && (
          <div
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden
          >
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="32 56"
              />
            </svg>
          </div>
        )}
      </div>
      {showDropdown && (
        <ul
          className="absolute bottom-full left-0 right-0 mb-1 max-h-56 overflow-y-auto rounded-3xl border border-border bg-surface shadow-lg"
          role="listbox"
        >
          {loading && results.length === 0 && !error ? (
            <li className="font-mono px-4 py-3 text-sm text-text-muted">Searching...</li>
          ) : error ? (
            <li className="font-mono px-4 py-3 text-sm text-danger">{error}</li>
          ) : results.length === 0 ? (
            <li className="font-mono px-4 py-3 text-sm text-text-muted">
              No places found. Try a different search (e.g. city name or address).
            </li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === selectedIndex}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`font-mono w-full min-h-[44px] touch-target px-4 py-3 text-left text-sm transition-colors active:bg-surface-elevated ${
                    i === selectedIndex
                      ? 'bg-surface-elevated text-accent'
                      : 'text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
