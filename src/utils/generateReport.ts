import { jsPDF } from 'jspdf';
import type { Memory, Group } from '../types/memory';
import type { StudyCheckpointTag, StudyEvent } from '../types/study';
import { isDueForReview } from './spacedRepetition';
import { studyCheckpointLabel } from './studyLabels';
import {
  svgOverviewBars,
  svgMemoriesPerYear,
  svgGroupsBars,
  svgMoodDistribution,
  svgMoodValenceScale,
  svgRecallDonut,
  svgRecallByCycle,
} from './reportCharts';
import { MEMORY_MOOD_OPTIONS, MOOD_VALENCE, moodOption, parseMemoryMood } from './memoryMoods';
import { computeMoodReportSnapshot } from './moodReportStats';

function placeKey(lat: number, lng: number): string {
  return `${Math.round(lat * 10) / 10},${Math.round(lng * 10) / 10}`;
}

function formatReportDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatMonthKey(ym: string): string {
  const [y, m] = ym.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[parseInt(m || '1', 10) - 1] || m;
  return `${month} ${y}`;
}

/** Study / research snapshot for the PDF (optional). */
export type ReportStudySnapshot = {
  participantId: string | null;
  checkpointTag: StudyCheckpointTag | null;
  checkpointCompletedAt: Partial<Record<StudyCheckpointTag, string>>;
  checkpointCompletedByParticipant?: Record<string, Partial<Record<StudyCheckpointTag, string>>>;
  events: StudyEvent[];
};

export type ReportData = {
  memories: Memory[];
  groups: Group[];
  recallSessions: { remembered: number; forgot: number }[];
  study?: ReportStudySnapshot;
};

/** Scale factor for chart resolution (2 = sharp at PDF size). */
const CHART_DPI_SCALE = 2;

/** Convert SVG string to PNG data URL (must be called in browser). Renders at 2x for sharp PDF output. */
export function svgToPngDataUrl(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w * CHART_DPI_SCALE;
      canvas.height = h * CHART_DPI_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('No canvas context'));
        return;
      }
      ctx.scale(CHART_DPI_SCALE, CHART_DPI_SCALE);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG load failed'));
    };
    img.src = url;
  });
}

const CHART_WIDTH_MM = 170;
const SECTION_GAP_MM = 10;
const PAGE_BOTTOM_MARGIN_MM = 25;

export type GenerateReportOptions = {
  /** When provided, SVG charts are rendered to images and embedded in the PDF. */
  svgToImage?: (svg: string) => Promise<string>;
};

