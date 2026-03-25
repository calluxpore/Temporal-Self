import { useChromeCenterLeft } from '../hooks/useChromeCenterLeft';
import { ThemeToggle } from './ThemeToggle';
import { RecallButton } from './RecallButton';
import { ResetButton } from './ResetButton';
import { MemorySearchButton } from './MemorySearchButton';
import { MapStyleToggle } from './MapStyleToggle';
import { TimelineLineStyleToggle } from './TimelineLineStyleToggle';
import { TimelineToggle } from './TimelineToggle';
import { HeatmapToggle } from './HeatmapToggle';
import { MoodHeatmapToggle } from './MoodHeatmapToggle';
import { MarkersToggle } from './MarkersToggle';
import { RadiusCirclesToggle } from './RadiusCirclesToggle';
import { FavoritesToggle } from './FavoritesToggle';
import { ExportImportButtons } from './ExportImportButtons';
export function TopControlsBar({
  visible = true,
  centerOnViewport = false,
  onImportPhotos,
}: {
  visible?: boolean;
  centerOnViewport?: boolean;
  onImportPhotos?: (files: File[]) => Promise<void> | void;
}) {
  const chromeCenterLeft = useChromeCenterLeft();
  const left = centerOnViewport ? '50%' : chromeCenterLeft;

  return (
    <div
      className={`pointer-events-none fixed z-[950] -translate-x-1/2 overflow-visible max-w-[100vw] ${
        centerOnViewport ? '' : 'transition-[left] duration-300'
      }`}
      style={{
        left,
        top: 'max(24px, env(safe-area-inset-top, 0px))',
      }}
    >
      <div
        className={`overflow-visible transition-all duration-300 ease-out will-change-transform ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'
        }`}
      >
        {/* Only enable pointer events on the actual button group, not the entire top bar area. */}
        <div className={`inline-flex max-w-[100vw] flex-nowrap items-center justify-center gap-1.5 px-2 pt-2.5 overflow-visible ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <ThemeToggle variant="bar" />
          <MapStyleToggle variant="bar" />
          <TimelineToggle variant="bar" />
          <TimelineLineStyleToggle variant="bar" />
          <MarkersToggle variant="bar" />
          <RadiusCirclesToggle variant="bar" />
          <HeatmapToggle variant="bar" />
          <MoodHeatmapToggle variant="bar" />
          <FavoritesToggle variant="bar" />
          <MemorySearchButton variant="bar" />
          <RecallButton variant="bar" />
          <ExportImportButtons variant="bar" onImportPhotos={onImportPhotos} />
          <ResetButton variant="bar" />
        </div>
      </div>
    </div>
  );
}

