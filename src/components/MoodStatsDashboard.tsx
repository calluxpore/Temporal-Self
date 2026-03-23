import { useMemo } from 'react';
import type { Memory, MemoryMood } from '../types/memory';
import { useMemoryStore } from '../store/memoryStore';
import { MEMORY_MOOD_OPTIONS, MOOD_VALENCE, moodOption, parseMemoryMood } from '../utils/memoryMoods';

interface MoodStatsDashboardProps {
  memories: Memory[];
}

type MoodAnalysisResult = {
  total: number;
  tagged: number;
  untagged: number;
  coveragePct: number;
  counts: Record<MemoryMood, number>;
  maxCount: number;
  avgValence: number | null;
  balanceLabel: string;
  positiveTagged: number;
  negativeTagged: number;
  neutralTagged: number;
  posShare: number;
  negShare: number;
  neuShare: number;
  entropy: number | null;
  diversityPct: number | null;
  dominant: { id: MemoryMood; n: number } | null;
  monthsForDisplay: { key: string; label: string; count: number; avgValence: number }[];
  yearRows: { year: number; count: number; avgValence: number }[];
  weekdayDisplay: { label: string; count: number }[];
  weekdayMax: number;
  groupRows: { name: string; n: number; avgValence: number }[];
};

function entropyBits(counts: number[], total: number): number | null {
  if (total <= 0) return null;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MOOD_COLOR_SWATCH: Record<MemoryMood, string> = {
  radiant: '#f59e0b',
  content: '#22c55e',
  neutral: '#94a3b8',
  concerned: '#a855f7',
  distraught: '#ef4444',
};

export function MoodStatsDashboard({ memories }: MoodStatsDashboardProps) {
  const groups = useMemoryStore((s) => s.groups);

  const analysis = useMemo((): MoodAnalysisResult => {
    const total = memories.length;
    const withMood = memories.filter((m) => parseMemoryMood(m.mood) != null);
    const tagged = withMood.length;
    const untagged = total - tagged;
    const coveragePct = total > 0 ? Math.round((tagged / total) * 100) : 0;

    const counts: Record<MemoryMood, number> = {
      radiant: 0,
      content: 0,
      neutral: 0,
      concerned: 0,
      distraught: 0,
    };
    let valenceSum = 0;
    for (const m of withMood) {
      const id = parseMemoryMood(m.mood)!;
      counts[id] += 1;
      valenceSum += MOOD_VALENCE[id];
    }
    const maxCount = Math.max(1, ...Object.values(counts));

    const avgValence = tagged > 0 ? valenceSum / tagged : null;
    const positiveTagged = counts.radiant + counts.content;
    const negativeTagged = counts.concerned + counts.distraught;
    const neutralTagged = counts.neutral;

    const pct = (n: number) => (tagged > 0 ? Math.round((n / tagged) * 100) : 0);
    const posShare = pct(positiveTagged);
    const negShare = pct(negativeTagged);
    const neuShare = pct(neutralTagged);

    const entropy = entropyBits(
      MEMORY_MOOD_OPTIONS.map((o) => counts[o.id]),
      tagged
    );
    const maxEntropy = Math.log2(MEMORY_MOOD_OPTIONS.length);
    const diversityPct = entropy != null && maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : null;

    let dominant: { id: MemoryMood; n: number } | null = null;
    for (const o of MEMORY_MOOD_OPTIONS) {
      const n = counts[o.id];
      if (!dominant || n > dominant.n) dominant = { id: o.id, n };
    }
    if (dominant && dominant.n === 0) dominant = null;

    // Per month (memory.date YYYY-MM), only tagged
    const byMonth = new Map<string, { n: number; valenceSum: number }>();
    const byYear = new Map<number, { n: number; valenceSum: number }>();
    const byWeekday = new Map<number, number>();
    for (const m of withMood) {
      const d = m.date.slice(0, 10);
      const ym = d.slice(0, 7);
      const y = parseInt(d.slice(0, 4), 10);
      const mo = parseMemoryMood(m.mood)!;
      const v = MOOD_VALENCE[mo];
      const curM = byMonth.get(ym) ?? { n: 0, valenceSum: 0 };
      curM.n += 1;
      curM.valenceSum += v;
      byMonth.set(ym, curM);

      const curY = byYear.get(y) ?? { n: 0, valenceSum: 0 };
      curY.n += 1;
      curY.valenceSum += v;
      byYear.set(y, curY);

      try {
        const dt = new Date(d + 'T12:00:00');
        const wd = dt.getDay();
        byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1);
      } catch {
        /* */
      }
    }

    const monthKeys = [...byMonth.keys()].sort().slice(-10);
    const monthsForDisplay = monthKeys.map((k) => {
      const row = byMonth.get(k)!;
      return {
        key: k,
        label: k,
        count: row.n,
        avgValence: row.valenceSum / row.n,
      };
    });

    const yearRows = [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, row]) => ({
        year,
        count: row.n,
        avgValence: row.valenceSum / row.n,
      }));

    const weekdayDisplay = WEEKDAYS.map((label, i) => ({
      label,
      count: byWeekday.get(i) ?? 0,
    })).filter((x) => x.count > 0);

    const weekdayMax = Math.max(1, ...weekdayDisplay.map((d) => d.count));

    // By group: average valence where at least 1 tagged memory in group
    const groupById = new Map(groups.map((g) => [g.id, g.name]));
    const groupAgg = new Map<string, { n: number; valenceSum: number }>();
    for (const m of withMood) {
      const gid = m.groupId ?? null;
      if (!gid) continue;
      const mo = parseMemoryMood(m.mood)!;
      const v = MOOD_VALENCE[mo];
      const cur = groupAgg.get(gid) ?? { n: 0, valenceSum: 0 };
      cur.n += 1;
      cur.valenceSum += v;
      groupAgg.set(gid, cur);
    }
    const groupRows = [...groupAgg.entries()]
      .filter(([, g]) => g.n >= 1)
      .map(([gid, g]) => ({
        name: groupById.get(gid) ?? gid,
        n: g.n,
        avgValence: g.valenceSum / g.n,
      }))
      .sort((a, b) => b.avgValence - a.avgValence);

    const balanceLabel =
      avgValence == null
        ? '—'
        : avgValence >= 1.25
          ? 'Strongly positive'
          : avgValence >= 0.35
            ? 'Leaning positive'
            : avgValence > -0.35
              ? 'Balanced / mixed'
              : avgValence > -1.25
                ? 'Leaning toward difficult'
                : 'Heavy on difficult feelings';

    return {
      total,
      tagged,
      untagged,
      coveragePct,
      counts,
      maxCount,
      avgValence,
      balanceLabel,
      positiveTagged,
      negativeTagged,
      neutralTagged,
      posShare,
      negShare,
      neuShare,
      entropy,
      diversityPct,
      dominant,
      monthsForDisplay,
      yearRows,
      weekdayDisplay,
      weekdayMax,
      groupRows,
    };
  }, [memories, groups]);

  const narrative = useMemo(() => {
    const a = analysis;
    const lines: string[] = [];
    if (a.total === 0) {
      lines.push('Add memories with moods in the editor to unlock emotional analytics.');
      return lines;
    }
    if (a.tagged === 0) {
      lines.push(
        `None of your ${a.total} memories have a mood yet. Open the editor when adding or editing a memory and tap a mood emoji under “Mood” — even a rough label helps you see patterns over time.`
      );
      return lines;
    }
    lines.push(
      `You’ve logged a mood on ${a.tagged} of ${a.total} memories (${a.coveragePct}% coverage). ` +
        (a.coveragePct < 40
          ? 'Raising coverage will make trends more reliable.'
          : a.coveragePct < 70
            ? 'Solid coverage — keep tagging moods when you capture moments.'
            : 'Strong coverage — your emotion charts reflect most of your journal.')
    );
    const dom = a.dominant;
    if (dom != null) {
      const opt = moodOption(dom.id);
      lines.push(
        `Most common tone: ${opt?.emoji ?? ''} ${opt?.label ?? dom.id} (${dom.n} memories). ` +
          `That often reflects what you’re drawn to record or the season you’re in — not a judgment of “how you should feel.”`
      );
    }
    if (a.avgValence != null) {
      lines.push(
        `Average valence across tagged memories is ${a.avgValence.toFixed(2)} on a scale from −2 (distraught) to +2 (radiant). ` +
          `That reads as “${a.balanceLabel}.” Valence is a simple numeric summary — your full story is always richer than one number.`
      );
    }
    lines.push(
      `Among tagged entries, about ${a.posShare}% feel broadly positive (radiant + content), ${a.neuShare}% neutral, and ${a.negShare}% difficult (concerned + distraught). ` +
        `Many people see both highs and lows in the same month — that mix is normal.`
    );
    if (a.diversityPct != null && a.entropy != null) {
      lines.push(
        `Mood diversity is about ${a.diversityPct}% of the maximum for five categories (entropy ${a.entropy.toFixed(2)} bits). ` +
          (a.diversityPct > 70
            ? 'You’re using the full emotional range — great for spotting patterns.'
            : a.diversityPct > 40
              ? 'There’s a mix, with a few moods dominating — consider tagging more varied days to see shifts.'
              : 'A few moods dominate the log — that can mean a stable period or a habit of picking one label; both are valid.')
      );
    }
    if (a.monthsForDisplay.length >= 2) {
      const last = a.monthsForDisplay[a.monthsForDisplay.length - 1];
      const prev = a.monthsForDisplay[a.monthsForDisplay.length - 2];
      if (last && prev && last.count >= 2 && prev.count >= 2) {
        const delta = last.avgValence - prev.avgValence;
        if (Math.abs(delta) >= 0.15) {
          lines.push(
            `Recent months: from ${prev.label} (${prev.avgValence.toFixed(2)} avg valence) to ${last.label} (${last.avgValence.toFixed(2)}). ` +
              (delta > 0
                ? 'Average tone moved upward — worth a glance at what changed in life or journaling habits.'
                : 'Average tone moved downward — consider context (stress, sleep, season) and whether you want more support.')
          );
        }
      }
    }
    if (a.negativeTagged > a.positiveTagged && a.tagged >= 5) {
      lines.push(
        'Difficult moods are more frequent than upbeat ones in this dataset. If that matches how you feel in daily life, it may be worth checking in with someone you trust or a professional — journaling is a mirror, not a diagnosis.'
      );
    }
    return lines;
  }, [analysis]);

  return (
    <div className="space-y-4 py-2 font-mono text-[11px]">
      <div className="rounded-lg border border-border bg-surface-elevated/50 p-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">Emotion overview</h2>
        <p className="mt-2 font-body text-[10px] leading-relaxed text-text-muted">
          Moods are captured when you <em>create or edit</em> a memory. This tab summarizes how those labels distribute across your
          journal — valence, balance, diversity, and time patterns — for self-reflection only.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">Mood color legend</h3>
        <p className="mt-1 text-[9px] text-text-muted">Used in the Mood heatmap layer and mood visuals.</p>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {MEMORY_MOOD_OPTIONS.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2 rounded border border-border/70 bg-background/30 px-2 py-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: MOOD_COLOR_SWATCH[opt.id] }}
                aria-hidden
              />
              <span className="text-[10px] text-text-primary">
                {opt.emoji} {opt.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage */}
      <div className="rounded-lg border border-border bg-surface-elevated/50 p-3 text-center">
        <div className="text-text-muted text-[10px] uppercase tracking-wide">Mood coverage</div>
        <div className="mt-1 text-3xl font-bold text-accent tabular-nums">{analysis.coveragePct}%</div>
        <div className="text-[10px] text-text-muted">
          {analysis.tagged} tagged · {analysis.untagged} without mood · {analysis.total} total memories
        </div>
      </div>

      {analysis.tagged === 0 ? (
        <p className="rounded border border-border bg-surface-elevated/30 px-2 py-3 text-[10px] text-text-muted">
          No mood data yet. Edit a memory and choose one of the five mood buttons next to <strong>Group</strong>.
        </p>
      ) : (
        <>
          {/* Valence index */}
          <div className="rounded border border-border bg-surface-elevated/50 p-2">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Average valence</div>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <span className="text-2xl font-bold tabular-nums text-text-primary">
                {analysis.avgValence != null ? analysis.avgValence.toFixed(2) : '—'}
              </span>
              <span className="text-[10px] text-text-secondary">−2 … +2</span>
            </div>
            <div className="mt-1 text-[11px] text-accent">{analysis.balanceLabel}</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-gradient-to-r from-danger/70 via-text-muted/40 to-accent"
                style={{
                  width:
                    analysis.avgValence != null
                      ? `${Math.max(0, Math.min(100, ((analysis.avgValence + 2) / 4) * 100))}%`
                      : '50%',
                }}
              />
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-text-muted">
              Valence is a weighted average: distraught −2, concerned −1, neutral 0, content +1, radiant +2. It’s a rough wellbeing
              proxy for your journal, not a clinical score.
            </p>
          </div>

          {/* Positive / neutral / negative */}
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Emotional balance (tagged only)</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border border-accent/30 bg-accent/10 p-2 text-center">
              <div className="text-[9px] text-text-muted">Positive</div>
              <div className="text-lg font-semibold text-accent">{analysis.posShare}%</div>
              <div className="text-[9px] text-text-muted">radiant + content</div>
            </div>
            <div className="rounded border border-border bg-surface-elevated/50 p-2 text-center">
              <div className="text-[9px] text-text-muted">Neutral</div>
              <div className="text-lg font-semibold text-text-primary">{analysis.neuShare}%</div>
              <div className="text-[9px] text-text-muted">indifferent</div>
            </div>
            <div className="rounded border border-danger/30 bg-danger/10 p-2 text-center">
              <div className="text-[9px] text-text-muted">Difficult</div>
              <div className="text-lg font-semibold text-danger">{analysis.negShare}%</div>
              <div className="text-[9px] text-text-muted">concerned + distraught</div>
            </div>
          </div>

          {/* Diversity */}
          <div className="rounded border border-border bg-surface-elevated/50 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-text-muted">Mood diversity (entropy)</span>
              {analysis.diversityPct != null && analysis.entropy != null ? (
                <span className="text-text-primary tabular-nums">
                  {analysis.diversityPct}% · {analysis.entropy.toFixed(2)} bits
                </span>
              ) : (
                <span>—</span>
              )}
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-text-muted">
              Higher entropy means more even mixing across the five moods. Low entropy means one or two moods dominate — useful to
              notice, but not inherently “bad.”
            </p>
          </div>

          {/* Per-mood distribution */}
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Distribution by mood</div>
          <div className="space-y-2">
            {MEMORY_MOOD_OPTIONS.map((opt) => {
              const n = analysis.counts[opt.id];
              const pctBar = analysis.tagged > 0 ? (n / analysis.maxCount) * 100 : 0;
              return (
                <div key={opt.id} className="rounded border border-border bg-surface-elevated/50 p-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-text-primary">
                      <span className="mr-1" aria-hidden>
                        {opt.emoji}
                      </span>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {n} ({analysis.tagged > 0 ? Math.round((n / analysis.tagged) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="mt-1 h-4 overflow-hidden rounded bg-surface-elevated">
                    <div
                      className="h-full rounded bg-accent/55"
                      style={{ width: `${pctBar}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[9px] text-text-muted">{opt.description}</p>
                </div>
              );
            })}
          </div>

          {/* Monthly trend */}
          {analysis.monthsForDisplay.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wide text-text-muted">Recent months (tagged)</div>
              <p className="text-[9px] text-text-muted">
                Uses each memory’s <strong>date</strong> field. Avg valence is the mean of −2…+2 for that month.
              </p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-border bg-surface-elevated/30 p-1.5">
                {analysis.monthsForDisplay.map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-text-secondary">{row.label}</span>
                    <span className="text-text-muted">n={row.count}</span>
                    <span className="tabular-nums text-text-primary">{row.avgValence.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* By year */}
          {analysis.yearRows.length > 1 && (
            <>
              <div className="text-[10px] uppercase tracking-wide text-text-muted">By year</div>
              <div className="space-y-1">
                {analysis.yearRows.map((row) => (
                  <div key={row.year} className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary">{row.year}</span>
                    <span className="text-text-muted">{row.count} tagged</span>
                    <span className="tabular-nums text-text-primary">avg {row.avgValence.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Weekday */}
          {analysis.weekdayDisplay.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wide text-text-muted">By weekday (tagged)</div>
              <div className="space-y-1">
                {analysis.weekdayDisplay.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="w-8 text-text-secondary">{d.label}</span>
                    <div className="flex-1 rounded bg-surface-elevated">
                      <div
                        className="h-4 rounded bg-accent/50"
                        style={{ width: `${(d.count / analysis.weekdayMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-text-primary">{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* By group */}
          {analysis.groupRows.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wide text-text-muted">Average valence by group</div>
              <p className="text-[9px] text-text-muted">Groups with at least one tagged memory. Higher = brighter average mood.</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border bg-surface-elevated/30 p-1.5">
                {analysis.groupRows.map((g) => (
                  <div key={g.name} className="flex items-center justify-between text-[10px]">
                    <span className="min-w-0 truncate text-text-secondary" title={g.name}>
                      {g.name}
                    </span>
                    <span className="text-text-muted">{g.n} tagged</span>
                    <span className="tabular-nums text-accent">{g.avgValence.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Narrative */}
          <div className="rounded border border-border bg-surface-elevated/50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Reading your emotional landscape</div>
            <div className="mt-2 space-y-2 font-body text-[10px] leading-relaxed text-text-muted">
              {narrative.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          <div className="rounded border border-dashed border-border/80 bg-background/40 p-3 text-[9px] leading-relaxed text-text-muted">
            <strong className="text-text-secondary">Note:</strong> These analytics are for personal reflection. They don’t diagnose
            conditions. If you’re struggling, consider reaching out to a mental health professional.
          </div>
        </>
      )}
    </div>
  );
}
