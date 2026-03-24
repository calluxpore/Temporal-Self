import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { useMapRef } from '../context/mapContextState';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { getMemoryImages } from '../utils/imageUtils';
import { formatDate } from '../utils/formatDate';
import { formatCoords } from '../utils/formatCoords';
import { moodOption } from '../utils/memoryMoods';
import type { Memory } from '../types/memory';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function popupHtml(memory: Memory): string {
  const images = getMemoryImages(memory);
  const firstImage = images[0] ?? null;
  if (!firstImage) return `<div class="spatial-walk-popup-text">No photo for this memory.</div>`;
  return `<img src="${firstImage}" alt="" class="spatial-walk-popup-image" /><div class="spatial-walk-popup-text">${escapeHtml(memory.title)}</div>`;
}

function asLatLng(memory: Memory): [number, number] {
  return [Number(memory.lat), Number(memory.lng)];
}

interface SpatialWalkOverlayProps {
  memory: Memory | null;
}

export function SpatialWalkOverlay({ memory }: SpatialWalkOverlayProps) {
  const map = useMapRef();
  const scheduleNextReview = useMemoryStore((s) => s.scheduleNextReview);
  const logStudyRecallAnswered = useMemoryStore((s) => s.logStudyRecallAnswered);
  const recallSessionQueue = useMemoryStore((s) => s.recallSessionQueue);
  const setRecallSessionQueue = useMemoryStore((s) => s.setRecallSessionQueue);
  const recallSessionInitialCount = useMemoryStore((s) => s.recallSessionInitialCount);
  const endRecallSession = useMemoryStore((s) => s.endRecallSession);
  const setRecallModalMemoryId = useMemoryStore((s) => s.setRecallModalMemoryId);
  const setRecallMode = useMemoryStore((s) => s.setRecallMode);
  const [revealed, setRevealed] = useState(false);
  const [flashRemembered, setFlashRemembered] = useState(false);
  const [markerPoint, setMarkerPoint] = useState<{ x: number; y: number } | null>(null);
  const { location: locationName } = useReverseGeocode(memory?.lat ?? 0, memory?.lng ?? 0, {
    enabled: !!memory,
  });

  useEffect(() => {
    if (!map || !memory) return;
    map.closePopup();
    map.flyTo(asLatLng(memory), 15, { animate: true, duration: 1.8 });
  }, [map, memory]);

  useEffect(() => {
    if (!map || !memory) return;
    const syncPoint = () => {
      const point = map.latLngToContainerPoint(asLatLng(memory));
      setMarkerPoint({ x: point.x, y: point.y });
    };
    syncPoint();
    map.on('move', syncPoint);
    map.on('zoom', syncPoint);
    return () => {
      map.off('move', syncPoint);
      map.off('zoom', syncPoint);
    };
  }, [map, memory]);

  const advance = useCallback(() => {
    const rest = useMemoryStore.getState().recallSessionQueue.slice(1);
    setRecallSessionQueue(rest);
    setRecallModalMemoryId(rest[0] ?? null);
    if (rest.length === 0) {
      endRecallSession();
    }
  }, [endRecallSession, setRecallModalMemoryId, setRecallSessionQueue]);

  const handleRemember = useCallback(() => {
    if (!memory) return;
    scheduleNextReview(memory.id, true);
    logStudyRecallAnswered(memory.id, 'remember');
    setFlashRemembered(true);
    window.setTimeout(() => {
      setFlashRemembered(false);
      advance();
    }, 260);
  }, [memory, scheduleNextReview, logStudyRecallAnswered, advance]);

  const handleShowMe = useCallback(() => {
    if (!memory || !map) return;
    setRevealed(true);
    map.openPopup(popupHtml(memory), asLatLng(memory), {
      className: 'spatial-walk-popup',
      autoPan: true,
      closeButton: false,
      offset: [0, -8],
    });
  }, [memory, map]);

  const handleGotIt = useCallback(() => {
    if (!memory) return;
    scheduleNextReview(memory.id, false);
    logStudyRecallAnswered(memory.id, 'show_me');
    advance();
  }, [memory, scheduleNextReview, logStudyRecallAnswered, advance]);

  const handleNext = useCallback(() => {
    if (!memory) return;
    logStudyRecallAnswered(memory.id, 'skip');
    advance();
  }, [memory, logStudyRecallAnswered, advance]);

  const closeCompletion = useCallback(() => {
    setRecallMode(null);
    setRecallModalMemoryId(null);
  }, [setRecallMode, setRecallModalMemoryId]);

  const currentIndex = useMemo(() => {
    if (!recallSessionInitialCount) return 0;
    return Math.max(0, recallSessionInitialCount - recallSessionQueue.length + 1);
  }, [recallSessionInitialCount, recallSessionQueue.length]);

  const placeDescriptor = memory.placeDescriptor?.trim();
  const placeName = locationName?.split(',')[0]?.trim() || null;
  const fallbackPlaceCue = placeName || formatCoords(memory.lat, memory.lng);
  const placeCue = placeDescriptor || fallbackPlaceCue;
  const moodLabel = memory?.mood ? moodOption(memory.mood)?.label : null;

  if (!memory) {
    if (!recallSessionInitialCount) return null;
    return (
      <div className="pointer-events-none fixed inset-0 z-[1125] flex items-end justify-center p-4">
        <div className="pointer-events-auto mb-6 w-[min(520px,95vw)] rounded-xl border border-border bg-surface/88 p-4 shadow-xl backdrop-blur-sm">
          <p className="font-display text-lg font-semibold text-text-primary">Spatial walk complete</p>
          <p className="mt-1 text-sm text-text-secondary">You reviewed {recallSessionInitialCount} memories.</p>
          <button
            type="button"
            onClick={closeCompletion}
            className="touch-target mt-3 rounded-lg border border-accent bg-accent/10 px-3 py-2 font-medium text-accent hover:bg-accent/20"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {markerPoint && (
        <div
          className={`spatial-walk-marker-overlay ${flashRemembered ? 'remembered' : ''}`}
          style={{ left: markerPoint.x, top: markerPoint.y }}
          aria-hidden
        />
      )}
      <div className="pointer-events-none fixed inset-0 z-[1125] flex items-end justify-center p-4">
        <div className="pointer-events-auto mb-6 w-[min(560px,95vw)] rounded-xl border border-border bg-surface/82 p-4 shadow-xl backdrop-blur-sm">
          {!revealed ? (
            <>
              <p
                className={`text-center font-body text-base text-text-primary ${placeDescriptor ? 'italic' : ''}`}
              >
                {placeCue}
              </p>
              <p className="mt-1 text-center font-mono text-xs text-text-muted">
                {currentIndex} of {recallSessionInitialCount} in walk
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRemember}
                  className="touch-target rounded-lg border border-accent bg-accent/10 py-2 font-medium text-accent hover:bg-accent/20"
                >
                  I remember
                </button>
                <button
                  type="button"
                  onClick={handleShowMe}
                  className="touch-target rounded-lg border border-border bg-surface-elevated py-2 font-medium text-text-primary hover:border-accent"
                >
                  Show me
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-semibold text-text-primary">{memory.title}</p>
              {placeDescriptor && (
                <p className="mt-1 text-sm italic text-text-muted">"{placeDescriptor}"</p>
              )}
              <p className="mt-1 font-mono text-xs text-text-secondary">{formatDate(memory.date, true)}</p>
              <p className="mt-1 text-sm text-text-secondary">{fallbackPlaceCue}</p>
              {moodLabel && <p className="mt-1 text-sm text-text-secondary">Mood: {moodLabel}</p>}
              <p className="mt-1 font-mono text-xs text-text-muted">
                {currentIndex} of {recallSessionInitialCount} in walk
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGotIt}
                  className="touch-target rounded-lg border border-accent bg-accent/10 py-2 font-medium text-accent hover:bg-accent/20"
                >
                  Got it
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="touch-target rounded-lg border border-border bg-surface-elevated py-2 font-medium text-text-primary hover:border-accent"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
