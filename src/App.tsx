import { useCallback, useEffect, useState } from 'react';
import { useMemoryStore } from './store/memoryStore';
import { MapProvider } from './context/MapContext';
import { useMapRef } from './context/mapContextState';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { AddMemoryModal } from './components/AddMemoryModal';
import { MemoryViewer } from './components/MemoryViewer';
import { ThemeToggle } from './components/ThemeToggle';
import { RecallButton } from './components/RecallButton';
import { ResetButton } from './components/ResetButton';
import { RecallModal } from './components/RecallModal';
import { TimelineToggle } from './components/TimelineToggle';
import { TimelineLineStyleToggle } from './components/TimelineLineStyleToggle';
import { HeatmapToggle } from './components/HeatmapToggle';
import { MarkersToggle } from './components/MarkersToggle';
import { FavoritesToggle } from './components/FavoritesToggle';
import { ExportImportButtons } from './components/ExportImportButtons';
import { LocationSearch } from './components/LocationSearch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnboardingOverlay, ONBOARDING_STEP_COUNT } from './components/OnboardingOverlay';
import splashLogo from '../_assets/TS_Logo.png';

const SPLASH_SEEN_STORAGE_KEY = 'temporal-self-splash-seen';
const ONBOARDING_SEEN_STORAGE_KEY = 'temporal-self-onboarding-seen';

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
  const setRecallModalMemoryId = useMemoryStore((s) => s.setRecallModalMemoryId);
  const recallSessionQueue = useMemoryStore((s) => s.recallSessionQueue);
  const setRecallSessionQueue = useMemoryStore((s) => s.setRecallSessionQueue);
  const endRecallSession = useMemoryStore((s) => s.endRecallSession);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SPLASH_SEEN_STORAGE_KEY) !== 'true';
  });
  const recallMemory = useMemoryStore((s) =>
    recallModalMemoryId ? s.memories.find((m) => m.id === recallModalMemoryId) ?? null : null
  );
  const [viewerOpenedFromRecall, setViewerOpenedFromRecall] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);

  const onRequestNewMemory = useCallback(() => {
    if (map) {
      const center = map.getCenter();
      setPendingLatLng({ lat: center.lat, lng: center.lng });
      setIsAddingMemory(true);
    }
  }, [map, setPendingLatLng, setIsAddingMemory]);

  useKeyboardShortcuts(onRequestNewMemory);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const showAddModal = isAddingMemory && pendingLatLng;
  const showEditModal = !!editingMemory;
  const hasOverlay =
    showSplash ||
    onboardingStep !== null ||
    showAddModal ||
    showEditModal ||
    !!selectedMemory ||
    !!recallModalMemoryId;

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
      if (rest.length === 0) useMemoryStore.getState().endRecallSession();
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
    <div className="relative h-full w-full overflow-hidden bg-[var(--color-map-water)]" id="main-content" role="main">
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
      <MapView splashActive={showSplash} onboardingActive={onboardingStep !== null} />
      <Sidebar />
      <LocationSearch />
      <ThemeToggle />
      <RecallButton />
      <ResetButton />
      <TimelineLineStyleToggle />
      <TimelineToggle />
      <HeatmapToggle />
      <MarkersToggle />
      <FavoritesToggle />
      <ExportImportButtons />

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

      {recallMemory && (
        <RecallModal
          memory={recallMemory}
          onClose={() => {
            endRecallSession();
            setRecallModalMemoryId(null);
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
            if (rest.length === 0) endRecallSession();
            setRecallModalMemoryId(rest[0] ?? null);
          }}
        />
      )}
      {onboardingStep !== null && !showSplash && (
        <OnboardingOverlay
          step={onboardingStep}
          totalSteps={ONBOARDING_STEP_COUNT}
          onNext={handleOnboardingNext}
          onSkip={handleOnboardingSkip}
        />
      )}
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
