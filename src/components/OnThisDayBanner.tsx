import { useCallback, useMemo, useState } from 'react';
import { useMapRef } from '../context/mapContextState';
import { useMemoryStore } from '../store/memoryStore';
import type { Memory } from '../types/memory';

interface OnThisDayBannerProps {
  memories: Memory[];
  tourActive: boolean;
  spatialWalkActive: boolean;
}

function dateOnly(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function OnThisDayBanner({ memories, tourActive, spatialWalkActive }: OnThisDayBannerProps) {
  const map = useMapRef();
  const setSelectedMemory = useMemoryStore((s) => s.setSelectedMemory);
  const setDateFilter = useMemoryStore((s) => s.setDateFilter);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => `otd-dismissed-${today.toDateString()}`, [today]);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(todayKey) === 'true';
  });

  const matches = useMemo(() => {
    const list = memories.filter((m) => {
      const d = new Date(m.date);
      return (
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate() &&
        d.getFullYear() < today.getFullYear()
      );
    });
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [memories, today]);

  const summary = useMemo(() => {
    if (matches.length === 0) return '';
    const years = Array.from(new Set(matches.map((m) => new Date(m.date).getFullYear()))).sort((a, b) => a - b);
    if (matches.length === 1) return `1 memory from ${years[0]}`;
    if (matches.length === 2) return `2 memories from ${years[0]} and ${years[1]}`;
    return `${matches.length} memories across ${years[0]}-${years[years.length - 1]}`;
  }, [matches]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(todayKey, 'true');
    }
  }, [todayKey]);

  const handleOpen = useCallback(() => {
    if (matches.length === 0) return;
    const first = matches[0];
    setSelectedMemory(first);
    map?.flyTo([first.lat, first.lng], 17, { duration: 0.5 });

    if (matches.length > 1) {
      // Constrain the date range to include all same-day historical matches.
      const from = dateOnly(matches[0].date);
      const to = dateOnly(matches[matches.length - 1].date);
      setDateFilter(from, to);
    }
  }, [map, matches, setDateFilter, setSelectedMemory]);

  if (tourActive || spatialWalkActive || dismissed || matches.length === 0) {
    return null;
  }

  return (
    <div className="mb-1 rounded-sm border-l-[3px] border-amber-400 bg-amber-50 px-2 py-1">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className="min-w-0 flex-1 text-left"
          aria-label="Open On this day memories"
        >
          <p className="text-[12px] font-medium leading-tight text-amber-800">On this day</p>
          <p className="mt-0.5 text-[11px] leading-tight text-amber-700">{summary}</p>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss On this day banner"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-amber-600 hover:bg-amber-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
