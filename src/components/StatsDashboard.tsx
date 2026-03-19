import { useMemo } from 'react';
import type { Memory } from '../types/memory';
import { useMemoryStore } from '../store/memoryStore';
import type { StudyCheckpointTag } from '../types/study';

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
    const byDate = new Map<string, number>();
    for (const m of memories) {
      const d = m.date.slice(0, 7);
      byMonth.set(d, (byMonth.get(d) ?? 0) + 1);
      const y = parseInt(m.date.slice(0, 4), 10);
      byYear.set(y, (byYear.get(y) ?? 0) + 1);
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + 1);
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
      byDate: [...byDate.entries()].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return b[0].localeCompare(a[0]);
      }),
    };
  }, [memories]);

  const studyParticipantId = useMemoryStore((s) => s.studyParticipantId);
  const studyCheckpointTag = useMemoryStore((s) => s.studyCheckpointTag);
  const studyCheckpointCompletedAt = useMemoryStore((s) => s.studyCheckpointCompletedAt);
  const studyEvents = useMemoryStore((s) => s.studyEvents);
  const setStudyParticipantId = useMemoryStore((s) => s.setStudyParticipantId);
  const setStudyCheckpointTag = useMemoryStore((s) => s.setStudyCheckpointTag);
  const markStudyCheckpointComplete = useMemoryStore((s) => s.markStudyCheckpointComplete);

  const formatShort = (iso: string | undefined) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  };

  const checkpoints: StudyCheckpointTag[] = ['baseline', '2d', '14d', '40d'];
  const canComplete = !!studyParticipantId && !!studyCheckpointTag;

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
      {stats.byDate.length > 0 && (
        <div>
          <div className="mb-1 text-text-muted">Date-wise memories</div>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-border bg-surface-elevated/30 p-1.5">
            {stats.byDate.map(([date, count]) => (
              <li key={date} className="flex items-center justify-between text-text-secondary">
                <span>{date}</span>
                <span className="text-text-primary">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Research / study controls */}
      <div className="space-y-2 rounded border border-border bg-surface-elevated/50 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-text-muted">Study</div>
          <div className="text-text-muted">{studyEvents.length} events</div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-2">
            <span className="text-text-secondary">ID</span>
            <input
              value={studyParticipantId ?? ''}
              onChange={(e) => setStudyParticipantId(e.target.value || null)}
              placeholder="P01"
              className="w-2/3 rounded-md border border-border bg-transparent px-2 py-1 text-[11px] text-text-primary outline-none"
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span className="text-text-secondary">Checkpoint</span>
            <select
              value={studyCheckpointTag ?? ''}
              onChange={(e) => setStudyCheckpointTag((e.target.value || null) as StudyCheckpointTag | null)}
              className="w-2/3 rounded-md border border-border bg-transparent px-2 py-1 text-[11px] text-text-primary outline-none"
            >
              <option value="">—</option>
              <option value="baseline">Baseline</option>
              <option value="2d">2D</option>
              <option value="14d">2W</option>
              <option value="40d">40D</option>
            </select>
          </label>

          <button
            type="button"
            disabled={!canComplete}
            onClick={markStudyCheckpointComplete}
            className="touch-target min-h-[32px] rounded-md bg-accent px-3 py-1 text-xs font-medium text-background shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark done
          </button>
        </div>

        <div className="pt-1">
          <div className="text-text-muted mb-1">Completed</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {checkpoints.map((c) => (
              <div key={c} className="flex items-center gap-1 text-text-secondary">
                <span className="capitalize">{c === '2d' ? '2D' : c === '14d' ? '2W' : c === '40d' ? '40D' : 'Base'}</span>
                <span>{formatShort(studyCheckpointCompletedAt[c])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