export async function generateReportPdf(
  data: ReportData,
  options?: GenerateReportOptions
): Promise<jsPDF> {
  const { memories, groups, recallSessions, study } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const lineHeight = 6;
  let y = margin;
  const toImage = options?.svgToImage;

  const drawSectionDivider = (gapAfterMm: number = 2) => {
    doc.setDrawColor(205, 210, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += gapAfterMm;
  };

  const now = Date.now();

  // —— Cover page (Apple-esque: clean, centered, minimal) ——
  doc.setFillColor(248, 248, 252);
  doc.rect(0, 0, pageW, pageH, 'F');
  // Cover title requested by spec (centered, big, bold).
  doc.setTextColor(30, 30, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  const titleX = pageW / 2;

  // Note: jsPDF built-in fonts can fail to render full-width glyphs.
  // Use ASCII title text for reliable rendering.
  doc.text('TEMPORAL', titleX, pageH * 0.44, { align: 'center' });
  doc.text('SELF', titleX, pageH * 0.54, { align: 'center' });

  doc.setTextColor(30, 30, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(
    'Mapping the geography of your mind: A longitudinal study on spatial memory.',
    pageW / 2,
    pageH * 0.64,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Temporal Self', pageW / 2, pageH * 0.70, { align: 'center' });
  doc.addPage();

  const totalMemories = memories.length;
  const places = new Set(memories.map((m) => placeKey(m.lat, m.lng))).size;
  const withImages = memories.filter((m) => m.imageDataUrl || (m.imageDataUrls?.length ?? 0) > 0).length;
  const starred = memories.filter((m) => m.starred).length;

  // —— Section: Overview ——
  y = margin;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 38);
  doc.text('Overview', margin, y);
  y += lineHeight * 2;

  if (toImage) {
    const overviewItems = [
      { label: 'Total memories', value: totalMemories },
      { label: 'Groups', value: groups.length },
      { label: 'Places', value: places },
      { label: 'With photos', value: withImages },
      { label: 'Starred', value: starred },
    ];
    const overviewSvg = svgOverviewBars(
      overviewItems,
      Math.max(1, ...overviewItems.map((i) => i.value))
    );
    const overviewImg = await toImage(overviewSvg);
    const overviewSvgW = 400;
    const overviewSvgH = 24 + overviewItems.length * 30 - 10 + 24;
    const overviewH = (CHART_WIDTH_MM * overviewSvgH) / overviewSvgW;
    doc.addImage(overviewImg, 'PNG', margin, y, CHART_WIDTH_MM, overviewH);
    y += overviewH + SECTION_GAP_MM;
  } else {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total memories: ${totalMemories}`, margin, y);
    y += lineHeight;
    doc.text(`Groups: ${groups.length}`, margin, y);
    y += lineHeight;
    doc.text(`Distinct places: ${places}`, margin, y);
    y += lineHeight;
    doc.text(`Memories with photos: ${withImages}`, margin, y);
    y += lineHeight;
    doc.text(`Starred (favorites): ${starred}`, margin, y);
    y += SECTION_GAP_MM;
  }

  // Section divider: Overview → Calendar
  drawSectionDivider(8);

  // —— Section: Calendar & date distribution ——
  if (y > pageH - PAGE_BOTTOM_MARGIN_MM - 80) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Calendar & date distribution', margin, y);
  y += lineHeight * 2;

  const byMonth = new Map<string, number>();
  const byYear = new Map<number, number>();
  const byDate = new Map<string, number>();
  for (const m of memories) {
    const d = m.date.slice(0, 7);
    byMonth.set(d, (byMonth.get(d) ?? 0) + 1);
    const yr = parseInt(m.date.slice(0, 4), 10);
    byYear.set(yr, (byYear.get(yr) ?? 0) + 1);
    const fullDate = m.date.slice(0, 10);
    byDate.set(fullDate, (byDate.get(fullDate) ?? 0) + 1);
  }
  const byYearSorted = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  const topMonths = [...byMonth.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topDatesByCount = [...byDate.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 50);

  if (toImage && byYearSorted.length > 0) {
    const yearSvg = svgMemoriesPerYear(byYearSorted);
    const yearImg = await toImage(yearSvg);
    const yearH = (CHART_WIDTH_MM * 200) / 400;
    doc.addImage(yearImg, 'PNG', margin, y, CHART_WIDTH_MM, yearH);
    y += yearH + lineHeight;
  }

  if (byYearSorted.length > 0 && !toImage) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Memories per year', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    for (const [year, count] of byYearSorted) {
      doc.text(`${year}: ${count}`, margin, y);
      y += lineHeight;
    }
    y += lineHeight;
  }
  if (topMonths.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Top months (by memory count)', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    for (const [ym, count] of topMonths) {
      doc.text(`${formatMonthKey(ym)}: ${count}`, margin, y);
      y += lineHeight;
    }
  }

  if (topDatesByCount.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Date-wise memories (top by count)', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    for (const [date, count] of topDatesByCount) {
      doc.text(`${date}: ${count}`, margin, y);
      y += lineHeight;
    }
  }
  y += SECTION_GAP_MM;

  // Section divider: Calendar → Groups
  drawSectionDivider(8);

  // —— Section: Groups ——
  if (y > pageH - PAGE_BOTTOM_MARGIN_MM - 60) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Groups', margin, y);
  y += lineHeight * 2;

  const ungroupedId = '__ungrouped__';
  const groupCounts = new Map<string, number>();
  for (const m of memories) {
    const gid = m.groupId ?? null;
    const key = gid ?? ungroupedId;
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  }
  const groupsWithCounts = [
    ...groups.map((g) => ({ name: g.name, count: groupCounts.get(g.id) ?? 0 })),
    { name: 'Ungrouped', count: groupCounts.get(ungroupedId) ?? 0 },
  ];
  const maxGroupCount = Math.max(1, ...groupsWithCounts.map((g) => g.count));

  if (toImage && groupsWithCounts.length > 0) {
    const groupsSvg = svgGroupsBars(groupsWithCounts, maxGroupCount);
    const groupsImg = await toImage(groupsSvg);
    const groupsSvgH = 24 + groupsWithCounts.length * (22 + 6) - 6 + 24;
    const groupsH = (CHART_WIDTH_MM * groupsSvgH) / 400;
    doc.addImage(groupsImg, 'PNG', margin, y, CHART_WIDTH_MM, groupsH);
    y += groupsH + SECTION_GAP_MM;
  } else {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    for (const g of groups) {
      const count = groupCounts.get(g.id) ?? 0;
      doc.text(`${g.name}: ${count} memories`, margin, y);
      y += lineHeight;
    }
    const ungroupedCount = groupCounts.get(ungroupedId) ?? 0;
    doc.text(`Ungrouped: ${ungroupedCount} memories`, margin, y);
    y += SECTION_GAP_MM;
  }

  // Section divider: Groups → Mood
  drawSectionDivider(8);

  // —— Section: Mood & emotion ——
  if (y > pageH - PAGE_BOTTOM_MARGIN_MM - 100) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 38);
  doc.text('Mood & emotion', margin, y);
  y += lineHeight * 2;

  const moodSnap = computeMoodReportSnapshot(memories);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Coverage: ${moodSnap.tagged} of ${moodSnap.total} memories have a mood (${moodSnap.coveragePct}%).`,
    margin,
    y
  );
  y += lineHeight;
  doc.text(`Untagged (no mood): ${moodSnap.total - moodSnap.tagged}`, margin, y);
  y += lineHeight;

  if (moodSnap.tagged === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text(
      'No mood labels yet. Tag moods in the memory editor (next to Group) to include distribution and valence in future reports.',
      margin,
      y,
      { maxWidth: pageW - margin * 2 }
    );
    y += lineHeight * 2;
    doc.setFont('helvetica', 'normal');
    y += SECTION_GAP_MM;
  } else {
    const withMood = memories.filter((m) => parseMemoryMood(m.mood) != null);
    const positiveTaggedCount = moodSnap.counts.radiant + moodSnap.counts.content;
    const negativeTaggedCount = moodSnap.counts.concerned + moodSnap.counts.distraught;

    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

    const byMonth = new Map<string, { n: number; valenceSum: number }>();
    const byYear = new Map<number, { n: number; valenceSum: number }>();
    const byWeekday = new Map<number, number>();

    for (const m of withMood) {
      const d = (m.date ?? '').slice(0, 10);
      if (!d) continue;
      const ym = d.slice(0, 7);
      const yNum = parseInt(d.slice(0, 4), 10);
      const id = parseMemoryMood(m.mood);
      if (!id) continue;
      const v = MOOD_VALENCE[id];

      const curM = byMonth.get(ym) ?? { n: 0, valenceSum: 0 };
      curM.n += 1;
      curM.valenceSum += v;
      byMonth.set(ym, curM);

      const curY = byYear.get(yNum) ?? { n: 0, valenceSum: 0 };
      curY.n += 1;
      curY.valenceSum += v;
      byYear.set(yNum, curY);

      try {
        const dt = new Date(d + 'T12:00:00');
        const wd = dt.getDay();
        byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1);
      } catch {
        /* ignore */
      }
    }

    const monthKeys = [...byMonth.keys()].sort().slice(-10);
    const monthsForDisplay = monthKeys.map((k) => {
      const row = byMonth.get(k)!;
      return {
        key: k,
        label: formatMonthKey(k),
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
    })).filter((d) => d.count > 0);

    // By group: average valence where at least 1 tagged memory in group
    const groupById = new Map(groups.map((g) => [g.id, g.name]));
    const groupAgg = new Map<string, { n: number; valenceSum: number }>();
    for (const m of withMood) {
      const gid = m.groupId ?? null;
      if (!gid) continue;
      const id = parseMemoryMood(m.mood);
      if (!id) continue;
      const v = MOOD_VALENCE[id];
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

    const narrativeLines: string[] = [];
    if (moodSnap.total === 0) {
      narrativeLines.push('Add memories with moods in the editor to unlock emotional analytics.');
    } else if (moodSnap.tagged === 0) {
      narrativeLines.push(
        `None of your ${moodSnap.total} memories have a mood yet. Open the editor when adding or editing a memory and tap a mood emoji under “Mood”.`
      );
    } else {
      narrativeLines.push(
        `You’ve logged a mood on ${moodSnap.tagged} of ${moodSnap.total} memories (${moodSnap.coveragePct}% coverage). ` +
          (moodSnap.coveragePct < 40
            ? 'Raising coverage will make trends more reliable.'
            : moodSnap.coveragePct < 70
              ? 'Solid coverage — keep tagging moods when you capture moments.'
              : 'Strong coverage — your emotion charts reflect most of your journal.')
      );

      if (moodSnap.dominant) {
        const opt = moodOption(moodSnap.dominant.id);
        narrativeLines.push(
          `Most common tone: ${opt?.label ?? moodSnap.dominant.id} (${moodSnap.dominant.n} memories). ` +
            'That often reflects what you’re drawn to record or the season you’re in — not a judgment of “how you should feel.”'
        );
      }

      if (moodSnap.avgValence != null) {
        narrativeLines.push(
          `Average valence across tagged memories is ${moodSnap.avgValence.toFixed(
            2
          )} on a scale from −2 (distraught) to +2 (radiant). That reads as “${moodSnap.balanceLabel}.”`
        );
      }

      narrativeLines.push(
        `Among tagged entries, about ${moodSnap.posShare}% feel broadly positive (radiant + content), ${moodSnap.neuShare}% neutral, and ${moodSnap.negShare}% difficult (concerned + distraught).`
      );

      if (moodSnap.diversityPct != null && moodSnap.entropyBits != null) {
        narrativeLines.push(
          `Mood diversity is about ${moodSnap.diversityPct}% of the maximum for five categories (entropy ${moodSnap.entropyBits.toFixed(
            2
          )} bits). ${
            moodSnap.diversityPct > 70
              ? 'You’re using the full emotional range — great for spotting patterns.'
              : moodSnap.diversityPct > 40
                ? 'There’s a mix, with a few moods dominating — consider tagging more varied days to see shifts.'
                : 'A few moods dominate the log — that can mean a stable period or a habit of picking one label; both are valid.'
          }`
        );
      }

      if (monthsForDisplay.length >= 2) {
        const last = monthsForDisplay[monthsForDisplay.length - 1];
        const prev = monthsForDisplay[monthsForDisplay.length - 2];
        if (last && prev && last.count >= 2 && prev.count >= 2) {
          const delta = last.avgValence - prev.avgValence;
          if (Math.abs(delta) >= 0.15) {
            narrativeLines.push(
              `Recent months: from ${prev.label} (${prev.avgValence.toFixed(
                2
              )} avg valence) to ${last.label} (${last.avgValence.toFixed(2)}). ${
                delta > 0
                  ? 'Average tone moved upward — worth a glance at what changed in life or journaling habits.'
                  : 'Average tone moved downward — consider context (stress, sleep, season) and whether you want more support.'
              }`
            );
          }
        }
      }

      if (negativeTaggedCount > positiveTaggedCount && moodSnap.tagged >= 5) {
        narrativeLines.push(
          'Difficult moods are more frequent than upbeat ones in this dataset. If that matches how you feel in daily life, it may be worth checking in with someone you trust or a professional.'
        );
      }
    }

    const sanitizePdfText = (s: string) => {
      // jsPDF default core fonts don't support emoji/unicode punctuation reliably.
      // Normalize to ASCII-ish output to avoid garbled characters.
      return s
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '') // emoji blocks
        .replace(/[\u{2600}-\u{27BF}]/gu, '') // miscellaneous symbols
        .replace(/−/g, '-') // unicode minus
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[—–]/g, '-')
        .replace(/…/g, '...')
        .replace(/[^\x00-\x7E]/g, ''); // strip remaining non-ascii
    };

    const writeWrapped = (text: string) => {
      const cleaned = sanitizePdfText(text);
      const wrapped = doc.splitTextToSize(cleaned, pageW - margin * 2);
      for (const line of wrapped as string[]) {
        doc.text(line, margin, y);
        y += lineHeight;
      }
    };

    if (toImage) {
      const moodItems = MEMORY_MOOD_OPTIONS.map((o) => ({
        label: o.label,
        count: moodSnap.counts[o.id],
        pct: Math.round((moodSnap.counts[o.id] / moodSnap.tagged) * 100),
      }));
      const moodSvg = svgMoodDistribution(moodItems, moodSnap.maxCount);
      const moodImg = await toImage(moodSvg);
      const moodSvgH = 24 + moodItems.length * 28 - 8 + 24;
      const moodH = (CHART_WIDTH_MM * moodSvgH) / 400;
      if (y > pageH - PAGE_BOTTOM_MARGIN_MM - moodH - 30) {
        doc.addPage();
        y = margin;
      }
      doc.addImage(moodImg, 'PNG', margin, y, CHART_WIDTH_MM, moodH);
      y += moodH + lineHeight;

      if (moodSnap.avgValence != null) {
        const valSvg = svgMoodValenceScale(moodSnap.avgValence);
        const valImg = await toImage(valSvg);
        const valH = (CHART_WIDTH_MM * 56) / 400;
        if (y > pageH - PAGE_BOTTOM_MARGIN_MM - valH - 24) {
          doc.addPage();
          y = margin;
        }
        doc.addImage(valImg, 'PNG', margin, y, CHART_WIDTH_MM, valH);
        y += valH + lineHeight;
      }
    } else {
      for (const o of MEMORY_MOOD_OPTIONS) {
        const c = moodSnap.counts[o.id];
        const pct = Math.round((c / moodSnap.tagged) * 100);
        doc.text(`${o.label}: ${c} (${pct}%)`, margin, y);
        y += lineHeight;
      }
      y += lineHeight;
    }

    doc.text(`Average valence: ${moodSnap.avgValence?.toFixed(2) ?? '—'} (scale -2 to +2)`, margin, y);
    y += lineHeight;
    doc.text(`Summary: ${moodSnap.balanceLabel}`, margin, y);
    y += lineHeight;
    doc.text(`Positive (radiant + content): ${moodSnap.posShare}%`, margin, y);
    y += lineHeight;
    doc.text(`Neutral: ${moodSnap.neuShare}%`, margin, y);
    y += lineHeight;
    doc.text(`Difficult (concerned + distraught): ${moodSnap.negShare}%`, margin, y);
    y += lineHeight;
    if (moodSnap.entropyBits != null && moodSnap.diversityPct != null) {
      doc.text(
        `Mood diversity (entropy): ${moodSnap.entropyBits.toFixed(2)} bits (${moodSnap.diversityPct}% of maximum spread)`,
        margin,
        y
      );
      y += lineHeight;
    }
    if (moodSnap.dominant) {
      doc.text(
        `Most common mood: ${moodSnap.dominant.label} (${moodSnap.dominant.n} memories)`,
        margin,
        y
      );
      y += lineHeight;
    }

    // Distribution by mood (with descriptions) + time patterns (matches Mood tab detail).
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Distribution by mood (tagged)', margin, y);
    y += lineHeight * 0.9;
    doc.setFont('helvetica', 'normal');
    for (const o of MEMORY_MOOD_OPTIONS) {
      const c = moodSnap.counts[o.id];
      const pct = Math.round((c / moodSnap.tagged) * 100);
      const line = `${o.label}: ${c} (${pct}%) — ${o.description}`;
      writeWrapped(line);
    }

    if (monthsForDisplay.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Recent months (tagged)', margin, y);
      y += lineHeight * 0.9;
      doc.setFont('helvetica', 'normal');
      for (const row of monthsForDisplay) {
        doc.text(
          `${row.label}: n=${row.count}, avg valence=${row.avgValence.toFixed(2)}`,
          margin,
          y
        );
        y += lineHeight;
      }
    }

    if (yearRows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('By year (tagged)', margin, y);
      y += lineHeight * 0.9;
      doc.setFont('helvetica', 'normal');
      for (const row of yearRows) {
        doc.text(
          `${row.year}: n=${row.count}, avg valence=${row.avgValence.toFixed(2)}`,
          margin,
          y
        );
        y += lineHeight;
      }
    }

    if (weekdayDisplay.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('By weekday (tagged)', margin, y);
      y += lineHeight * 0.9;
      doc.setFont('helvetica', 'normal');
      for (const d of weekdayDisplay) {
        doc.text(`${d.label}: ${d.count}`, margin, y);
        y += lineHeight;
      }
    }

    if (groupRows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Average valence by group', margin, y);
      y += lineHeight * 0.9;
      doc.setFont('helvetica', 'normal');
      for (const g of groupRows) {
        writeWrapped(`${g.name}: ${g.n} tagged, avg valence=${g.avgValence.toFixed(2)}`);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Reading your emotional landscape', margin, y);
    y += lineHeight * 0.9;
    doc.setFont('helvetica', 'normal');
    for (const line of narrativeLines) {
      writeWrapped(line);
    }
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 110);
    const moodDisclaimer = doc.splitTextToSize(
      'Mood analytics are for personal reflection only; they do not diagnose medical or mental health conditions.',
      pageW - margin * 2
    );
    doc.text(moodDisclaimer, margin, y);
    y += lineHeight * (moodDisclaimer.length || 1);
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 38);
    y += SECTION_GAP_MM;
  }

  // Section divider: Mood → Study
  drawSectionDivider(8);

  // —— Section: Study ——
  if (study) {
    const cpOrder: StudyCheckpointTag[] = ['baseline', '2d', '14d', '40d'];
    const byParticipant = study.checkpointCompletedByParticipant ?? {};

    const participants = Object.keys(byParticipant)
      .filter((pid) => {
        const row = byParticipant[pid];
        return !!row && cpOrder.some((tag) => !!row[tag]);
      })
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    // Fallback: if the map is empty (older snapshots), at least include the current participant's row.
    const fallbackPid = study.participantId?.trim() ?? '';
    const tablePids = participants.length > 0 ? participants : fallbackPid ? [fallbackPid] : [];

    if (tablePids.length === 0) {
      // No study completion data to show.
      // Keep y as-is and skip the study table.
      y += SECTION_GAP_MM;
      // Skip rendering.
    }

    // Heading above the table (requested).
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 38);
    doc.text('Study', margin, y);
    y += lineHeight * 1.8;

    // Match the Study header from the UI.
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const eventCount = Array.isArray(study.events) ? study.events.length : 0;
    doc.text(`Study events: ${eventCount}`, margin, y);
    y += lineHeight;
    doc.text(
      `Active: ${study.participantId?.trim() ? study.participantId : '—'} · checkpoint: ${study.checkpointTag ?? '—'}`,
      margin,
      y
    );
    y += lineHeight;

    const tableX = margin;
    const tableW = pageW - margin * 2;

    const colPidW = Math.min(42, tableW * 0.28);
    const colW = (tableW - colPidW) / 4;

    const headers = ['Participant ID', ...cpOrder.map((t) => studyCheckpointLabel(t))];

    const tableLineHeight = 4.5; // smaller than page body text
    const cellVPad = 1.1;

    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.15);

    const renderHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);

      const headerH = tableLineHeight + cellVPad * 2;
      // If header doesn't fit, start a new page.
      if (y > pageH - PAGE_BOTTOM_MARGIN_MM - headerH) {
        doc.addPage();
        y = margin;
      }

      const x0 = tableX;
      const y0 = y;
      const colXs = [x0, x0 + colPidW, x0 + colPidW + colW, x0 + colPidW + colW * 2, x0 + colPidW + colW * 3];
      const colWidths = [colPidW, colW, colW, colW, colW];

      for (let col = 0; col < headers.length; col++) {
        doc.rect(colXs[col], y0, colWidths[col], headerH);
        const label = headers[col];
        doc.text(label, colXs[col] + 1.0, y0 + cellVPad + tableLineHeight * 0.82, {
          baseline: 'alphabetic',
        });
      }
      y += headerH;
    };

    const renderRow = (pid: string) => {
      const rowMap = byParticipant[pid] ?? (pid === fallbackPid ? study.checkpointCompletedAt : {});
      const rawCells = [pid, ...cpOrder.map((tag) => rowMap?.[tag] ? formatReportDateTime(rowMap[tag] as string) : '—')];
      const colXs = [tableX, tableX + colPidW, tableX + colPidW + colW, tableX + colPidW + colW * 2, tableX + colPidW + colW * 3];
      const colWidths = [colPidW, colW, colW, colW, colW];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const wrappedLines = rawCells.map((txt, colIdx) => {
        const maxWidth = colWidths[colIdx] - 2.0;
        return doc.splitTextToSize(String(txt ?? ''), maxWidth);
      });
      const maxLines = Math.max(...wrappedLines.map((ls) => ls.length));
      const rowH = tableLineHeight * maxLines + cellVPad * 2;

      if (y > pageH - PAGE_BOTTOM_MARGIN_MM - rowH) {
        doc.addPage();
        y = margin;
        renderHeader();
      }

      for (let col = 0; col < rawCells.length; col++) {
        doc.rect(colXs[col], y, colWidths[col], rowH);
        const lines = wrappedLines[col];
        for (let i = 0; i < lines.length; i++) {
          const lineY = y + cellVPad + tableLineHeight * (0.82 + i);
          doc.text(lines[i], colXs[col] + 1.0, lineY, { baseline: 'alphabetic' });
        }
      }
      y += rowH;
    };

    // Render table only (header + rows).
    if (tablePids.length > 0) {
      renderHeader();
      for (const pid of tablePids) {
        renderRow(pid);
      }
      y += SECTION_GAP_MM;
    }
  }

  // Section divider: Study → Recall
  drawSectionDivider(8);

  // —— Section: Recall & practice stats ——
  if (y > pageH - PAGE_BOTTOM_MARGIN_MM - 100) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Recall & practice stats', margin, y);
  y += lineHeight * 2;

  const remembered = memories.reduce((sum, m) => sum + (m.reviewCount ?? 0), 0);
  const forgot = memories.reduce((sum, m) => sum + (m.failedReviewCount ?? 0), 0);
  const totalRecallAttempts = remembered + forgot;
  const successRate =
    totalRecallAttempts > 0 ? Math.round((remembered / totalRecallAttempts) * 100) : null;
  const dueNow = memories.filter(isDueForReview).length;
  const scheduledLater = memories.filter((m) => {
    if (m.nextReviewAt == null || m.nextReviewAt === '') return false;
    try {
      return new Date(m.nextReviewAt).getTime() > now;
    } catch {
      return false;
    }
  }).length;
  const neverAttempted = memories.filter(
    (m) => (m.reviewCount ?? 0) === 0 && (m.failedReviewCount ?? 0) === 0
  ).length;
  const attemptedAtLeastOnce = memories.length - neverAttempted;
  const struggledAtLeastOnce = memories.filter((m) => (m.failedReviewCount ?? 0) > 0).length;

  if (toImage && (remembered > 0 || forgot > 0)) {
    const donutSvg = svgRecallDonut(remembered, forgot);
    const donutImg = await toImage(donutSvg);
    const donutH = (CHART_WIDTH_MM * 220) / 400;
    doc.addImage(donutImg, 'PNG', margin, y, CHART_WIDTH_MM, donutH);
    y += donutH + lineHeight;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Recall score (out of 100): ${successRate !== null ? successRate : '—'}`, margin, y);
  y += lineHeight;
  doc.text(`Total "I remember" answers: ${remembered}`, margin, y);
  y += lineHeight;
  doc.text(`Total "Show me" (hints): ${forgot}`, margin, y);
  y += lineHeight;
  doc.text(`Due for recall now: ${dueNow}`, margin, y);
  y += lineHeight;
  doc.text(`Scheduled for later: ${scheduledLater}`, margin, y);
  y += lineHeight;
  doc.text(`Never attempted (recall): ${neverAttempted}`, margin, y);
  y += lineHeight;
  doc.text(`Practiced at least once: ${attemptedAtLeastOnce} of ${memories.length}`, margin, y);
  y += lineHeight;
  doc.text(`Struggled at least once: ${struggledAtLeastOnce}`, margin, y);
  y += SECTION_GAP_MM;

  if (recallSessions.length > 0) {
    if (toImage) {
      if (y > pageH - PAGE_BOTTOM_MARGIN_MM - 70) {
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.text('By recall cycle', margin, y);
      y += lineHeight * 2;
      const cycleSvg = svgRecallByCycle(recallSessions);
      const cycleImg = await toImage(cycleSvg);
      const cycleH = (CHART_WIDTH_MM * 200) / 400;
      doc.addImage(cycleImg, 'PNG', margin, y, CHART_WIDTH_MM, cycleH);
      y += cycleH + SECTION_GAP_MM;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.text('By recall cycle', margin, y);
      y += lineHeight;
      doc.setFont('helvetica', 'normal');
      const ordinal = (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
      };
      for (let i = 0; i < recallSessions.length; i++) {
        const s = recallSessions[i];
        doc.text(
          `${ordinal(i + 1)} cycle: ${s.remembered} remembered, ${s.forgot} show me`,
          margin,
          y
        );
        y += lineHeight;
      }
    }
  }

  return doc;
}

export function reportFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `temporal-self-report-${date}_${time}.pdf`;
}
