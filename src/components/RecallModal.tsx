import { useState, useEffect, useRef } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { formatDate } from '../utils/formatDate';
import { formatCoords } from '../utils/formatCoords';
import { getMemoryImages } from '../utils/imageUtils';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import type { Memory } from '../types/memory';

interface RecallModalProps {
  memory: Memory;
  onClose: () => void;
  /** Called when user clicks "Show me" — parent should open the memory viewer. */
  onShowMemory: (memory: Memory) => void;
  /** Called after user answers (I remember / Show me / Skip). Parent should show next due memory or close. */
  onAnswered: () => void;
}

export function RecallModal({ memory, onClose, onShowMemory, onAnswered }: RecallModalProps) {
  const scheduleNextReview = useMemoryStore((s) => s.scheduleNextReview);
  const logStudyRecallAnswered = useMemoryStore((s) => s.logStudyRecallAnswered);
  const [active, setActive] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const images = getMemoryImages(memory);
  const firstImage = images[0] ?? null;
  const { location: locationName, loading: locationLoading } = useReverseGeocode(memory.lat, memory.lng);

  useFocusTrap(modalRef, true);

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
    // Don't call onAnswered() here — parent closes recall modal and opens viewer; when viewer closes, parent will advance to next memory
  };

  const handleSkip = () => {
    logStudyRecallAnswered(memory.id, 'skip');
    onAnswered();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[1100] bg-background/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={modalRef}
        className={`modal-slide-up fixed inset-0 z-[1101] flex flex-col bg-surface md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[90vh] md:w-full md:max-w-lg md:rounded border border-border md:shadow-xl ${active ? 'open' : ''}`}
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
        <div className="flex flex-1 flex-col overflow-x-hidden p-4 py-6 overscroll-contain md:p-8">
          {firstImage ? (
            <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-8 mb-4 md:mb-6 flex min-h-0 max-h-56 md:max-h-72 items-center justify-center overflow-hidden rounded-t-lg bg-surface-elevated md:rounded-t-xl">
              <img
                src={firstImage}
                alt=""
                className="max-h-56 w-full object-contain md:max-h-72"
                role="presentation"
              />
            </div>
          ) : (
            <div className="mb-2 flex items-center justify-center rounded-full mx-auto w-14 h-14 border border-border bg-surface-elevated">
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
          <h2
            id="recall-title"
            className="font-display text-center text-lg font-semibold text-text-primary md:text-xl"
          >
            Do you remember what happened here?
          </h2>
          <p id="recall-desc" className="mt-2 text-center font-mono text-sm text-text-secondary">
            {formatDate(memory.date, true)}
          </p>
          <div className="mt-2 space-y-0.5 text-center">
            {locationName && (
              <p className="font-mono text-sm text-text-primary" title="Address">
                {locationLoading ? '…' : locationName}
              </p>
            )}
            <p className="font-mono text-xs text-accent" title="Exact coordinates">
              {formatCoords(memory.lat, memory.lng)}
            </p>
          </div>
          <p className="mt-4 text-center text-sm text-text-muted">
            Take a moment to think, then choose below.
          </p>

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
