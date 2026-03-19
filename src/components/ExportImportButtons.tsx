import { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useMapRef } from '../context/mapContextState';
import { useMemoryStore } from '../store/memoryStore';
import { exportToJson, exportToCsv, importFromJson, importFromCsv } from '../utils/exportImport';
import { generateReportPdf, reportFilename } from '../utils/generateReport';
import { ConfirmDialog } from './ConfirmDialog';
import type { Memory, Group } from '../types/memory';

function screenshotFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `map-screenshot-${date}_${time}.png`;
}

/** Same look as Theme/Timeline/Heatmap; use inside a fixed wrapper so no fixed here. */
const ROUND_BUTTON_CLASS =
  'flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95';
const FIXED_BUTTON_CLASS = 'fixed z-[1100] ' + ROUND_BUTTON_CLASS;

export function ExportImportButtons() {
  const map = useMapRef();
  const memories = useMemoryStore((s) => s.memories);
  const groups = useMemoryStore((s) => s.groups);
  const setMemories = useMemoryStore((s) => s.setMemories);
  const setGroups = useMemoryStore((s) => s.setGroups);
  const pushUndo = useMemoryStore((s) => s.pushUndo);
  const importInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{ memories: Memory[]; groups: Group[] } | null>(null);
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

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

  const handleExportJson = useCallback(() => {
    exportToJson(memories, groups);
    setExportOpen(false);
  }, [memories, groups]);

  const handleExportCsv = useCallback(() => {
    exportToCsv(memories);
    setExportOpen(false);
  }, [memories]);

  const handleImportClick = useCallback(() => {
    setImportError(null);
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      setImportError(null);
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        const isJson = file.name.toLowerCase().endsWith('.json');
        const result = isJson ? importFromJson(text) : importFromCsv(text);
        if (result.ok) {
          setPendingImport({ memories: result.memories, groups: result.groups });
        } else {
          setImportError(result.error);
        }
      };
      reader.onerror = () => setImportError('Failed to read file');
      reader.readAsText(file);
    },
    []
  );

  const confirmImport = useCallback(() => {
    if (!pendingImport) return;
    pushUndo();
    setMemories(pendingImport.memories);
    setGroups(pendingImport.groups);
    setPendingImport(null);
  }, [pendingImport, pushUndo, setMemories, setGroups]);

  const handleSaveScreenshot = useCallback(async () => {
    setScreenshotError(null);
    if (!map) {
      setScreenshotError('Map not ready');
      return;
    }
    const container = map.getContainer();
    if (!container) return;
    setScreenshotBusy(true);
    try {
      const canvas = await html2canvas(container, {
        useCORS: true,
        allowTaint: true,
        scale: window.devicePixelRatio ?? 1,
        logging: false,
      });
      canvas.toBlob(
        (blob) => {
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
        },
        'image/png',
        1
      );
    } catch (e) {
      setScreenshotError(e instanceof Error ? e.message : 'Screenshot failed');
    } finally {
      setScreenshotBusy(false);
    }
  }, [map]);

  const recallSessions = useMemoryStore((s) => s.recallSessions);

  const handleGenerateReport = useCallback(async () => {
    setReportError(null);
    setReportBusy(true);
    try {
      const doc = await generateReportPdf({ memories, groups, recallSessions });
      doc.save(reportFilename());
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Report failed');
    } finally {
      setReportBusy(false);
    }
  }, [memories, groups, recallSessions]);

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

      {/* Export: round button; options in center modal */}
      <div className="pointer-events-auto fixed z-[1100]" style={{ top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 24.5rem)', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExportOpen((o) => !o);
          }}
          className={ROUND_BUTTON_CLASS + (exportOpen ? ' border-accent bg-surface-elevated' : '')}
          aria-label="Export"
          title="Export"
          aria-expanded={exportOpen}
          aria-haspopup="true"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>

      {exportOpen && (
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
        </div>
      )}

      {/* Import: round button */}
      <button
        type="button"
        onClick={handleImportClick}
        className={FIXED_BUTTON_CLASS}
        style={{ top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 28rem)', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
        aria-label="Import backup"
        title="Import JSON or CSV"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>

      {/* Save screenshot: round button — captures map with current effects, saves to downloads */}
      <button
        type="button"
        onClick={handleSaveScreenshot}
        disabled={!map || screenshotBusy}
        className={FIXED_BUTTON_CLASS}
        style={{ top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 31.5rem)', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
        aria-label="Save map screenshot"
        title="Save screenshot of map (with current effects) to Downloads"
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

      {/* Generate report: round button — comprehensive PDF report, downloads */}
      <button
        type="button"
        onClick={handleGenerateReport}
        disabled={reportBusy}
        className={FIXED_BUTTON_CLASS}
        style={{ top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 35rem)', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
        aria-label="Generate report"
        title="Generate and download comprehensive PDF report"
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

      {/* Contact: round button — opens samreddy.work in new tab */}
      <a
        href="https://samreddy.work/"
        target="_blank"
        rel="noopener noreferrer"
        className={FIXED_BUTTON_CLASS}
        style={{ top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 38.5rem)', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
        aria-label="Contact"
        title="Contact"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </a>

      {importError && (
        <p
          className="fixed z-[1101] font-mono max-w-[160px] text-[10px] text-danger"
          style={{ top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 40rem)', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
          role="alert"
        >
          {importError}
        </p>
      )}

      {reportError && (
        <p
          className="fixed z-[1101] font-mono max-w-[160px] text-[10px] text-danger"
          style={{ top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 36rem)', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
          role="alert"
        >
          {reportError}
        </p>
      )}

      {screenshotError && (
        <p
          className="fixed z-[1101] font-mono max-w-[160px] text-[10px] text-danger"
          style={{ top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 32rem)', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
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
