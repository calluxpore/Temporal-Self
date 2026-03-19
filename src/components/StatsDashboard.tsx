import { useMemo } from 'react';
import type { Memory } from '../types/memory';

interface StatsDashboardProps {
  memories: Memory[];
}

/** Round lat/lng to ~100km grid for "places" count. */
function placeKey(lat: number, lng: number): string {
  return `${Math.round(lat * 10) / 10},${Math.round(lng * 10) / 10}`;
}

export function StatsDashboard({ memories }: StatsDashboardProps) {
  const stats = useMemo(() => {
    const total = memories.length;
    const places = new Set(memories.map((m) => placeKey(m.lat, m.lng))).size;
    const byMonth = new Map<string, number>();
    const byYear = new Map<number, number>();
    for (const m of memories) {
      const d = m.date.slice(0, 7);
      byMonth.set(d, (byMonth.get(d) ?? 0) + 1);
      const y = parseInt(m.date.slice(0, 4), 10);
      byYear.set(y, (byYear.get(y) ?? 0) + 1);
    }
    const topMonths = [...byMonth.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const starred = memories.filter((m) => m.starred).length;
    const withImages = memories.filter((m) => m.imageDataUrl || (m.imageDataUrls?.length ?? 0) > 0).length;
    return {
      total,
      places,
      starred,
      withImages,
      byYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]),
      topMonths,
    };
  }, [memories]);

  return (
    <div className="space-y-4 py-2 font-mono text-[11px]">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Total memories</div>
          <div className="text-lg font-semibold text-text-primary">{stats.total}</div>
        </div>
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Places</div>
          <div className="text-lg font-semibold text-text-primary">{stats.places}</div>
        </div>
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Starred</div>
          <div className="text-lg font-semibold text-text-primary">{stats.starred}</div>
        </div>
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">With photos</div>
          <div className="text-lg font-semibold text-text-primary">{stats.withImages}</div>
        </div>
      </div>
      {stats.byYear.length > 0 && (
        <div>
          <div className="mb-1 text-text-muted">Memories per year</div>
          <div className="space-y-1">
            {stats.byYear.map(([year, count]) => (
              <div key={year} className="flex items-center gap-2">
                <span className="w-12 text-text-secondary">{year}</span>
                <div className="flex-1 rounded bg-surface-elevated">
                  <div
                    className="h-5 rounded bg-accent/60"
                    style={{
                      width: `${Math.min(100, (count / Math.max(...stats.byYear.map(([, c]) => c))) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-6 text-right text-text-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats.topMonths.length > 0 && (
        <div>
          <div className="mb-1 text-text-muted">Top months</div>
          <ul className="space-y-0.5">
            {stats.topMonths.map(([month, count]) => (
              <li key={month} className="flex justify-between text-text-secondary">
                <span>{month}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
