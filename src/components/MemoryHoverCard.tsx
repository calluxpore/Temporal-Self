import { useState } from 'react';
import { formatDate } from '../utils/formatDate';
import { getMemoryImages } from '../utils/imageUtils';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import type { Memory } from '../types/memory';

interface MemoryHoverCardProps {
  memory: Memory;
  point: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Called when the card is clicked (e.g. to open edit). */
  onClick?: () => void;
}

export function MemoryHoverCard({
  memory,
  point,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: MemoryHoverCardProps) {
  const { location, loading: locationLoading } = useReverseGeocode(memory.lat, memory.lng);
  const firstImage = getMemoryImages(memory)[0] ?? null;
  const [imageFocus, setImageFocus] = useState<'top' | 'center'>('center');
  const notesPreview = memory.notes?.trim()
    ? memory.notes.trim().slice(0, 80) + (memory.notes.length > 80 ? '…' : '')
    : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`memory-hover-card pointer-events-auto absolute z-[850] w-56 rounded border border-border bg-surface shadow-lg ${onClick ? 'cursor-pointer transition-colors hover:border-accent hover:bg-surface-elevated' : ''}`}
      style={{
        left: point.x,
        top: point.y,
        transform: 'translate(-50%, calc(-100% - 10px))',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {firstImage && (
        <div className="h-24 w-full overflow-hidden rounded-t">
          <img
            src={firstImage}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: imageFocus === 'top' ? 'top' : 'center' }}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalHeight > img.naturalWidth) setImageFocus('top');
            }}
          />
        </div>
      )}
      <div className="p-3">
        <h3 className="font-display text-sm font-semibold text-text-primary line-clamp-2">
          {memory.title || 'Untitled'}
        </h3>
        <p className="font-mono mt-0.5 text-xs text-text-secondary">
          {formatDate(memory.date)}
        </p>
        {(location || locationLoading) && (
          <p className="font-mono mt-0.5 text-xs text-text-muted line-clamp-2" title={location ?? undefined}>
            {locationLoading ? '…' : location}
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
