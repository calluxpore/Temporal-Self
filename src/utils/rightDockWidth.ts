/**
 * Matches right-edge panel widths in AddMemoryModal / SettingsDrawer:
 * `w-[min(540px,92vw)] sm:w-[min(620px,88vw)] lg:w-[min(780px,70vw)] xl:w-[min(860px,60vw)]`
 */
export function rightDockPanelWidthPx(viewportWidth: number): number {
  const w = viewportWidth;
  if (w >= 1280) return Math.min(860, 0.6 * w);
  if (w >= 1024) return Math.min(780, 0.7 * w);
  if (w >= 640) return Math.min(620, 0.88 * w);
  return Math.min(540, 0.92 * w);
}
