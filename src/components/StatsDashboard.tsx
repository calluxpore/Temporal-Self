import { useMemo } from 'react';
import type { Memory } from '../types/memory';
import { useMemoryStore } from '../store/memoryStore';
import type { StudyCheckpointTag } from '../types/study';
import { studyCheckpointLabel } from '../utils/studyLabels';

interface StatsDashboardProps {
  memories: Memory[];
}

const STUDY_CHECKPOINTS: StudyCheckpointTag[] = ['baseline', '2d', '14d', '40d'];

/** Sentinel for `<select>` when the current ID is not in the saved list (must not match a real ID). */
const NEW_PARTICIPANT_SELECT = '__study_pick_new__';

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
  const studyCheckpointCompletedByParticipant = useMemoryStore((s) => s.studyCheckpointCompletedByParticipant);
  const studyEvents = useMemoryStore((s) => s.studyEvents);
  const theme = useMemoryStore((s) => s.theme);
  const setStudyParticipantId = useMemoryStore((s) => s.setStudyParticipantId);
  const setStudyCheckpointTag = useMemoryStore((s) => s.setStudyCheckpointTag);
  const markStudyCheckpointComplete = useMemoryStore((s) => s.markStudyCheckpointComplete);

  const formatCompletedDate = (iso: string | undefined) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const canComplete = !!studyParticipantId && !!studyCheckpointTag;

  /** Known IDs from completions + study event log (for the picker). */
  const studyParticipantIdSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const k of Object.keys(studyCheckpointCompletedByParticipant)) {
      const t = k.trim();
      if (t) s.add(t);
    }
    for (const e of studyEvents) {
      const p = e.participantId;
      if (typeof p === 'string' && p.trim()) s.add(p.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [studyCheckpointCompletedByParticipant, studyEvents]);

  /** Syncs native `<select>` with store: exact saved ID, empty, or “custom” sentinel. */
  const participantPickerValue = useMemo(() => {
    const raw = studyParticipantId ?? '';
    const t = raw.trim();
    if (!t) return '';
    if (studyParticipantIdSuggestions.includes(t)) return t;
    return NEW_PARTICIPANT_SELECT;
  }, [studyParticipantId, studyParticipantIdSuggestions]);

  /** Every participant ID that has at least one completed checkpoint, sorted A→Z. */
  const participantIdsWithCompletions = useMemo(() => {
    const ids = Object.keys(studyCheckpointCompletedByParticipant).filter((id) => {
      const m = studyCheckpointCompletedByParticipant[id];
      if (!m) return false;
      return STUDY_CHECKPOINTS.some((c) => !!m[c]);
    });
    return ids.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [studyCheckpointCompletedByParticipant]);

  const currentPidTrimmed = studyParticipantId?.trim() ?? '';

  /** Same IDs, but the active participant (from the field above) is listed first for quick scanning. */
  const participantIdsOrderedForDisplay = useMemo(() => {
    const ids = [...participantIdsWithCompletions];
    if (!currentPidTrimmed) return ids;
    return ids.sort((a, b) => {
      const aCur = a === currentPidTrimmed;
      const bCur = b === currentPidTrimmed;
      if (aCur !== bCur) return aCur ? -1 : 1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }, [participantIdsWithCompletions, currentPidTrimmed]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 font-mono text-[11px]">
      <div className="shrink-0 space-y-4">
      <div className="grid w-full grid-cols-2 gap-2">
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
      </div>

      {/* Study: fills remaining sidebar height; only the participant list scrolls */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/90 bg-gradient-to-b from-surface-elevated/80 to-surface/90 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] dark:shadow-[0_1px_0_0_rgba(0,0,0,0.25)_inset]">
        <div className="shrink-0 border-b border-border/70 bg-surface-elevated/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-secondary">Study</h2>
            <span className="rounded-full border border-border/60 bg-background/30 px-2 py-0.5 text-[10px] tabular-nums text-text-muted">
              {studyEvents.length} events
            </span>
          </div>
        </div>

        <div className="relative z-10 shrink-0 space-y-3 border-b border-border/50 bg-surface/40 px-3 py-3">
          <div className="space-y-2">
            <span className="block text-[10px] font-medium text-text-secondary">Participant ID</span>

            {/* One row: menu (left) + type/edit (right); mini-labels keep roles obvious */}
            <div className="flex items-end gap-2">
              <div className="flex min-w-0 w-[min(42%,10.5rem)] shrink-0 flex-col gap-0.5">
                <label
                  htmlFor="study-participant-picker"
                  className="text-[9px] font-medium uppercase tracking-wide text-text-muted"
                >
                  List
                </label>
                <select
                  id="study-participant-picker"
                  value={participantPickerValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      setStudyParticipantId(null);
                      return;
                    }
                    if (v === NEW_PARTICIPANT_SELECT) {
                      const t = studyParticipantId?.trim() ?? '';
                      // Clear when switching from a saved ID to "other"; keep custom text already typed.
                      if (!t || studyParticipantIdSuggestions.includes(t)) setStudyParticipantId(null);
                      return;
                    }
                    setStudyParticipantId(v);
                  }}
                  style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-[11px] text-text-primary shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 [&>option]:bg-surface [&>option]:text-text-primary"
                  aria-label="Choose a saved participant ID"
                >
                  <option value="">Saved IDs…</option>
                  {studyParticipantIdSuggestions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                  <option value={NEW_PARTICIPANT_SELECT}>
                    {studyParticipantIdSuggestions.length > 0 ? 'Other…' : 'New ID…'}
                  </option>
                </select>
              </div>

              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <label
                  htmlFor="study-participant-id-input"
                  className="text-[9px] font-medium uppercase tracking-wide text-text-muted"
                >
                  Type / edit
                </label>
                <input
                  id="study-participant-id-input"
                  type="text"
                  value={studyParticipantId ?? ''}
                  onChange={(e) => setStudyParticipantId(e.target.value || null)}
                  placeholder="Code used for Mark done"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  className="h-10 w-full rounded-lg border border-border border-l-accent/50 bg-surface pl-2.5 pr-2 text-[11px] text-text-primary shadow-sm outline-none transition-colors placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
                  aria-label="Type or edit participant ID"
                />
              </div>
            </div>

            <p className="text-[10px] leading-relaxed text-text-muted">
              <span className="text-text-secondary">List</span> fills <span className="text-text-secondary">Type / edit</span>; you can
              also type a <span className="text-text-secondary">new</span> ID directly on the right — that value is what
              Mark done uses.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-medium text-text-secondary">Checkpoint</label>
            <select
              value={studyCheckpointTag ?? ''}
              onChange={(e) => setStudyCheckpointTag((e.target.value || null) as StudyCheckpointTag | null)}
              style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[11px] text-text-primary shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 [&>option]:bg-surface [&>option]:text-text-primary"
            >
              <option value="">Select checkpoint…</option>
              <option value="baseline">Baseline</option>
              <option value="2d">2D</option>
              <option value="14d">2W (14 days)</option>
              <option value="40d">40D</option>
            </select>
          </div>

          <button
            type="button"
            disabled={!canComplete}
            onClick={markStudyCheckpointComplete}
            className="w-full touch-target min-h-[40px] rounded-lg bg-accent px-3 py-2.5 text-xs font-semibold text-background shadow-md transition-[filter,opacity] hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark done
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
          <div className="mb-2 flex shrink-0 items-end justify-between gap-2 border-b border-border/40 pb-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Checkpoint progress</span>
            {participantIdsWithCompletions.length > 0 ? (
              <span className="text-[10px] tabular-nums text-text-muted">
                {participantIdsWithCompletions.length} participant{participantIdsWithCompletions.length !== 1 ? 's' : ''}
              </span>
            ) : null}
          </div>

          {participantIdsWithCompletions.length === 0 ? (
            <div className="flex min-h-[7rem] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-surface/50 px-3 py-6 text-center">
              <p className="max-w-[18rem] text-[10px] leading-relaxed text-text-muted">
                No completions yet. Set participant ID and checkpoint above, then <span className="text-text-secondary">Mark done</span>.
              </p>
            </div>
          ) : (
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-border/60 bg-background/30 [scrollbar-color:rgba(120,120,120,0.35)_transparent] [scrollbar-width:thin] dark:bg-background/20"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <ul className="space-y-2.5 p-2.5">
                {participantIdsOrderedForDisplay.map((pid) => {
                  const row = studyCheckpointCompletedByParticipant[pid] ?? {};
                  const isCurrent = currentPidTrimmed !== '' && pid === currentPidTrimmed;
                  return (
                    <li
                      key={pid}
                      className={
                        'overflow-hidden rounded-lg border bg-surface/90 shadow-sm ' +
                        (isCurrent
                          ? 'border-accent/50 ring-1 ring-accent/30'
                          : 'border-border/70 hover:border-border')
                      }
                    >
                      <div
                        className={
                          'flex items-center justify-between gap-2 border-b border-border/50 px-2.5 py-2 ' +
                          (isCurrent ? 'bg-accent/10' : 'bg-surface-elevated/50')
                        }
                      >
                        <span className="min-w-0 truncate text-[11px] font-semibold text-text-primary" title={pid}>
                          {pid}
                        </span>
                        {isCurrent ? (
                          <span className="shrink-0 rounded-md bg-accent/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 p-2.5">
                        {STUDY_CHECKPOINTS.map((c) => {
                          const done = formatCompletedDate(row[c]);
                          return (
                            <div
                              key={c}
                              className="flex flex-col gap-0.5 rounded-md border border-border/40 bg-background/40 px-2 py-1.5 dark:bg-background/25"
                            >
                              <span className="text-[9px] font-medium uppercase tracking-wide text-text-muted">
                                {studyCheckpointLabel(c)}
                              </span>
                              <span className="truncate text-[10px] text-text-secondary" title={done ?? undefined}>
                                {done ? (
                                  done
                                ) : (
                                  <span className="text-text-muted/80">Pending</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
