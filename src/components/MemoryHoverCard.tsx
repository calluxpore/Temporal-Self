import { formatDate } from '../utils/formatDate';
import { getMemoryImages } from '../utils/imageUtils';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import type { Memory } from '../types/memory';
import { parseNotesFrontMatter } from '../utils/notesFrontMatter';
import { memoryNoteDisplayName } from '../utils/vaultMarkdown';

interface MemoryHoverCardProps {
  memory: Memory;
  point: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Called when the card is clicked (e.g. to open edit). */
  onClick?: () => void;
  /** If provided, a grab handle is shown and dragging will move the memory on the map. */
  onStartDrag?: (e: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}

export function MemoryHoverCard({
  memory,
  point,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onStartDrag,
  isDragging,
}: MemoryHoverCardProps) {
  const parsed = parseNotesFrontMatter(memory.notes ?? '');
  const yamlLocation = parsed.frontMatter.location ?? null;
  const yamlDate = parsed.frontMatter.date ?? null;

  const { location, loading: locationLoading } = useReverseGeocode(memory.lat, memory.lng, { enabled: !isDragging && !yamlLocation });
  const firstImage = getMemoryImages(memory)[0] ?? null;
  const notesPreview = parsed.body?.trim()
    ? parsed.body.trim().slice(0, 80) + (parsed.body.length > 80 ? '…' : '')
    : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`memory-hover-card pointer-events-auto absolute z-[850] w-56 rounded border border-border bg-surface shadow-lg ${
        onClick ? 'cursor-pointer transition-colors hover:border-accent hover:bg-surface-elevated' : ''
      }`}
      style={{
        left: point.x,
        top: point.y,
        transform: 'translate(-50%, calc(-100% - 10px))',
        userSelect: isDragging ? 'none' : undefined,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {onStartDrag && (
        <div
          className="memory-hover-card-grab"
          role="button"
          aria-label="Grab and move memory marker"
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onStartDrag?.(e);
          }}
        />
      )}
      {firstImage && (
        <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-t bg-surface-elevated">
          <img src={firstImage} alt="" className="max-h-24 max-w-full object-contain" />
        </div>
      )}
      <div className="p-3">
        <h3 className="font-display text-sm font-semibold text-text-primary line-clamp-2">
          {memoryNoteDisplayName(memory)}
        </h3>
        <p className="font-mono mt-0.5 text-xs text-text-secondary">
          {formatDate(yamlDate ?? memory.date)}
        </p>
        {(yamlLocation || location || locationLoading) && (
          <p className="font-mono mt-0.5 text-xs text-text-muted line-clamp-2" title={location ?? undefined}>
            {yamlLocation ? yamlLocation : locationLoading ? '…' : location}
          </p>
        )}
        {notesPreview && (
          <p className="font-body mt-1.5 text-xs text-text-muted line-clamp-2">
            {notesPreview}
          </p>
        )}
      </div>
    </div>
  );
}
