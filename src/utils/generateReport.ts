import { jsPDF } from 'jspdf';
import type { Memory, Group } from '../types/memory';
import { isDueForReview } from './spacedRepetition';
import {
  svgOverviewBars,
  svgMemoriesPerYear,
  svgGroupsBars,
  svgRecallDonut,
  svgRecallByCycle,
} from './reportCharts';
import reportLogo from '../../_assets/TS_Logo.png';

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

type LoadImageMetaOptions = {
  makeLightBgTransparent?: boolean;
  trimTransparentPadding?: boolean;
};

async function loadImageMeta(
  url: string,
  options?: LoadImageMetaOptions
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);

      if (options?.makeLightBgTransparent) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          // Remove near-white matte backgrounds that create a visible rectangle in PDF.
          if (r > 240 && g > 240 && b > 240) {
            pixels[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }

      if (options?.trimTransparentPadding) {
        const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = source.data;
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const a = pixels[(y * canvas.width + x) * 4 + 3];
            if (a > 0) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX >= minX && maxY >= minY) {
          const trimmedW = maxX - minX + 1;
          const trimmedH = maxY - minY + 1;
          const trimmed = document.createElement('canvas');
          trimmed.width = trimmedW;
          trimmed.height = trimmedH;
          const tctx = trimmed.getContext('2d');
          if (!tctx) {
            reject(new Error('No canvas context'));
            return;
          }
          tctx.drawImage(canvas, minX, minY, trimmedW, trimmedH, 0, 0, trimmedW, trimmedH);
          resolve({
            dataUrl: trimmed.toDataURL('image/png'),
            width: trimmedW,
            height: trimmedH,
          });
          return;
        }
      }

      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export type ReportData = {
  memories: Memory[];
  groups: Group[];
  recallSessions: { remembered: number; forgot: number }[];
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
  const { memories, groups, recallSessions } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const lineHeight = 6;
  let y = margin;
  const toImage = options?.svgToImage;

  const now = Date.now();

  // —— Cover page (Apple-esque: clean, centered, minimal) ——
  doc.setFillColor(248, 248, 252);
  doc.rect(0, 0, pageW, pageH, 'F');
  try {
    const logo = await loadImageMeta(reportLogo, {
      makeLightBgTransparent: true,
      trimTransparentPadding: true,
    });
    const maxLogoW = pageW * 0.78;
    const maxLogoH = pageH * 0.24;
    const ratio = logo.width / logo.height;
    const logoW = Math.min(maxLogoW, maxLogoH * ratio);
    const logoH = logoW / ratio;
    const logoX = (pageW - logoW) / 2;
    const logoY = pageH * 0.2;
    doc.addImage(logo.dataUrl, 'PNG', logoX, logoY, logoW, logoH);
  } catch {
    // If logo fails to load, keep report generation resilient.
  }
  doc.setTextColor(100, 100, 110);
  doc.setFontSize(11);
  doc.text(
    `Generated on ${formatReportDateTime(new Date().toISOString())}`,
    pageW / 2,
    pageH * 0.64,
    { align: 'center' }
  );
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
  for (const m of memories) {
    const d = m.date.slice(0, 7);
    byMonth.set(d, (byMonth.get(d) ?? 0) + 1);
    const yr = parseInt(m.date.slice(0, 4), 10);
    byYear.set(yr, (byYear.get(yr) ?? 0) + 1);
  }
  const byYearSorted = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  const topMonths = [...byMonth.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

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
  y += SECTION_GAP_MM;

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
