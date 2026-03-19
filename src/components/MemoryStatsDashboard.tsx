import { useMemo } from 'react';
import type { Memory } from '../types/memory';
import { isDueForReview } from '../utils/spacedRepetition';

interface MemoryStatsDashboardProps {
  memories: Memory[];
  /** Each time you run Practice recall, one entry: { remembered, forgot } for that session. */
  recallSessions: { remembered: number; forgot: number }[];
}

export function MemoryStatsDashboard({ memories, recallSessions }: MemoryStatsDashboardProps) {
  const stats = useMemo(() => {
    const total = memories.length;
    const remembered = memories.reduce((sum, m) => sum + (m.reviewCount ?? 0), 0);
    const forgot = memories.reduce((sum, m) => sum + (m.failedReviewCount ?? 0), 0);
    const dueNow = memories.filter(isDueForReview).length;
    const withAtLeastOneReview = memories.filter((m) => (m.reviewCount ?? 0) > 0).length;
    const totalRecallAttempts = remembered + forgot;
    const successRate = totalRecallAttempts > 0 ? Math.round((remembered / totalRecallAttempts) * 100) : null;

    // Per-session (cycle): each row = one Practice recall run with remembered vs forgot that time
    const ordinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
    };
    const sessionsForDisplay = recallSessions.map((s, i) => ({
      cycle: i + 1,
      label: ordinal(i + 1) + ' cycle',
      remembered: s.remembered,
      forgot: s.forgot,
      total: s.remembered + s.forgot,
    }));
    const maxInSession = Math.max(1, ...sessionsForDisplay.map((s) => s.total));

    // Never attempted recall (no successful and no failed)
    const neverAttempted = memories.filter(
      (m) => (m.reviewCount ?? 0) === 0 && (m.failedReviewCount ?? 0) === 0
    ).length;

    // Attempted at least once (in recall session)
    const attemptedAtLeastOnce = total - neverAttempted;

    // Next review: due now vs scheduled later
    const scheduledLater = memories.filter((m) => {
      if (m.nextReviewAt == null || m.nextReviewAt === '') return false;
      try {
        return new Date(m.nextReviewAt).getTime() > Date.now();
      } catch {
        return false;
      }
    }).length;

    // Memories that struggled (failed at least once)
    const struggledAtLeastOnce = memories.filter((m) => (m.failedReviewCount ?? 0) > 0).length;

    return {
      total,
      remembered,
      forgot,
      dueNow,
      withAtLeastOneReview,
      totalRecallAttempts,
      successRate,
      sessionsForDisplay,
      neverAttempted,
      attemptedAtLeastOnce,
      scheduledLater,
      struggledAtLeastOnce,
    };
  }, [memories, recallSessions]);

  return (
    <div className="space-y-4 py-2 font-mono text-[11px]">
      {/* Recall score */}
      <div className="rounded-lg border border-border bg-surface-elevated/50 p-3 text-center">
        <div className="text-text-muted text-[10px] uppercase tracking-wide">Recall score</div>
        {stats.totalRecallAttempts > 0 && stats.successRate !== null ? (
          <>
            <div className="mt-1 text-3xl font-bold text-accent tabular-nums">{stats.successRate}</div>
            <div className="text-[10px] text-text-muted">out of 100 · based on I remember vs Show me</div>
          </>
        ) : (
          <>
            <div className="mt-1 text-xl font-semibold text-text-muted">—</div>
            <div className="text-[10px] text-text-muted">Practice recall to get a score</div>
          </>
        )}
      </div>

      {/* Top-level summary */}
      <div className="text-text-muted text-[10px] uppercase tracking-wide">Summary</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">I remember</div>
          <div className="text-lg font-semibold text-accent">{stats.remembered}</div>
          <div className="text-[10px] text-text-muted">successful recalls</div>
        </div>
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Show me</div>
          <div className="text-lg font-semibold text-danger">{stats.forgot}</div>
          <div className="text-[10px] text-text-muted">times needed a hint</div>
        </div>
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Due for recall</div>
          <div className="text-lg font-semibold text-text-primary">{stats.dueNow}</div>
          <div className="text-[10px] text-text-muted">ready to practice now</div>
        </div>
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Scheduled later</div>
          <div className="text-lg font-semibold text-text-primary">{stats.scheduledLater}</div>
          <div className="text-[10px] text-text-muted">next review in future</div>
        </div>
      </div>

      {/* Success rate */}
      {stats.totalRecallAttempts > 0 && stats.successRate !== null && (
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Recall success rate</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 rounded bg-surface-elevated">
              <div
                className="h-5 rounded bg-accent/60"
                style={{ width: `${stats.successRate}%` }}
              />
            </div>
            <span className="w-10 text-right font-semibold text-text-primary">{stats.successRate}%</span>
          </div>
          <div className="mt-0.5 text-[10px] text-text-muted">
            {stats.remembered} remembered / {stats.totalRecallAttempts} total answers
          </div>
        </div>
      )}

      {/* By recall cycle: each row = one Practice recall run (how many remembered vs forgot that time) */}
      <div className="text-text-muted text-[10px] uppercase tracking-wide">By recall cycle</div>
      <p className="text-[10px] text-text-muted">
        Each time you run Practice recall counts as one cycle. Shown: how many you remembered vs needed “Show me” in that run.
      </p>
      {stats.sessionsForDisplay.length === 0 ? (
        <p className="text-[10px] text-text-muted">No recall sessions yet. Use Practice recall to start.</p>
      ) : (
        <div className="space-y-2">
          {stats.sessionsForDisplay.map(({ cycle, label, remembered: r, forgot: f, total }) => (
            <div key={cycle} className="rounded border border-border bg-surface-elevated/50 p-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-text-secondary">{label}</span>
                <span className="text-[10px] text-text-muted">
                  <span className="text-accent">{r}</span> remembered · <span className="text-danger">{f}</span> show me
                </span>
              </div>
              <div className="mt-1 flex h-5 overflow-hidden rounded bg-surface-elevated">
                <div
                  className="rounded-l bg-accent/70"
                  style={{ width: total > 0 ? `${(r / total) * 100}%` : '0%' }}
                />
                <div
                  className="rounded-r bg-danger/60"
                  style={{ width: total > 0 ? `${(f / total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Practice depth */}
      <div className="text-text-muted text-[10px] uppercase tracking-wide">Practice depth</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Never attempted</div>
          <div className="text-lg font-semibold text-text-primary">{stats.neverAttempted}</div>
          <div className="text-[10px] text-text-muted">not in recall yet</div>
        </div>
        <div className="rounded border border-border bg-surface-elevated/50 p-2">
          <div className="text-text-muted">Practiced at least once</div>
          <div className="text-lg font-semibold text-text-primary">{stats.attemptedAtLeastOnce}</div>
          <div className="text-[10px] text-text-muted">of {stats.total} total</div>
        </div>
        <div className="rounded border border-border bg-surface-elevated/50 p-2 col-span-2">
          <div className="text-text-muted">Struggled at least once (Show me)</div>
          <div className="text-lg font-semibold text-danger">{stats.struggledAtLeastOnce}</div>
          <div className="text-[10px] text-text-muted">memories that needed a hint</div>
        </div>
      </div>
    </div>
  );
}
