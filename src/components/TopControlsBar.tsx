import { useMemo } from 'react';
import { useIsMd } from '../hooks/useMediaQuery';
import { useMemoryStore } from '../store/memoryStore';
import { ThemeToggle } from './ThemeToggle';
import { RecallButton } from './RecallButton';
import { ResetButton } from './ResetButton';
import { TimelineLineStyleToggle } from './TimelineLineStyleToggle';
import { TimelineToggle } from './TimelineToggle';
import { HeatmapToggle } from './HeatmapToggle';
import { MarkersToggle } from './MarkersToggle';
import { FavoritesToggle } from './FavoritesToggle';
import { ExportImportButtons } from './ExportImportButtons';

export function TopControlsBar() {
  const isMd = useIsMd();
  const sidebarOpen = useMemoryStore((s) => s.sidebarOpen);
  const sidebarWidth = useMemoryStore((s) => s.sidebarWidth);

  const left = useMemo(() => {
    if (isMd && sidebarOpen) {
      return `calc(${sidebarWidth}px + (100vw - ${sidebarWidth}px) / 2)`;
    }
    return '50%';
  }, [isMd, sidebarOpen, sidebarWidth]);

  return (
    <div
      className="pointer-events-none fixed z-[950] -translate-x-1/2 transition-[left] duration-300 overflow-hidden max-w-[100vw]"
      style={{
        left,
        top: 'max(24px, env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Only enable pointer events on the actual button group, not the entire top bar area. */}
      <div className="pointer-events-auto inline-flex max-w-[100vw] flex-nowrap items-center justify-center gap-2 px-3 pt-3 overflow-hidden">
        <ThemeToggle variant="bar" />
        <RecallButton variant="bar" />
        <ResetButton variant="bar" />
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

