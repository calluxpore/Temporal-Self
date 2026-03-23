import { useState, useEffect, useRef } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { useMapRef } from '../context/mapContextState';
import { formatDate } from '../utils/formatDate';
import { formatCoords } from '../utils/formatCoords';
import { getMemoryImages } from '../utils/imageUtils';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import type { Memory } from '../types/memory';

const RECALL_FLY_ZOOM = 17;
const RECALL_FLY_DURATION = 0.65;

interface RecallModalProps {
  memory: Memory;
  onClose: () => void;
  /** Called when user clicks "Show me" — parent should open the memory viewer. */
  onShowMemory: (memory: Memory) => void;
  /** Called after user answers (I remember / Show me / Skip). Parent should show next due memory or close. */
  onAnswered: () => void;
}

export function RecallModal({ memory, onClose, onShowMemory, onAnswered }: RecallModalProps) {
  const map = useMapRef();
  const scheduleNextReview = useMemoryStore((s) => s.scheduleNextReview);
  const logStudyRecallAnswered = useMemoryStore((s) => s.logStudyRecallAnswered);
  const [active, setActive] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const images = getMemoryImages(memory);
  const firstImage = images[0] ?? null;
  const { location: locationName, loading: locationLoading } = useReverseGeocode(memory.lat, memory.lng);

  useFocusTrap(panelRef, true);

  useEffect(() => {
    if (!map) return;
    map.flyTo([memory.lat, memory.lng], RECALL_FLY_ZOOM, { duration: RECALL_FLY_DURATION });
  }, [map, memory.id, memory.lat, memory.lng]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleRemember = () => {
    scheduleNextReview(memory.id, true);
    logStudyRecallAnswered(memory.id, 'remember');
    onAnswered();
  };

  const handleShowMe = () => {
    scheduleNextReview(memory.id, false);
    logStudyRecallAnswered(memory.id, 'show_me');
    onShowMemory(memory);
    // Don't call onAnswered() here — parent closes recall and opens viewer; when viewer closes, parent will advance to next memory
  };

  const handleSkip = () => {
    logStudyRecallAnswered(memory.id, 'skip');
    onAnswered();
  };

  return (
    <>
      {/* pointer-events-none so the map stays interactive (pan/zoom); first map click closes via MapClickHandler. */}
      <div className="pointer-events-none fixed inset-0 z-[1124] bg-background/10" aria-hidden />

      <div
        ref={panelRef}
        className={`pointer-events-auto fixed inset-y-0 right-0 z-[1125] flex w-[min(420px,92vw)] sm:w-[min(480px,88vw)] flex-col rounded-l-xl border-l border-y border-border bg-surface shadow-xl transition-transform duration-300 ease-out ${
          active ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recall-title"
        aria-describedby="recall-desc"
      >
        <div
          className="flex flex-1 flex-col overflow-y-auto overscroll-contain p-4 py-6 md:p-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-secondary">Recall</p>
              <p className="mt-0.5 font-mono text-xs text-text-muted">Map shows this location — answer from memory.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="touch-target flex min-h-[40px] min-w-[40px] flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface/70 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary active:opacity-80"
              aria-label="Close recall"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {firstImage ? (
            <div className="-mx-1 mb-4 flex min-h-0 max-h-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-elevated sm:max-h-56">
              <img
                src={firstImage}
                alt=""
                className="max-h-48 w-full object-contain sm:max-h-56"
                role="presentation"
              />
            </div>
          ) : (
            <div className="mb-4 flex items-center justify-center rounded-full mx-auto w-14 h-14 border border-border bg-surface-elevated">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
                aria-hidden
              >
                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                <path d="M12 5a3 3 0 0 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
              </svg>
            </div>
          )}
          <h2 id="recall-title" className="font-display text-lg font-semibold text-text-primary md:text-xl">
            Do you remember what happened here?
          </h2>
          <p id="recall-desc" className="mt-2 font-mono text-sm text-text-secondary">
            {formatDate(memory.date, true)}
          </p>
          <div className="mt-2 space-y-0.5">
            {locationName && (
              <p className="font-mono text-sm text-text-primary" title="Address">
                {locationLoading ? '…' : locationName}
              </p>
            )}
            <p className="font-mono text-xs text-accent" title="Exact coordinates">
              {formatCoords(memory.lat, memory.lng)}
            </p>
          </div>
          <p className="mt-4 text-sm text-text-muted">Take a moment to think, then choose below.</p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRemember}
              className="touch-target w-full rounded-lg border border-accent bg-accent/10 py-3 font-medium text-accent transition-colors hover:bg-accent/20 active:scale-[0.99]"
            >
              I remember
            </button>
            <button
              type="button"
              onClick={handleShowMe}
              className="touch-target w-full rounded-lg border border-border bg-surface-elevated py-3 font-medium text-text-primary transition-colors hover:bg-surface-elevated hover:border-accent active:scale-[0.99]"
            >
              Show me
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="touch-target w-full rounded-lg py-2 font-mono text-sm text-text-muted transition-colors hover:text-text-secondary active:opacity-80"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
