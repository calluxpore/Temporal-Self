import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toCanvas } from 'html-to-image';
import { useMapRef } from '../context/mapContextState';
import { useMemoryStore } from '../store/memoryStore';
import { exportToJson, exportToCsv, importFromJson, importFromCsv } from '../utils/exportImport';
import { generateReportPdf, reportFilename } from '../utils/generateReport';
import { ConfirmDialog } from './ConfirmDialog';
import { SettingsButton } from './SettingsButton';
import type { Memory, Group } from '../types/memory';
import type { StudyEvent } from '../types/study';
import {
  HOTKEY_EXPORT_EVENT,
  HOTKEY_IMPORT_EVENT,
  HOTKEY_IMPORT_PHOTOS_EVENT,
  HOTKEY_REPORT_EVENT,
  HOTKEY_SHOT_EVENT,
} from '../hooks/useKeyboardShortcuts';

function screenshotFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `map-screenshot-${date}_${time}.png`;
}

function formatScreenshotTimestamp(now: Date): { time: string; date: string } {
  const h24 = now.getHours();
  const h12 = ((h24 + 11) % 12) + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${h12}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const date = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  return { time, date };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Same look as Theme/Timeline/Heatmap; use inside a fixed wrapper so no fixed here. */
const TOOLTIP_CLASS =
  'pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100';

type TopControlVariant = 'fixed' | 'bar';

const TOOLTIP_CLASS_BAR =
  'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100';

function isLikelyPhotoFile(file: File): boolean {
  if (file.type.toLowerCase().startsWith('image/')) return true;
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith('.heic') ||
    lower.endsWith('.heif') ||
    lower.endsWith('.avif') ||
    lower.endsWith('.dng') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp')
  );
}

