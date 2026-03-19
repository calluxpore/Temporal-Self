import { useCallback, useEffect, useState } from 'react';
import { useMemoryStore } from './store/memoryStore';
import { MapProvider } from './context/MapContext';
import { useMapRef } from './context/MapContext';
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
import { HeatmapToggle } from './components/HeatmapToggle';
import { MarkersToggle } from './components/MarkersToggle';
import { FavoritesToggle } from './components/FavoritesToggle';
import { ExportImportButtons } from './components/ExportImportButtons';
import { LocationSearch } from './components/LocationSearch';
import { ErrorBoundary } from './components/ErrorBoundary';

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
  const recallMemory = useMemoryStore((s) =>
    recallModalMemoryId ? s.memories.find((m) => m.id === recallModalMemoryId) ?? null : null
  );
  const [viewerOpenedFromRecall, setViewerOpenedFromRecall] = useState(false);

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
  const hasOverlay = showAddModal || showEditModal || !!selectedMemory || !!recallModalMemoryId;

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
  }, [viewerOpenedFromRecall]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--color-map-water)]" id="main-content" role="main">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[9999] focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:font-mono focus:text-sm focus:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to main content
      </a>
      <MapView />
      <Sidebar />
      <LocationSearch />
      <ThemeToggle />
      <RecallButton />
      <ResetButton />
      <TimelineToggle />
      <HeatmapToggle />
      <MarkersToggle />
      <FavoritesToggle />
      <ExportImportButtons />

      {(showAddModal || showEditModal) && (
        <AddMemoryModal
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
