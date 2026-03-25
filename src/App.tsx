import { useCallback, useEffect, useState } from 'react';
import exifr from 'exifr';
import { useMemoryStore } from './store/memoryStore';
import { MapProvider } from './context/MapContext';
import { useMapRef } from './context/mapContextState';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { AddMemoryModal } from './components/AddMemoryModal';
import { MemoryViewer } from './components/MemoryViewer';
import { RecallModal } from './components/RecallModal';
import { SpatialWalkOverlay } from './components/SpatialWalkOverlay';
import { LocationSearch } from './components/LocationSearch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnboardingOverlay, ONBOARDING_STEP_COUNT } from './components/OnboardingOverlay';
import splashLogo from '../_assets/TS_Logo.png';
import { TopControlsBar } from './components/TopControlsBar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { MemorySearchDrawer } from './components/MemorySearchDrawer';
import { UngeotaggedTray, type UngeotaggedPhotoItem } from './components/UngeotaggedTray';
import { normalizePhonePhotoToDataUrl } from './utils/imageUtils';
import { getFirstReviewDate, toISODateString } from './utils/spacedRepetition';
import { useVaultSync } from './hooks/useVaultSync';
import { useAiQueue } from './hooks/useAiQueue';
import type { Memory } from './types/memory';
const SPLASH_SEEN_STORAGE_KEY = 'temporal-self-splash-seen';
const ONBOARDING_SEEN_STORAGE_KEY = 'temporal-self-onboarding-seen';

type ProcessResult = {
  file: File;
  dataUrl: string;
  lat: number | null;
  lng: number | null;
  dateTaken: string | null;
};

type BulkImportProfile = {
  maxWidth: number;
  jpegQuality: number;
  concurrency: number;
  progressStep: number;
};

function getBulkImportProfile(total: number): BulkImportProfile {
  if (total >= 1000) return { maxWidth: 1280, jpegQuality: 0.68, concurrency: 2, progressStep: 10 };
  if (total >= 400) return { maxWidth: 1440, jpegQuality: 0.72, concurrency: 3, progressStep: 6 };
  if (total >= 120) return { maxWidth: 1600, jpegQuality: 0.76, concurrency: 4, progressStep: 4 };
  if (total >= 40) return { maxWidth: 1760, jpegQuality: 0.78, concurrency: 5, progressStep: 2 };
  return { maxWidth: 1920, jpegQuality: 0.8, concurrency: 6, progressStep: 1 };
}

type ImportToastState = {
  message: string;
  actionLabel?: string;
  action?: () => void;
} | null;

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

