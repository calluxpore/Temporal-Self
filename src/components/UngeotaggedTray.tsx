import { useMemo } from 'react';

export interface UngeotaggedPhotoItem {
  id: string;
  fileName: string;
  dataUrl: string;
  dateTaken: string | null;
}

export function UngeotaggedTray({
  photos,
  open,
  placeModeActive,
  onClose,
  onStartPlaceMode,
}: {
  photos: UngeotaggedPhotoItem[];
  open: boolean;
  placeModeActive: boolean;
  onClose: () => void;
  onStartPlaceMode: (photoId: string) => void;
}) {
  const title = useMemo(
    () => (placeModeActive ? 'Click map to place photo' : 'Photos without GPS location'),
    [placeModeActive]
  );

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[1400] border-t border-border/70 bg-background transition-transform duration-300 ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className={`${placeModeActive ? 'h-[56px]' : 'h-[160px]'} px-3 py-2`}>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[13px] text-text-secondary">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:text-text-primary"
            aria-label="Close ungeotagged tray"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {!placeModeActive && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-temporal-photo-id', photo.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onStartPlaceMode(photo.id)}
                className="group flex w-[100px] flex-shrink-0 cursor-grab active:cursor-grabbing flex-col text-left"
                title="Drag to map or click to place"
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.fileName}
                  className="h-[100px] w-[100px] rounded-lg object-cover"
                />
                <span className="mt-1 truncate font-mono text-[11px] text-text-muted group-hover:text-text-secondary">
                  {photo.fileName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