export function ExportImportButtons({
  variant = 'fixed',
  onImportPhotos,
}: {
  variant?: TopControlVariant;
  onImportPhotos?: (files: File[]) => Promise<void> | void;
}) {
  const map = useMapRef();
  const memories = useMemoryStore((s) => s.memories);
  const groups = useMemoryStore((s) => s.groups);
  const setMemories = useMemoryStore((s) => s.setMemories);
  const setGroups = useMemoryStore((s) => s.setGroups);
  const pushUndo = useMemoryStore((s) => s.pushUndo);
  const importInputRef = useRef<HTMLInputElement>(null);
  const photoImportInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    memories: Memory[];
    groups: Group[];
    appState?: {
      theme?: 'dark' | 'light';
      mapView?: { lat: number; lng: number; zoom: number } | null;
      hasChosenStartLocation?: boolean;
      defaultGroupId?: string | null;
      sidebarWidth?: number;
      skipDeleteConfirmation?: boolean;
      recallSessions?: { remembered: number; forgot: number }[];
      studyParticipantId?: string | null;
      studyCheckpointTag?: 'baseline' | '2d' | '14d' | '40d' | null;
      studyCheckpointCompletedByParticipant?: Record<
        string,
        Partial<Record<'baseline' | '2d' | '14d' | '40d', string>>
      >;
      studyEvents?: unknown[];
      aiProvider?: 'gemini' | 'openai' | 'claude' | null;
      aiAutoAnalyze?: boolean;
    };
  } | null>(null);
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const timelineEnabled = useMemoryStore((s) => s.timelineEnabled);
  const markersVisible = useMemoryStore((s) => s.markersVisible);
  const theme = useMemoryStore((s) => s.theme);
  const setTimelineEnabled = useMemoryStore((s) => s.setTimelineEnabled);
  const setMarkersVisible = useMemoryStore((s) => s.setMarkersVisible);
  const mapView = useMemoryStore((s) => s.mapView);
  const hasChosenStartLocation = useMemoryStore((s) => s.hasChosenStartLocation);
  const defaultGroupId = useMemoryStore((s) => s.defaultGroupId);
  const sidebarWidth = useMemoryStore((s) => s.sidebarWidth);
  const skipDeleteConfirmation = useMemoryStore((s) => s.skipDeleteConfirmation);
  const recallSessions = useMemoryStore((s) => s.recallSessions);
  const setTheme = useMemoryStore((s) => s.setTheme);
  const setMapView = useMemoryStore((s) => s.setMapView);
  const setHasChosenStartLocation = useMemoryStore((s) => s.setHasChosenStartLocation);
  const setSidebarWidth = useMemoryStore((s) => s.setSidebarWidth);
  const setSkipDeleteConfirmation = useMemoryStore((s) => s.setSkipDeleteConfirmation);
  const setDefaultGroupId = useMemoryStore((s) => s.setDefaultGroupId);
  const setDateFilter = useMemoryStore((s) => s.setDateFilter);
  const setSidebarView = useMemoryStore((s) => s.setSidebarView);
  const aiProvider = useMemoryStore((s) => s.aiProvider);
  const aiAutoAnalyze = useMemoryStore((s) => s.aiAutoAnalyze);
  const setAiProvider = useMemoryStore((s) => s.setAiProvider);
  const setAiAutoAnalyze = useMemoryStore((s) => s.setAiAutoAnalyze);

  const studyParticipantId = useMemoryStore((s) => s.studyParticipantId);
  const studyCheckpointTag = useMemoryStore((s) => s.studyCheckpointTag);
  const studyCheckpointCompletedByParticipant = useMemoryStore((s) => s.studyCheckpointCompletedByParticipant);
  const studyEvents = useMemoryStore((s) => s.studyEvents);
  const setStudyParticipantId = useMemoryStore((s) => s.setStudyParticipantId);
  const setStudyCheckpointTag = useMemoryStore((s) => s.setStudyCheckpointTag);

  const tooltipClass = variant === 'bar' ? TOOLTIP_CLASS_BAR : TOOLTIP_CLASS;
  const roundButtonClass = `flex touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95 ${
    variant === 'bar' ? 'h-10 w-10 min-h-[36px] min-w-[36px]' : 'h-12 w-12 min-h-[44px] min-w-[44px]'
  }`;
  const errorTop =
    variant === 'bar' ? `calc(max(24px, env(safe-area-inset-top, 0px)) + 78px)` : undefined;

  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    const id = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', close);
    };
  }, [exportOpen]);

  const studyCheckpointCompletedAtForCurrentId = useMemo(() => {
    const pid = studyParticipantId?.trim() ?? '';
    if (!pid) return {} as Partial<Record<'baseline' | '2d' | '14d' | '40d', string>>;
    return studyCheckpointCompletedByParticipant[pid] ?? {};
  }, [studyCheckpointCompletedByParticipant, studyParticipantId]);

  const handleExportJson = useCallback(() => {
    exportToJson(memories, groups, {
      theme,
      mapView,
      hasChosenStartLocation,
      defaultGroupId,
      sidebarWidth,
      skipDeleteConfirmation,
      recallSessions,
      studyParticipantId,
      studyCheckpointTag,
      studyCheckpointCompletedByParticipant,
      studyEvents,
      aiProvider,
      aiAutoAnalyze,
    });
    setExportOpen(false);
  }, [
    memories,
    groups,
    theme,
    mapView,
    hasChosenStartLocation,
    defaultGroupId,
    sidebarWidth,
    skipDeleteConfirmation,
    recallSessions,
    studyParticipantId,
    studyCheckpointTag,
    studyCheckpointCompletedByParticipant,
    studyEvents,
    aiProvider,
    aiAutoAnalyze,
  ]);

  const handleExportCsv = useCallback(() => {
    exportToCsv(memories);
    setExportOpen(false);
  }, [memories]);

  const handleImportClick = useCallback(() => {
    setImportError(null);
    importInputRef.current?.click();
  }, []);

  const handlePhotoImportClick = useCallback(() => {
    setImportError(null);
    photoImportInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      setImportError(null);
      if (!files.length) return;
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        const isJson = file.name.toLowerCase().endsWith('.json');
        const result = isJson ? importFromJson(text) : importFromCsv(text);
        if (result.ok) {
          setPendingImport({
            memories: result.memories,
            groups: result.groups,
            appState: result.appState,
          });
        } else {
          setImportError(result.error);
        }
      };
      reader.onerror = () => setImportError('Failed to read file');
      reader.readAsText(file);
    },
    []
  );

  const handlePhotoImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      setImportError(null);
      if (!files.length) return;
      const imageFiles = files.filter(isLikelyPhotoFile);
      if (!imageFiles.length) {
        setImportError('Please select image files.');
        return;
      }
      void onImportPhotos?.(imageFiles);
    },
    [onImportPhotos]
  );

  const confirmImport = useCallback(() => {
    if (!pendingImport) return;
    pushUndo();
    setMemories(pendingImport.memories);
    setGroups(pendingImport.groups);

    // After import, focus on today's date to keep initial view familiar and bounded.
    const today = new Date().toISOString().slice(0, 10);
    setDateFilter(today, today);
    setSidebarView('calendar');

    if (pendingImport.appState) {
      if (pendingImport.appState.theme) setTheme(pendingImport.appState.theme);
      if (pendingImport.appState.mapView !== undefined) {
        if (pendingImport.appState.mapView) {
          setMapView(pendingImport.appState.mapView);
        } else {
          useMemoryStore.setState({ mapView: null });
        }
      }
      if (pendingImport.appState.hasChosenStartLocation !== undefined)
        setHasChosenStartLocation(pendingImport.appState.hasChosenStartLocation);
      if (pendingImport.appState.defaultGroupId !== undefined)
        setDefaultGroupId(pendingImport.appState.defaultGroupId ?? null);
      if (pendingImport.appState.sidebarWidth !== undefined) setSidebarWidth(pendingImport.appState.sidebarWidth);
      if (pendingImport.appState.skipDeleteConfirmation !== undefined)
        setSkipDeleteConfirmation(pendingImport.appState.skipDeleteConfirmation);
      if (pendingImport.appState.recallSessions)
        useMemoryStore.setState({ recallSessions: pendingImport.appState.recallSessions });

      if ('studyParticipantId' in pendingImport.appState && pendingImport.appState.studyParticipantId !== undefined) {
        setStudyParticipantId(pendingImport.appState.studyParticipantId ?? null);
      }
      if ('studyCheckpointTag' in pendingImport.appState && pendingImport.appState.studyCheckpointTag !== undefined) {
        setStudyCheckpointTag(pendingImport.appState.studyCheckpointTag ?? null);
      }
      if (
        'studyCheckpointCompletedByParticipant' in pendingImport.appState &&
        pendingImport.appState.studyCheckpointCompletedByParticipant !== undefined
      ) {
        useMemoryStore.setState({
          studyCheckpointCompletedByParticipant: pendingImport.appState.studyCheckpointCompletedByParticipant ?? {},
        });
      }
      if ('studyEvents' in pendingImport.appState && pendingImport.appState.studyEvents !== undefined) {
        useMemoryStore.setState({ studyEvents: (pendingImport.appState.studyEvents ?? []) as StudyEvent[] });
      }
      if ('aiProvider' in pendingImport.appState && pendingImport.appState.aiProvider !== undefined) {
        setAiProvider(pendingImport.appState.aiProvider ?? null);
      }
      if ('aiAutoAnalyze' in pendingImport.appState && pendingImport.appState.aiAutoAnalyze !== undefined) {
        setAiAutoAnalyze(!!pendingImport.appState.aiAutoAnalyze);
      }
    }
    setPendingImport(null);
  }, [
    pendingImport,
    pushUndo,
    setMemories,
    setGroups,
    setTheme,
    setMapView,
    setHasChosenStartLocation,
    setDefaultGroupId,
    setStudyParticipantId,
    setStudyCheckpointTag,
    setAiProvider,
    setAiAutoAnalyze,
    setSidebarWidth,
    setSkipDeleteConfirmation,
    setDateFilter,
    setSidebarView,
  ]);

  const handleSaveScreenshot = useCallback(async () => {
    setScreenshotError(null);
    if (!map) {
      setScreenshotError('Map not ready');
      return;
    }
    const container = map.getContainer();
    if (!container) return;
    setScreenshotBusy(true);

    // Ensure timeline curve and markers are visible in the saved image.
    const prevTimeline = timelineEnabled;
    const prevMarkers = markersVisible;
    setTimelineEnabled(true);
    setMarkersVisible(true);

    // Force a stable visual state for capture.
    const wrapper = container.parentElement as HTMLElement | null;
    const prevContainerOpacity = container.style.opacity;
    const prevContainerAnimation = container.style.animation;
    const prevWrapperFilter = wrapper?.style.filter ?? '';
    const prevWrapperTransition = wrapper?.style.transition ?? '';
    const hiddenForCapture = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.leaflet-control-zoom, .leaflet-control-attribution, .leaflet-control-container'
      )
    );
    const prevHiddenVisibility = hiddenForCapture.map((el) => el.style.visibility);
    container.style.opacity = '1';
    container.style.animation = 'none';
    if (wrapper) {
      wrapper.style.filter = 'none';
      wrapper.style.transition = 'none';
    }
    hiddenForCapture.forEach((el) => {
      el.style.visibility = 'hidden';
    });

    try {
      // Wait for at least two frames so Leaflet overlays/tile opacity settle.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      await new Promise((resolve) => setTimeout(resolve, 220));

      const rawCanvas = await toCanvas(container, {
        cacheBust: true,
        pixelRatio: window.devicePixelRatio ?? 1,
      });
      if (!rawCanvas) {
        setScreenshotError('Failed to capture map');
        return;
      }
      const outCanvas = document.createElement('canvas');
      const framePadding = Math.max(16, Math.round(rawCanvas.width * 0.02));
      outCanvas.width = rawCanvas.width + framePadding * 2;
      outCanvas.height = rawCanvas.height + framePadding * 2;
      const ctx = outCanvas.getContext('2d');
      if (!ctx) {
        setScreenshotError('Canvas context unavailable');
        return;
      }
      const rx = framePadding;
      const ry = framePadding;
      const rw = rawCanvas.width;
      const rh = rawCanvas.height;
      const radius = Math.max(20, Math.round(Math.min(rw, rh) * 0.04));
      const isLightTheme = theme === 'light';
      const frameColor = isLightTheme ? '#111111' : '#ffffff';
      const textColor = isLightTheme ? '#111111' : '#ffffff';
      const shadowColor = isLightTheme ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)';

      // Draw rounded map card.
      roundedRectPath(ctx, rx, ry, rw, rh, radius);
      ctx.save();
      ctx.clip();
      ctx.drawImage(rawCanvas, rx, ry);
      ctx.restore();

      // White rounded border.
      ctx.strokeStyle = frameColor;
      ctx.lineWidth = Math.max(3, Math.round(Math.min(rw, rh) * 0.005));
      roundedRectPath(ctx, rx, ry, rw, rh, radius);
      ctx.stroke();

      // Timestamp in top-left of the map.
      const stamp = formatScreenshotTimestamp(new Date());
      const fontSize = Math.max(24, Math.round(Math.min(rw, rh) * 0.055));
      ctx.fillStyle = textColor;
      ctx.font = `700 ${fontSize}px Roboto, Arial, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = Math.max(8, Math.round(fontSize * 0.25));
      ctx.shadowOffsetY = Math.max(2, Math.round(fontSize * 0.06));
      const textX = rx + Math.max(20, Math.round(fontSize * 0.4));
      const topY = ry + Math.max(18, Math.round(fontSize * 0.4));
      ctx.fillText(stamp.time, textX, topY);
      ctx.fillText(stamp.date, textX, topY + Math.round(fontSize * 1.05));
      ctx.shadowColor = 'transparent';

      const blob = await new Promise<Blob | null>((resolve) =>
        outCanvas.toBlob((b) => resolve(b), 'image/png', 1)
      );
      if (!blob) {
        setScreenshotError('Failed to create image');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = screenshotFilename();
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setScreenshotError(e instanceof Error ? e.message : 'Screenshot failed');
    } finally {
      // Restore previous toggles and styles.
      setTimelineEnabled(prevTimeline);
      setMarkersVisible(prevMarkers);
      container.style.opacity = prevContainerOpacity;
      container.style.animation = prevContainerAnimation;
      if (wrapper) {
        wrapper.style.filter = prevWrapperFilter;
        wrapper.style.transition = prevWrapperTransition;
      }
      hiddenForCapture.forEach((el, i) => {
        el.style.visibility = prevHiddenVisibility[i] ?? '';
      });
      setScreenshotBusy(false);
    }
  }, [
    map,
    timelineEnabled,
    markersVisible,
    theme,
    setTimelineEnabled,
    setMarkersVisible,
  ]);

  const handleGenerateReport = useCallback(async () => {
    setReportError(null);
    setReportBusy(true);
    try {
      const doc = await generateReportPdf({
        memories,
        groups,
        recallSessions,
        study: {
          participantId: studyParticipantId,
          checkpointTag: studyCheckpointTag,
          checkpointCompletedAt: studyCheckpointCompletedAtForCurrentId,
          checkpointCompletedByParticipant: studyCheckpointCompletedByParticipant,
          events: studyEvents,
        },
      });
      doc.save(reportFilename());
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Report failed');
    } finally {
      setReportBusy(false);
    }
  }, [
    memories,
    groups,
    recallSessions,
    studyParticipantId,
    studyCheckpointTag,
    studyCheckpointCompletedAtForCurrentId,
    studyCheckpointCompletedByParticipant,
    studyEvents,
  ]);

  useEffect(() => {
    const onExport = () => setExportOpen((o) => !o);
    const onImport = () => handleImportClick();
    const onImportPhotos = () => handlePhotoImportClick();
    const onShot = () => {
      if (!screenshotBusy) void handleSaveScreenshot();
    };
    const onReport = () => {
      if (!reportBusy) void handleGenerateReport();
    };
    window.addEventListener(HOTKEY_EXPORT_EVENT, onExport as EventListener);
    window.addEventListener(HOTKEY_IMPORT_EVENT, onImport as EventListener);
    window.addEventListener(HOTKEY_IMPORT_PHOTOS_EVENT, onImportPhotos as EventListener);
    window.addEventListener(HOTKEY_SHOT_EVENT, onShot as EventListener);
    window.addEventListener(HOTKEY_REPORT_EVENT, onReport as EventListener);
    return () => {
      window.removeEventListener(HOTKEY_EXPORT_EVENT, onExport as EventListener);
      window.removeEventListener(HOTKEY_IMPORT_EVENT, onImport as EventListener);
      window.removeEventListener(HOTKEY_IMPORT_PHOTOS_EVENT, onImportPhotos as EventListener);
      window.removeEventListener(HOTKEY_SHOT_EVENT, onShot as EventListener);
      window.removeEventListener(HOTKEY_REPORT_EVENT, onReport as EventListener);
    };
  }, [handleGenerateReport, handleImportClick, handlePhotoImportClick, handleSaveScreenshot, reportBusy, screenshotBusy]);

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleImportFile}
        className="hidden"
        aria-hidden
      />
      <input
        ref={photoImportInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoImportFile}
        className="hidden"
        aria-hidden
      />

      {/* Export: round button; options in center modal */}
      <div
        className={
          variant === 'bar' ? 'relative z-[1100] group flex-shrink-0' : 'pointer-events-auto fixed z-[1100] group'
        }
        style={
          variant === 'bar'
            ? undefined
            : {
                top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 448px)',
                left: '50%',
                transform: 'translateX(-50%)',
              }
        }
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExportOpen((o) => !o);
          }}
          className={roundButtonClass + (exportOpen ? ' border-accent bg-surface-elevated' : '')}
          aria-label="Export"
          title="Export (Alt+E)"
          aria-expanded={exportOpen}
          aria-haspopup="true"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <span className={tooltipClass}>Export (Alt+E)</span>
      </div>

      {/* Portal: TopControlsBar uses translateX, which traps fixed positioning to the bar strip */}
      {exportOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
            onClick={() => setExportOpen(false)}
            role="presentation"
          >
            <div
              ref={exportMenuRef}
              className="min-w-[180px] rounded-xl border border-border bg-surface py-2 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Export options"
            >
              <p className="font-mono px-3 py-1.5 text-[11px] text-text-muted">Export as</p>
              <button type="button" onClick={handleExportJson} className="font-mono w-full px-3 py-2.5 text-left text-[12px] text-text-primary hover:bg-surface-elevated hover:text-accent">
                JSON
              </button>
              <button type="button" onClick={handleExportCsv} className="font-mono w-full px-3 py-2.5 text-left text-[12px] text-text-primary hover:bg-surface-elevated hover:text-accent">
                CSV
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Import: round button */}
      <div
        className={variant === 'bar' ? 'relative z-[1100] group flex-shrink-0' : 'fixed z-[1100] group'}
        style={
          variant === 'bar'
            ? undefined
            : {
                top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 504px)',
                left: '50%',
                transform: 'translateX(-50%)',
              }
        }
      >
        <button
          type="button"
          onClick={handleImportClick}
          className={roundButtonClass}
          aria-label="Import backup"
          title="Import (Alt+I)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
        <span className={tooltipClass}>Import (Alt+I)</span>
      </div>

      {/* Import photos: dedicated image picker (EXIF placement flow) */}
      <div
        className={variant === 'bar' ? 'relative z-[1100] group flex-shrink-0' : 'fixed z-[1100] group'}
        style={
          variant === 'bar'
            ? undefined
            : {
                top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 560px)',
                left: '50%',
                transform: 'translateX(-50%)',
              }
        }
      >
        <button
          type="button"
          onClick={handlePhotoImportClick}
          className={roundButtonClass}
          aria-label="Import photos"
          title="Import photos (Alt+X)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
            <rect x="3" y="5" width="14" height="14" rx="2" />
            <path d="m6 15 3-3 2 2 3-3 3 3" />
            <circle cx="8.5" cy="9" r="1" />
            <path d="M20 7v7" />
            <path d="M17 11h6" />
          </svg>
        </button>
        <span className={tooltipClass}>Import photos (Alt+X)</span>
      </div>

      {/* Save screenshot: round button — captures map with current effects, saves to downloads */}
      <div
        className={variant === 'bar' ? 'relative z-[1100] group flex-shrink-0' : 'fixed z-[1100] group'}
        style={
          variant === 'bar'
            ? undefined
            : {
                top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 616px)',
                left: '50%',
                transform: 'translateX(-50%)',
              }
        }
      >
        <button
          type="button"
          onClick={handleSaveScreenshot}
          disabled={!map || screenshotBusy}
          className={roundButtonClass}
          aria-label="Save map screenshot"
          title="Shot (Ctrl+I)"
        >
          {screenshotBusy ? (
            <span className="font-mono text-[10px] text-text-muted">…</span>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" aria-hidden>
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          )}
        </button>
        <span className={tooltipClass}>Shot (Ctrl+I)</span>
      </div>

      {/* Generate report: round button — comprehensive PDF report, downloads */}
      <div
        className={variant === 'bar' ? 'relative z-[1100] group flex-shrink-0' : 'fixed z-[1100] group'}
        style={
          variant === 'bar'
            ? undefined
            : {
                top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 672px)',
                left: '50%',
                transform: 'translateX(-50%)',
              }
        }
      >
        <button
          type="button"
          onClick={handleGenerateReport}
          disabled={reportBusy}
          className={roundButtonClass}
          aria-label="Generate report"
          title="Report (Ctrl+R)"
        >
          {reportBusy ? (
            <span className="font-mono text-[10px] text-text-muted">…</span>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          )}
        </button>
        <span className={tooltipClass}>Report (Ctrl+R)</span>
      </div>

      <SettingsButton variant={variant} />

      {/* Contact: round button — opens samreddy.work in new tab */}
      <div
        className={variant === 'bar' ? 'relative z-[1100] group flex-shrink-0' : 'fixed z-[1100] group'}
        style={
          variant === 'bar'
            ? undefined
            : {
                top: 'calc(max(24px, env(safe-area-inset-top, 0px)) + 784px)',
                left: '50%',
                transform: 'translateX(-50%)',
              }
        }
      >
        <a
          href="https://samreddy.work/"
          target="_blank"
          rel="noopener noreferrer"
          className={roundButtonClass}
          aria-label="Contact"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </a>
        <span className={tooltipClass}>Contact</span>
      </div>

      {importError && (
        <p
          className="fixed z-[1101] font-mono max-w-[160px] text-[10px] text-danger"
          style={{
            top:
              variant === 'bar'
                ? errorTop
                : 'calc(max(24px, env(safe-area-inset-top, 0px)) + 696px)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          role="alert"
        >
          {importError}
        </p>
      )}

      {reportError && (
        <p
          className="fixed z-[1101] font-mono max-w-[160px] text-[10px] text-danger"
          style={{
            top:
              variant === 'bar'
                ? errorTop
                : 'calc(max(24px, env(safe-area-inset-top, 0px)) + 688px)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          role="alert"
        >
          {reportError}
        </p>
      )}

      {screenshotError && (
        <p
          className="fixed z-[1101] font-mono max-w-[160px] text-[10px] text-danger"
          style={{
            top:
              variant === 'bar'
                ? errorTop
                : 'calc(max(24px, env(safe-area-inset-top, 0px)) + 624px)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          role="alert"
        >
          {screenshotError}
        </p>
      )}

      <ConfirmDialog
        key={pendingImport ? 'open' : 'closed'}
        open={!!pendingImport}
        title="Replace all data?"
        message="Importing will replace all current memories and groups. You can undo this after importing. Continue?"
        confirmLabel="Replace"
        danger
        zIndex={1300}
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      />
    </>
  );
}
