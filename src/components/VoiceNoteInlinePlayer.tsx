import { useCallback, useEffect, useRef, useState } from 'react';

type VoiceNoteInlinePlayerProps = {
  /** Data URL or blob URL; when null/empty, UI is greyed and non-interactive. */
  src: string | null | undefined;
  /** Show recording state inside the pill (still greyed for playback). */
  isRecording?: boolean;
  onClear?: () => void;
  className?: string;
};

/**
 * Compact play/pause + scrubber styled like the memory editor mockup.
 * Greyed out when there is no audio source.
 */
export function VoiceNoteInlinePlayer({
  src,
  isRecording = false,
  onClear,
  className = '',
}: VoiceNoteInlinePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const active = !!src?.trim();

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (a.duration && Number.isFinite(a.duration)) {
        setProgress(a.currentTime / a.duration);
      }
    };
    const onLoaded = () => {
      setDuration(a.duration && Number.isFinite(a.duration) ? a.duration : 0);
      setProgress(0);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('ended', onEnded);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
    setProgress(0);
    if (src) {
      a.load();
    } else {
      setDuration(0);
    }
  }, [src]);

  const togglePlay = useCallback(() => {
    if (!active || !audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
  }, [active, playing]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      if (!active || !audioRef.current || !duration || !barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      audioRef.current.currentTime = x * duration;
      setProgress(x);
    },
    [active, duration]
  );

  const onBarPointerDown = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    seekFromClientX(e.clientX);
    const move = (ev: PointerEvent) => seekFromClientX(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const greyed = !active && !isRecording;
  const recordingOnly = isRecording && !active;

  return (
    <div
      className={`flex h-11 min-w-0 max-w-[220px] flex-1 items-center gap-2 rounded-full border border-border bg-surface-elevated/70 px-2.5 py-0 md:h-10 sm:max-w-[280px] ${
        greyed ? 'opacity-[0.42] saturate-0' : 'opacity-100'
      } ${className}`}
      aria-disabled={!active && !recordingOnly}
    >
      <audio ref={audioRef} src={active && src ? src : undefined} preload="metadata" />

      {recordingOnly ? (
        <span className="flex h-full flex-1 items-center gap-1.5 px-1 font-mono text-[10px] font-medium text-danger">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-danger" aria-hidden />
          Recording…
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!active}
            className={`touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity ${
              active
                ? 'bg-text-primary text-background shadow-sm hover:opacity-90'
                : 'cursor-not-allowed bg-border/80 text-text-muted'
            }`}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div
            ref={barRef}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-disabled={!active}
            className={`relative h-1.5 min-w-[72px] flex-1 rounded-full ${
              active ? 'cursor-pointer' : 'cursor-not-allowed'
            }`}
            onPointerDown={onBarPointerDown}
          >
            <div className="absolute inset-0 rounded-full bg-border/50" />
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${
                active ? 'bg-text-primary/85' : 'bg-text-muted/25'
              }`}
              style={{ width: `${active ? progress * 100 : 0}%` }}
            />
            <div
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-sm ${
                active ? 'bg-text-primary' : 'bg-text-muted/70'
              }`}
              style={{ left: `${active ? progress * 100 : 0}%` }}
            />
          </div>

          {onClear && active && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
              aria-label="Remove voice note"
              title="Remove voice note"
            >
              ×
            </button>
          )}
        </>
      )}
    </div>
  );
}
