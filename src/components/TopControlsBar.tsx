import { useChromeCenterLeft } from '../hooks/useChromeCenterLeft';
import { ThemeToggle } from './ThemeToggle';
import { RecallButton } from './RecallButton';
import { ResetButton } from './ResetButton';
import { MemorySearchButton } from './MemorySearchButton';
import { TimelineLineStyleToggle } from './TimelineLineStyleToggle';
import { TimelineToggle } from './TimelineToggle';
import { HeatmapToggle } from './HeatmapToggle';
import { MarkersToggle } from './MarkersToggle';
import { FavoritesToggle } from './FavoritesToggle';
import { ExportImportButtons } from './ExportImportButtons';

export function TopControlsBar() {
  const left = useChromeCenterLeft();

  return (
    <div
      className="pointer-events-none fixed z-[950] -translate-x-1/2 transition-[left] duration-300 overflow-visible max-w-[100vw]"
      style={{
        left,
        top: 'max(24px, env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Only enable pointer events on the actual button group, not the entire top bar area. */}
      <div className="pointer-events-auto inline-flex max-w-[100vw] flex-nowrap items-center justify-center gap-2 px-3 pt-3 overflow-visible">
        <ThemeToggle variant="bar" />
        <RecallButton variant="bar" />
        <ResetButton variant="bar" />
        <MemorySearchButton variant="bar" />
        <TimelineLineStyleToggle variant="bar" />
        <TimelineToggle variant="bar" />
        <HeatmapToggle variant="bar" />
        <MarkersToggle variant="bar" />
        <FavoritesToggle variant="bar" />
        <ExportImportButtons variant="bar" />
      </div>
    </div>
  );
}