function AppContent() {
  const map = useMapRef();
  const pendingLatLng = useMemoryStore((s) => s.pendingLatLng);
  const isAddingMemory = useMemoryStore((s) => s.isAddingMemory);
  const editingMemory = useMemoryStore((s) => s.editingMemory);
  const selectedMemory = useMemoryStore((s) =>
    s.selectedMemoryId ? s.memories.find((m) => m.id === s.selectedMemoryId) ?? null : null
  );
  const theme = useMemoryStore((s) => s.theme);
  const setPendingLatLng = useMemoryStore((s) => s.setPendingLatLng);
  const setIsAddingMemory = useMemoryStore((s) => s.setIsAddingMemory);
  const setEditingMemory = useMemoryStore((s) => s.setEditingMemory);
  const setSelectedMemory = useMemoryStore((s) => s.setSelectedMemory);
  const recallModalMemoryId = useMemoryStore((s) => s.recallModalMemoryId);
  const recallMode = useMemoryStore((s) => s.recallMode);
  const setRecallModalMemoryId = useMemoryStore((s) => s.setRecallModalMemoryId);
  const setRecallMode = useMemoryStore((s) => s.setRecallMode);
  const recallSessionQueue = useMemoryStore((s) => s.recallSessionQueue);
  const setRecallSessionQueue = useMemoryStore((s) => s.setRecallSessionQueue);
  const endRecallSession = useMemoryStore((s) => s.endRecallSession);
  const addMemory = useMemoryStore((s) => s.addMemory);
  const addMemories = useMemoryStore((s) => s.addMemories);
  const logStudyMemoryCreated = useMemoryStore((s) => s.logStudyMemoryCreated);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SPLASH_SEEN_STORAGE_KEY) !== 'true';
  });
  const recallMemory = useMemoryStore((s) =>
    recallModalMemoryId ? s.memories.find((m) => m.id === recallModalMemoryId) ?? null : null
  );
  const [viewerOpenedFromRecall, setViewerOpenedFromRecall] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const settingsDrawerOpen = useMemoryStore((s) => s.settingsDrawerOpen);
  const memorySearchDrawerOpen = useMemoryStore((s) => s.memorySearchDrawerOpen);
  const topShelfVisibleMain = useMemoryStore((s) => s.topShelfVisibleMain);
  const topShelfVisibleSpatial = useMemoryStore((s) => s.topShelfVisibleSpatial);
  const spatialWalkActive = recallMode === 'spatial';
  const topShelfVisible = spatialWalkActive ? topShelfVisibleSpatial : topShelfVisibleMain;
  const [isDroppingPhotos, setIsDroppingPhotos] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ done: number; total: number } | null>(null);
  const [importToast, setImportToast] = useState<ImportToastState>(null);
  const [ungeotaggedPhotos, setUngeotaggedPhotos] = useState<UngeotaggedPhotoItem[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [placeModePhotoId, setPlaceModePhotoId] = useState<string | null>(null);
  const aiProvider = useMemoryStore((s) => s.aiProvider);
  const aiApiKey = useMemoryStore((s) => s.aiApiKey);
  const aiAutoAnalyze = useMemoryStore((s) => s.aiAutoAnalyze);
  const enqueueAiAnalysis = useMemoryStore((s) => s.enqueueAiAnalysis);

  const onRequestNewMemory = useCallback(() => {
    if (map) {
      const center = map.getCenter();
      setPendingLatLng({ lat: center.lat, lng: center.lng });
      setIsAddingMemory(true);
    }
  }, [map, setPendingLatLng, setIsAddingMemory]);

  useKeyboardShortcuts(onRequestNewMemory);
  useVaultSync();
  useAiQueue();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (!importToast) return;
    const id = window.setTimeout(() => setImportToast(null), 8000);
    return () => window.clearTimeout(id);
  }, [importToast]);
  useEffect(() => {
    if (ungeotaggedPhotos.length === 0) {
      setTrayOpen(false);
      setPlaceModePhotoId(null);
    }
  }, [ungeotaggedPhotos.length]);

  const buildImportedMemory = useCallback(
    (payload: { lat: number; lng: number; dataUrl: string; dateTaken: string | null }) => {
      const memory = {
        id: crypto.randomUUID(),
        lat: payload.lat,
        lng: payload.lng,
        title: '',
        date: payload.dateTaken ?? new Date().toISOString().slice(0, 10),
        notes: '',
        imageDataUrl: payload.dataUrl,
        imageDataUrls: [payload.dataUrl],
        createdAt: new Date().toISOString(),
        tags: [],
        importedFromPhoto: true,
        nextReviewAt: toISODateString(getFirstReviewDate()),
        reviewCount: 0,
      };
      return memory;
    },
    []
  );

  const processPhoto = useCallback(async (file: File, profile: BulkImportProfile): Promise<ProcessResult> => {
    let lat: number | null = null;
    let lng: number | null = null;
    let dateTaken: string | null = null;
    try {
      const exif = await exifr.parse(file, {
        gps: true,
        tiff: true,
        exif: true,
        pick: ['GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef', 'DateTimeOriginal', 'CreateDate'],
      });
      if (typeof exif?.latitude === 'number' && typeof exif?.longitude === 'number') {
        lat = exif.latitude;
        lng = exif.longitude;
      }
      const rawDate = exif?.DateTimeOriginal || exif?.CreateDate;
      if (rawDate instanceof Date) dateTaken = rawDate.toISOString().split('T')[0] ?? null;
    } catch {
      // EXIF parse errors are treated as missing metadata.
    }
    const dataUrl = await normalizePhonePhotoToDataUrl(file, {
      maxWidth: profile.maxWidth,
      jpegQuality: profile.jpegQuality,
    });
    return { file, dataUrl, lat, lng, dateTaken };
  }, []);

  const runPhotoImport = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter(isLikelyPhotoFile);
      if (!imageFiles.length) return;
      const total = imageFiles.length;
      const profile = getBulkImportProfile(total);
      setProcessingProgress({ done: 0, total });
      const geotaggedLatLngs: Array<[number, number]> = [];
      const nextGeotaggedMemories: Memory[] = [];
      const nextUngeotagged: UngeotaggedPhotoItem[] = [];
      let placed = 0;
      let claimed = 0;
      let completed = 0;

      const worker = async () => {
        while (true) {
          const index = claimed;
          if (index >= total) return;
          claimed += 1;
          const result = await processPhoto(imageFiles[index], profile);
          if (result.lat != null && result.lng != null) {
            const memory = buildImportedMemory({
              lat: result.lat,
              lng: result.lng,
              dataUrl: result.dataUrl,
              dateTaken: result.dateTaken,
            });
            nextGeotaggedMemories.push(memory);
            geotaggedLatLngs.push([result.lat, result.lng]);
            placed += 1;
          } else {
            nextUngeotagged.push({
              id: crypto.randomUUID(),
              fileName: result.file.name,
              dataUrl: result.dataUrl,
              dateTaken: result.dateTaken,
            });
          }
          completed += 1;
          if (completed % profile.progressStep === 0 || completed === total) {
            setProcessingProgress({ done: completed, total });
            // Let React/paint breathe during very large imports.
            await new Promise((resolve) => window.setTimeout(resolve, 0));
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(profile.concurrency, total) }, () => worker())
      );
      if (nextGeotaggedMemories.length) {
        addMemories(nextGeotaggedMemories);
        for (const memory of nextGeotaggedMemories) {
          logStudyMemoryCreated(memory.id);
          if (aiProvider && aiApiKey && aiAutoAnalyze) {
            enqueueAiAnalysis(memory.id);
          }
        }
      }
      setProcessingProgress(null);

      if (geotaggedLatLngs.length > 0 && map) {
        map.fitBounds(
          geotaggedLatLngs,
          { padding: [60, 60], maxZoom: 14 }
        );
      }

      if (nextUngeotagged.length) {
        setUngeotaggedPhotos((prev) => [...prev, ...nextUngeotagged]);
      }

      const missing = nextUngeotagged.length;
      if (placed > 0 && missing === 0) {
        setImportToast({ message: `${placed} photo${placed === 1 ? '' : 's'} placed on the map` });
      } else if (placed > 0 && missing > 0) {
        setImportToast({
          message: `${placed} photos placed · ${missing} had no GPS`,
          actionLabel: `Review ${missing} ungeotagged`,
          action: () => setTrayOpen(true),
        });
      } else {
        setImportToast({
          message: 'No GPS data found in these photos',
          actionLabel: 'Place manually',
          action: () => setTrayOpen(true),
        });
      }
      if (missing > 0) setTrayOpen(true);
    },
    [addMemories, aiApiKey, aiAutoAnalyze, aiProvider, buildImportedMemory, enqueueAiAnalysis, logStudyMemoryCreated, map, processPhoto]
  );

  const placeUngeotaggedPhoto = useCallback(
    (photoId: string, lat: number, lng: number) => {
      const photo = ungeotaggedPhotos.find((p) => p.id === photoId);
      if (!photo) return false;
      const memory = buildImportedMemory({ lat, lng, dataUrl: photo.dataUrl, dateTaken: photo.dateTaken });
      addMemory(memory);
      logStudyMemoryCreated(memory.id);
      if (aiProvider && aiApiKey && aiAutoAnalyze) {
        enqueueAiAnalysis(memory.id);
      }
      setUngeotaggedPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setPlaceModePhotoId(null);
      return true;
    },
    [addMemory, aiApiKey, aiAutoAnalyze, aiProvider, buildImportedMemory, enqueueAiAnalysis, logStudyMemoryCreated, ungeotaggedPhotos]
  );

  const showAddModal = isAddingMemory && pendingLatLng;
  const showEditModal = !!editingMemory;
  const hasOverlay =
    showSplash ||
    onboardingStep !== null ||
    showAddModal ||
    showEditModal ||
    !!selectedMemory ||
    !!recallModalMemoryId ||
    settingsDrawerOpen ||
    memorySearchDrawerOpen;

  useEffect(() => {
    if (hasOverlay) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.inset = '0';
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.position = '';
        document.body.style.inset = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [hasOverlay]);

  const closeAddModal = useCallback(() => {
    setPendingLatLng(null);
    setIsAddingMemory(false);
  }, [setPendingLatLng, setIsAddingMemory]);

  const closeEditModal = useCallback(() => {
    setEditingMemory(null);
  }, [setEditingMemory]);

  const closeMemoryViewer = useCallback(() => {
    if (viewerOpenedFromRecall) {
      const rest = useMemoryStore.getState().recallSessionQueue.slice(1);
      useMemoryStore.getState().setRecallSessionQueue(rest);
      useMemoryStore.getState().setRecallModalMemoryId(rest[0] ?? null);
      if (rest.length === 0) {
        useMemoryStore.getState().endRecallSession();
        useMemoryStore.getState().setRecallMode(null);
      }
      setViewerOpenedFromRecall(false);
    }
    setSelectedMemory(null);
  }, [viewerOpenedFromRecall, setSelectedMemory]);

  const dismissSplash = useCallback(() => {
    setShowSplash(false);
    window.localStorage.setItem(SPLASH_SEEN_STORAGE_KEY, 'true');
    // If onboarding has never been seen, start from the first step after splash.
    if (window.localStorage.getItem(ONBOARDING_SEEN_STORAGE_KEY) !== 'true') {
      setOnboardingStep(0);
    }
  }, []);

  const handleOnboardingNext = useCallback(() => {
    setOnboardingStep((prev) => {
      if (prev == null) return prev;
      const next = prev + 1;
      if (next >= ONBOARDING_STEP_COUNT) {
        window.localStorage.setItem(ONBOARDING_SEEN_STORAGE_KEY, 'true');
        return null;
      }
      return next;
    });
  }, []);

  const handleOnboardingSkip = useCallback(() => {
    window.localStorage.setItem(ONBOARDING_SEEN_STORAGE_KEY, 'true');
    setOnboardingStep(null);
  }, []);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[var(--color-map-water)]"
      id="main-content"
      role="main"
      onDragOver={(e) => {
        const hasImage = Array.from(e.dataTransfer.items ?? []).some((item) => {
          if (item.type.toLowerCase().startsWith('image/')) return true;
          const lower = item.type.toLowerCase();
          return lower.includes('heic') || lower.includes('heif') || lower.includes('avif');
        });
        if (hasImage) {
          e.preventDefault();
          setIsDroppingPhotos(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsDroppingPhotos(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDroppingPhotos(false);
        const trayPhotoId = e.dataTransfer.getData('application/x-temporal-photo-id');
        if (trayPhotoId && map) {
          const rect = map.getContainer().getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const ll = map.containerPointToLatLng([x, y]);
          placeUngeotaggedPhoto(trayPhotoId, ll.lat, ll.lng);
          return;
        }
        const files = Array.from(e.dataTransfer.files).filter(isLikelyPhotoFile);
        if (!files.length) return;
        void runPhotoImport(files);
      }}
    >
      {showSplash && (
        <button
          type="button"
          aria-label="Enter app"
          onClick={dismissSplash}
          className="fixed inset-0 z-[10000] flex cursor-pointer items-center justify-center bg-black/10 p-4 backdrop-blur-lg"
        >
          <img
            src={splashLogo}
            alt="Temporal Self logo"
            className="block h-auto w-full max-w-[min(92vw,860px)] object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.35)]"
          />
          <span className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/35 px-4 py-2 font-mono text-xs uppercase tracking-wider text-white/90">
            Click anywhere to enter
          </span>
        </button>
      )}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[9999] focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:font-mono focus:text-sm focus:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to main content
      </a>
      <MapView
        splashActive={showSplash}
        onboardingActive={onboardingStep !== null}
        onMapClickForPhoto={(latlng) => {
          if (!placeModePhotoId) return false;
          return placeUngeotaggedPhoto(placeModePhotoId, latlng.lat, latlng.lng);
        }}
      />
      <TopControlsBar
        visible={topShelfVisible}
        centerOnViewport={spatialWalkActive}
        onImportPhotos={runPhotoImport}
      />
      {!spatialWalkActive && (
        <>
          <Sidebar tourActive={showSplash || onboardingStep !== null} spatialWalkActive={spatialWalkActive} />
          <LocationSearch />
          <SettingsDrawer />
          <MemorySearchDrawer />
        </>
      )}

      {(showAddModal || showEditModal) && (
        <AddMemoryModal
          key={showAddModal ? 'add' : (editingMemory?.id ?? 'edit')}
          pending={showAddModal ? pendingLatLng : null}
          editingMemory={editingMemory}
          onClose={showEditModal ? closeEditModal : closeAddModal}
        />
      )}

      {selectedMemory && (
        <MemoryViewer
          memory={selectedMemory}
          onClose={closeMemoryViewer}
        />
      )}

      {recallMemory && recallMode !== 'spatial' && (
        <RecallModal
          memory={recallMemory}
          onClose={() => {
            endRecallSession();
            setRecallModalMemoryId(null);
            setRecallMode(null);
          }}
          onShowMemory={(memory) => {
            setViewerOpenedFromRecall(true);
            setSelectedMemory(memory);
            setRecallModalMemoryId(null);
            map?.flyTo([memory.lat, memory.lng], 17, { duration: 0.5 });
          }}
          onAnswered={() => {
            const rest = recallSessionQueue.slice(1);
            setRecallSessionQueue(rest);
            if (rest.length === 0) {
              endRecallSession();
              setRecallMode(null);
            }
            setRecallModalMemoryId(rest[0] ?? null);
          }}
        />
      )}
      {recallMode === 'spatial' && <SpatialWalkOverlay key={recallMemory?.id ?? 'complete'} memory={recallMemory} />}
      {onboardingStep !== null && !showSplash && (
        <OnboardingOverlay
          step={onboardingStep}
          totalSteps={ONBOARDING_STEP_COUNT}
          onNext={handleOnboardingNext}
          onSkip={handleOnboardingSkip}
        />
      )}
      {(isDroppingPhotos || processingProgress) && (
        <div className="pointer-events-none absolute inset-0 z-[1250] flex items-center justify-center bg-[rgba(0,0,0,0.35)]">
          <div className="pointer-events-none text-center text-white">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>
            <p className="text-[18px]">Drop photos to place on map</p>
            <p className="text-[13px] opacity-70">GPS location and date will be read automatically</p>
            {processingProgress && (
              <p className="mt-2 text-[13px]">
                Processing {Math.max(1, processingProgress.done)} of {processingProgress.total} photos...
              </p>
            )}
          </div>
        </div>
      )}
      {importToast && (
        <div className="fixed bottom-4 right-4 z-[1500] rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
          <p className="font-mono text-[12px] text-text-primary">{importToast.message}</p>
          {importToast.action && importToast.actionLabel && (
            <button type="button" onClick={importToast.action} className="mt-1 text-[11px] text-accent hover:underline">
              {importToast.actionLabel}
            </button>
          )}
        </div>
      )}
      <UngeotaggedTray
        photos={ungeotaggedPhotos}
        open={trayOpen}
        placeModeActive={placeModePhotoId != null}
        onClose={() => {
          setTrayOpen(false);
          setPlaceModePhotoId(null);
        }}
        onStartPlaceMode={(photoId) => {
          setTrayOpen(true);
          setPlaceModePhotoId(photoId);
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <MapProvider>
        <AppContent />
      </MapProvider>
    </ErrorBoundary>
  );
}

export default App;
