/**
 * SVG chart generators for the PDF report. Each returns an SVG string with viewBox for scaling.
 */

const W = 400;
const H = 200;
const PAD = 24;
const FONT = '14px system-ui, -apple-system, sans-serif';
const AXIS_COLOR = '#94a3b8';
const BAR_ACCENT = '#6366f1';
const BAR_SECONDARY = '#818cf8';
const BAR_DANGER = '#f43f5e';
const TEXT_COLOR = '#334155';

/** Horizontal bar chart: label + bar (0–max scale). */
export function svgOverviewBars(
  items: { label: string; value: number }[],
  maxVal: number
): string {
  const barH = 20;
  const gap = 10;
  const chartH = items.length * (barH + gap) - gap;
  const chartW = W - PAD * 2;
  const maxBarW = Math.max(1, chartW - 70);

  const bars = items
    .map((item, i) => {
      const y = PAD + i * (barH + gap);
      const w = maxVal > 0 ? (item.value / maxVal) * maxBarW : 0;
      return `
        <text x="${PAD}" y="${y + barH / 2 + 4}" fill="${TEXT_COLOR}" font="${FONT}">${escapeXml(item.label)}</text>
        <rect x="${PAD + 72}" y="${y}" width="${maxBarW}" height="${barH}" fill="#e2e8f0" rx="4"/>
        <rect x="${PAD + 72}" y="${y}" width="${w}" height="${barH}" fill="${BAR_ACCENT}" rx="4"/>
        <text x="${PAD + 72 + maxBarW + 6}" y="${y + barH / 2 + 4}" fill="${TEXT_COLOR}" font="${FONT}" text-anchor="end">${item.value}</text>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${PAD + chartH + PAD}" width="${W}" height="${PAD + chartH + PAD}">
  ${bars}
</svg>`;
}

/** Vertical bar chart for memories per year. */
export function svgMemoriesPerYear(byYear: [number, number][]): string {
  if (byYear.length === 0) return svgPlaceholder('No year data');
  const chartW = W - PAD * 2;
  const chartH = H - PAD - 30;
  const maxVal = Math.max(1, ...byYear.map(([, c]) => c));
  const barGap = 6;
  const barW = (chartW - barGap * (byYear.length - 1)) / byYear.length;
  const barWUse = Math.min(barW, 28);

  const bars = byYear
    .map(([year, count], i) => {
      const x = PAD + i * (barWUse + barGap);
      const barHeight = (count / maxVal) * chartH;
      const y = PAD + chartH - barHeight;
      return `
        <rect x="${x}" y="${y}" width="${barWUse}" height="${barHeight}" fill="${BAR_ACCENT}" rx="4"/>
        <text x="${x + barWUse / 2}" y="${PAD + chartH + 18}" fill="${TEXT_COLOR}" font="12px system-ui" text-anchor="middle">${year}</text>
        <text x="${x + barWUse / 2}" y="${y - 6}" fill="${TEXT_COLOR}" font="11px system-ui" text-anchor="middle">${count}</text>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${PAD + chartH}" stroke="${AXIS_COLOR}" stroke-width="1"/>
  <line x1="${PAD}" y1="${PAD + chartH}" x2="${PAD + chartW}" y2="${PAD + chartH}" stroke="${AXIS_COLOR}" stroke-width="1"/>
  ${bars}
</svg>`;
}

/** Horizontal bar chart for group memory counts. */
export function svgGroupsBars(
  groups: { name: string; count: number }[],
  maxCount: number
): string {
  if (groups.length === 0) return svgPlaceholder('No groups');
  const barH = 22;
  const gap = 6;
  const chartW = W - PAD * 2;
  const maxBarW = Math.max(1, chartW - 90);

  const bars = groups
    .map((item, i) => {
      const y = PAD + i * (barH + gap);
      const w = maxCount > 0 ? (item.count / maxCount) * maxBarW : 0;
      const label = item.name.length > 18 ? item.name.slice(0, 16) + '…' : item.name;
      return `
        <text x="${PAD}" y="${y + barH / 2 + 4}" fill="${TEXT_COLOR}" font="12px system-ui">${escapeXml(label)}</text>
        <rect x="${PAD + 92}" y="${y}" width="${maxBarW}" height="${barH}" fill="#e2e8f0" rx="4"/>
        <rect x="${PAD + 92}" y="${y}" width="${w}" height="${barH}" fill="${BAR_SECONDARY}" rx="4"/>
        <text x="${PAD + 92 + maxBarW + 6}" y="${y + barH / 2 + 4}" fill="${TEXT_COLOR}" font="12px system-ui" text-anchor="end">${item.count}</text>
      `;
    })
    .join('');

  const totalH = PAD + groups.length * (barH + gap) - gap + PAD;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${totalH}" width="${W}" height="${totalH}">
  ${bars}
</svg>`;
}

/** Donut chart for recall: remembered vs forgot. */
export function svgRecallDonut(remembered: number, forgot: number): string {
  const cx = W / 2;
  const cy = 100;
  const r = 70;
  const total = remembered + forgot;
  if (total === 0) return svgPlaceholder('No recall data yet');

  const circ = 2 * Math.PI * r;
  const rememberedPct = remembered / total;
  const forgotPct = forgot / total;
  const lenRem = circ * rememberedPct;
  const lenForgot = circ * forgotPct;
  const dashOffset = -Math.PI * r; // start from top

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 220" width="${W}" height="220">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="24"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BAR_ACCENT}" stroke-width="24" stroke-dasharray="${lenRem} ${lenForgot}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 ${cx} ${cy})"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BAR_DANGER}" stroke-width="24" stroke-dasharray="0 ${lenRem} ${lenForgot}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 ${cx} ${cy})"/>
  <text x="${cx}" y="${cy - 6}" fill="${TEXT_COLOR}" font="bold 20px system-ui" text-anchor="middle">${total}</text>
  <text x="${cx}" y="${cy + 14}" fill="#64748b" font="11px system-ui" text-anchor="middle">total</text>
  <text x="${cx - 50}" y="${cy + r + 32}" fill="${BAR_ACCENT}" font="11px system-ui" text-anchor="middle">Remembered ${remembered}</text>
  <text x="${cx + 50}" y="${cy + r + 32}" fill="${BAR_DANGER}" font="11px system-ui" text-anchor="middle">Show me ${forgot}</text>
</svg>`;
}

/** Mood distribution: horizontal bars (labels ASCII; no emoji for PDF font safety). */
export function svgMoodDistribution(
  items: { label: string; count: number; pct: number }[],
  maxCount: number
): string {
  if (items.length === 0) return svgPlaceholder('No mood data');
  const barH = 20;
  const gap = 8;
  const chartH = items.length * (barH + gap) - gap;
  const chartW = W - PAD * 2;
  const maxBarW = Math.max(1, chartW - 100);

  const bars = items
    .map((item, i) => {
      const y = PAD + i * (barH + gap);
      const w = maxCount > 0 ? (item.count / maxCount) * maxBarW : 0;
      const label = item.label.length > 14 ? item.label.slice(0, 12) + '…' : item.label;
      return `
        <text x="${PAD}" y="${y + barH / 2 + 4}" fill="${TEXT_COLOR}" font="${FONT}">${escapeXml(label)}</text>
        <rect x="${PAD + 78}" y="${y}" width="${maxBarW}" height="${barH}" fill="#e2e8f0" rx="4"/>
        <rect x="${PAD + 78}" y="${y}" width="${w}" height="${barH}" fill="${BAR_ACCENT}" rx="4"/>
        <text x="${PAD + 78 + maxBarW + 4}" y="${y + barH / 2 + 4}" fill="${TEXT_COLOR}" font="12px system-ui" text-anchor="end">${item.count} (${item.pct}%)</text>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${PAD + chartH + PAD}" width="${W}" height="${PAD + chartH + PAD}">
  ${bars}
</svg>`;
}

/** Valence scale −2 … +2 with marker for average (for tagged memories). */
export function svgMoodValenceScale(avgValence: number): string {
  const chartH = 56;
  const lineY = 36;
  const lineX0 = PAD;
  const lineX1 = W - PAD;
  const lineW = lineX1 - lineX0;
  const t = (avgValence + 2) / 4;
  const cx = lineX0 + Math.max(0, Math.min(1, t)) * lineW;

  const labels = ['-2', '-1', '0', '+1', '+2'];
  const tickXs = [0, 0.25, 0.5, 0.75, 1].map((p) => lineX0 + p * lineW);

  const ticks = tickXs
    .map((x, i) => {
      return `
        <line x1="${x}" y1="${lineY - 4}" x2="${x}" y2="${lineY + 4}" stroke="${AXIS_COLOR}" stroke-width="1"/>
        <text x="${x}" y="${lineY + 18}" fill="#64748b" font="10px system-ui" text-anchor="middle">${labels[i]}</text>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${chartH}" width="${W}" height="${chartH}">
  <text x="${PAD}" y="16" fill="${TEXT_COLOR}" font="12px system-ui">Average valence (${avgValence.toFixed(2)})</text>
  <line x1="${lineX0}" y1="${lineY}" x2="${lineX1}" y2="${lineY}" stroke="${AXIS_COLOR}" stroke-width="2"/>
  ${ticks}
  <circle cx="${cx}" cy="${lineY}" r="7" fill="${BAR_ACCENT}" stroke="#fff" stroke-width="2"/>
</svg>`;
}

/** Stacked bar chart: each cycle = one bar (remembered + forgot). */
export function svgRecallByCycle(sessions: { remembered: number; forgot: number }[]): string {
  if (sessions.length === 0) return svgPlaceholder('No recall cycles yet');
  const chartW = W - PAD * 2;
  const chartH = 140;
  const maxTotal = Math.max(1, ...sessions.map((s) => s.remembered + s.forgot));
  const barW = Math.min(24, (chartW - 8 * (sessions.length - 1)) / sessions.length);
  const gap = 8;

  const bars = sessions
    .map((s, i) => {
      const x = PAD + i * (barW + gap);
      const hRem = (s.remembered / maxTotal) * chartH;
      const hForgot = (s.forgot / maxTotal) * chartH;
      const yForgot = PAD + chartH - hForgot - hRem;
      const yRem = PAD + chartH - hRem;
      return `
        <rect x="${x}" y="${yForgot}" width="${barW}" height="${hForgot}" fill="${BAR_DANGER}" rx="2"/>
        <rect x="${x}" y="${yRem}" width="${barW}" height="${hRem}" fill="${BAR_ACCENT}" rx="2"/>
        <text x="${x + barW / 2}" y="${PAD + chartH + 16}" fill="${TEXT_COLOR}" font="11px system-ui" text-anchor="middle">${i + 1}</text>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 200" width="${W}" height="200">
  <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${PAD + chartH}" stroke="${AXIS_COLOR}" stroke-width="1"/>
  <line x1="${PAD}" y1="${PAD + chartH}" x2="${PAD + chartW}" y2="${PAD + chartH}" stroke="${AXIS_COLOR}" stroke-width="1"/>
  ${bars}
  <text x="${PAD}" y="${PAD + chartH + 38}" fill="#64748b" font="10px system-ui">1st, 2nd … = recall cycle</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgPlaceholder(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 80" width="${W}" height="80">
  <text x="${W / 2}" y="44" fill="#94a3b8" font="14px system-ui" text-anchor="middle">${escapeXml(message)}</text>
</svg>`;
}
