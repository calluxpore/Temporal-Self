import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Rectangle, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { useMemoryStore } from '../store/memoryStore';
import { MemoryMarker } from './MemoryMarker';
import { MemoryHoverCard } from './MemoryHoverCard';
import { SetMapRef } from './SetMapRef';
import { HeatmapLayer } from './HeatmapLayer';
import type { Memory, Group } from '../types/memory';
import type { SearchHighlight } from '../store/memoryStore';
import { getMemoryLabel } from '../utils/memoryLabel';
import { memoriesInSidebarOrder, compareOrderThenCreatedAt } from '../utils/memoryOrder';
import { filterMemoriesByDate } from '../utils/dateFilter';
import { smoothCurveThroughPoints } from '../utils/timelineCurve';
import { useIsMd } from '../hooks/useMediaQuery';

function ZoomControlPlacement() {
  const map = useMap();
  useEffect(() => {
    const zoom = L.control.zoom({ position: 'bottomright' });
    zoom.addTo(map);
    return () => {
      map.removeControl(zoom);
    };
  }, [map]);
  return null;
}

const pendingPulseIcon = L.divIcon({
  className: 'pending-pulse-wrapper',
  html: '<div class="marker-pulse-ring"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Fix default icon 404s when using react-leaflet (optional, we use divIcon only)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TILE_URLS: Record<'dark' | 'light' | 'satellite' | 'terrain' | 'outdoor', string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  outdoor: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

function MapClickHandler({
  onMapClick,
  onMapMouseMove,
  onMapDragStart,
  onMapZoomStart,
  mapBlurred,
  hintCenterLeft,
}: {
  onMapClick: (latlng: L.LatLng) => void;
  onMapMouseMove?: (e: L.LeafletMouseEvent) => void;
  onMapDragStart?: () => void;
  onMapZoomStart?: () => void;
  mapBlurred: boolean;
  hintCenterLeft: string;
}) {
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMapEvents({
    click(e) {
      const target = e.originalEvent?.target as HTMLElement | undefined;
      if (target?.closest?.('.leaflet-control-container')) return;
      setRipple({ x: e.containerPoint.x, y: e.containerPoint.y });
      onMapClick(e.latlng);
      setTimeout(() => setRipple(null), 650);
    },
    mousemove: (e) => onMapMouseMove?.(e),
    dragstart: () => onMapDragStart?.(),
    zoomstart: () => onMapZoomStart?.(),
    mouseover: () => {
      hoverTimeoutRef.current = setTimeout(() => setHoverTooltip(true), 1000);
    },
    mouseout: () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setHoverTooltip(false);
    },
  });

  return (
    <>
      {ripple && (
        <div
          className="map-click-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 20,
            height: 20,
            marginLeft: -10,
            marginTop: -10,
          }}
        />
      )}
      {hoverTooltip && !mapBlurred && (
        <div
          className="pointer-events-none fixed z-[1000] font-mono text-[10px] tracking-widest text-accent opacity-90"
          style={{
            left: hintCenterLeft,
            bottom: '5.5rem',
            transform: 'translateX(-50%)',
          }}
        >
          CLICK TO PIN MEMORY
        </div>
      )}
    </>
  );
}

const SEARCH_HIGHLIGHT_BLUE = '#3b82f6';
const TIMELINE_COLOR = { dark: '#60a5fa', light: '#2563eb' } as const;

function MapContent({
  memories,
  groups,
  pendingLatLng,
  searchHighlight,
  timelineEnabled,
  hiddenGroupIds,
  theme,
  mapBlurred,
  hintCenterLeft,
  showMarkers,
  visibleMemoryIds,
  onMapClick,
  onMapMouseMove,
  onMapDragStart,
  onMapZoomStart,
  onMarkerHover,
  onMarkerHoverOut,
  onMarkerClick,
}: {
  memories: Memory[];
  groups: Group[];
  pendingLatLng: { lat: number; lng: number } | null;
  searchHighlight: SearchHighlight;
  timelineEnabled: boolean;
  hiddenGroupIds: Set<string>;
  theme: 'dark' | 'light';
  mapBlurred: boolean;
  hintCenterLeft: string;
  showMarkers: boolean;
  visibleMemoryIds: Set<string>;
  onMapClick: (latlng: L.LatLng) => void;
  onMapMouseMove?: (e: L.LeafletMouseEvent) => void;
  onMapDragStart?: () => void;
  onMapZoomStart?: () => void;
  onMarkerHover: (memory: Memory, point: L.Point) => void;
  onMarkerHoverOut: () => void;
  onMarkerClick?: (memory: Memory) => void;
}) {
  const memoryIdToLabel = useMemo(() => {
    const sorted = memoriesInSidebarOrder(memories, groups);
    return new Map(sorted.map((m, i) => [m.id, getMemoryLabel(i)]));
  }, [memories, groups]);
  const sortedVisible = useMemo(
    () => memoriesInSidebarOrder(memories, groups).filter((m) => visibleMemoryIds.has(m.id)),
    [memories, groups, visibleMemoryIds]
  );

  const { timelinePaths, globalRoutePath } = (() => {
    if (!timelineEnabled) return { timelinePaths: [] as [number, number][][], globalRoutePath: null as [number, number][] | null };
    const paths: [number, number][][] = [];
    for (const g of groups) {
      if (hiddenGroupIds.has(g.id)) continue;
      const groupMemories = memories
        .filter((m) => (m.groupId ?? null) === g.id && !(m.hidden ?? false))
        .sort(compareOrderThenCreatedAt);
      if (groupMemories.length < 2) continue;
      const raw = groupMemories.map((m) => [m.lat, m.lng] as [number, number]);
      paths.push(smoothCurveThroughPoints(raw, 16));
    }
    const ungrouped = memories
      .filter((m) => (m.groupId ?? null) === null && !(m.hidden ?? false))
      .sort(compareOrderThenCreatedAt);
    if (ungrouped.length >= 2) {
      const raw = ungrouped.map((m) => [m.lat, m.lng] as [number, number]);
      paths.push(smoothCurveThroughPoints(raw, 16));
    }
    const visibleSorted = memories
      .filter((m) => visibleMemoryIds.has(m.id))
      .sort((a, b) => a.date.localeCompare(b.date) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const globalRaw = visibleSorted.length >= 2 ? visibleSorted.map((m) => [m.lat, m.lng] as [number, number]) : null;
    const globalRoutePath = globalRaw && globalRaw.length >= 2 ? smoothCurveThroughPoints(globalRaw, 16) : null;
    return { timelinePaths: paths, globalRoutePath };
  })();

  return (
    <>
      <MapClickHandler
        onMapClick={onMapClick}
        onMapMouseMove={onMapMouseMove}
        onMapDragStart={onMapDragStart}
        onMapZoomStart={onMapZoomStart}
        mapBlurred={mapBlurred}
        hintCenterLeft={hintCenterLeft}
      />
      {searchHighlight?.type === 'point' && (
        <CircleMarker
          center={[searchHighlight.lat, searchHighlight.lng]}
          radius={10}
          pathOptions={{
            color: SEARCH_HIGHLIGHT_BLUE,
            fillColor: SEARCH_HIGHLIGHT_BLUE,
            fillOpacity: 0.9,
            weight: 2,
            interactive: false,
          }}
        />
      )}
      {searchHighlight?.type === 'area' && (
        <Rectangle
          bounds={[
            [searchHighlight.bbox[0], searchHighlight.bbox[2]],
            [searchHighlight.bbox[1], searchHighlight.bbox[3]],
          ]}
          pathOptions={{
            color: SEARCH_HIGHLIGHT_BLUE,
            fillColor: SEARCH_HIGHLIGHT_BLUE,
            fillOpacity: 0.25,
            weight: 2,
            dashArray: '8 6',
            interactive: false,
          }}
        />
      )}
      {timelinePaths.map((positions, i) => (
        <Polyline
          key={`timeline-${i}-${positions.length}`}
          positions={positions}
          pathOptions={{
            color: TIMELINE_COLOR[theme],
            weight: 2,
            opacity: 0.9,
            dashArray: '8 6',
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
          }}
        />
      ))}
      {globalRoutePath && globalRoutePath.length >= 2 && (
        <Polyline
          key="global-route"
          positions={globalRoutePath}
          pathOptions={{
            color: TIMELINE_COLOR[theme],
            weight: 2,
            opacity: 0.75,
            dashArray: '8 6',
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
          }}
        />
      )}
      {pendingLatLng && (
        <Marker
          position={[pendingLatLng.lat, pendingLatLng.lng]}
          icon={pendingPulseIcon}
          zIndexOffset={500}
          interactive={false}
        />
      )}
      {showMarkers && (
        <MarkerClusterGroup
          iconCreateFunction={(cluster: { getChildCount: () => number }) => {
            const count = cluster.getChildCount();
            return L.divIcon({
              html: `<span class="memory-cluster-count">${count}</span>`,
              className: 'memory-cluster-icon',
              iconSize: L.point(36, 36),
              iconAnchor: [18, 18],
            });
          }}
        >
          {sortedVisible.map((m) => (
            <MemoryMarker
              key={m.id}
              memory={m}
              label={m.customLabel?.trim() || memoryIdToLabel.get(m.id)}
              onMouseOver={onMarkerHover}
              onMouseOut={onMarkerHoverOut}
              onClick={onMarkerClick}
            />
          ))}
        </MarkerClusterGroup>
      )}
    </>
  );
}

const HOVER_HIDE_DELAY_MS = 150;

function usePrefersHover() {
  const [prefersHover, setPrefersHover] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : false
  );
  useEffect(() => {
    const m = window.matchMedia('(hover: hover)');
    setPrefersHover(m.matches);
    const fn = () => setPrefersHover(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);
  return prefersHover;
}

export function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const hoverHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When true, the card was shown from sidebar click; don't hide it on mouse leave. */
  const cardPinnedBySidebarRef = useRef(false);
  const [hoveredMemory, setHoveredMemory] = useState<Memory | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const prefersHover = usePrefersHover();
  const isMd = useIsMd();
  const sidebarOpen = useMemoryStore((s) => s.sidebarOpen);

  const memories = useMemoryStore((s) => s.memories);
  const filterStarred = useMemoryStore((s) => s.filterStarred);
  const dateFilterFrom = useMemoryStore((s) => s.dateFilterFrom);
  const dateFilterTo = useMemoryStore((s) => s.dateFilterTo);
  const heatmapEnabled = useMemoryStore((s) => s.heatmapEnabled);
  const markersVisible = useMemoryStore((s) => s.markersVisible);
  const visibleMemories = useMemo(() => {
    let list = filterStarred ? memories.filter((m) => m.starred) : memories;
    list = filterMemoriesByDate(list, dateFilterFrom, dateFilterTo);
    return list;
  }, [memories, filterStarred, dateFilterFrom, dateFilterTo]);
  const groups = useMemoryStore((s) => s.groups);
  const theme = useMemoryStore((s) => s.theme);
  const sidebarWidth = useMemoryStore((s) => s.sidebarWidth);
  const pendingLatLng = useMemoryStore((s) => s.pendingLatLng);
  const searchHighlight = useMemoryStore((s) => s.searchHighlight);
  const timelineEnabled = useMemoryStore((s) => s.timelineEnabled);
  const isAddingMemory = useMemoryStore((s) => s.isAddingMemory);

  const hintCenterLeft =
    isMd && sidebarOpen
      ? `calc(${sidebarWidth}px + (100vw - ${sidebarWidth}px) / 2)`
      : '50%';
  const setPendingLatLng = useMemoryStore((s) => s.setPendingLatLng);
  const setSearchHighlight = useMemoryStore((s) => s.setSearchHighlight);
  const setIsAddingMemory = useMemoryStore((s) => s.setIsAddingMemory);
  const setEditingMemory = useMemoryStore((s) => s.setEditingMemory);
  const cardTargetMemoryId = useMemoryStore((s) => s.cardTargetMemoryId);
  const setCardTargetMemoryId = useMemoryStore((s) => s.setCardTargetMemoryId);

  const mapBlurred = isAddingMemory;
  const hiddenGroupIds = useMemo(
    () => new Set(groups.filter((g) => g.hidden).map((g) => g.id)),
    [groups]
  );
  const visibleMemoryIds = useMemo(() => {
    const hidden = new Set(groups.filter((g) => g.hidden).map((g) => g.id));
    return new Set(
      visibleMemories
        .filter((m) => !(m.hidden ?? false))
        .filter((m) => {
          const gid = m.groupId ?? null;
          return gid === null || !hidden.has(gid);
        })
        .map((m) => m.id)
    );
  }, [visibleMemories, groups]);
  const tileUrl = theme === 'dark' ? TILE_URLS.dark : TILE_URLS.light;

  const closeHoverCard = useCallback(() => {
    cardPinnedBySidebarRef.current = false;
    if (hoverHideTimeoutRef.current) {
      clearTimeout(hoverHideTimeoutRef.current);
      hoverHideTimeoutRef.current = null;
    }
    setHoveredMemory(null);
    setHoverPoint(null);
  }, []);

  const onMapClick = useCallback(
    (latlng: L.LatLng) => {
      closeHoverCard();
      setSearchHighlight(null);
      setPendingLatLng({ lat: latlng.lat, lng: latlng.lng });
      setIsAddingMemory(true);
    },
    [closeHoverCard, setSearchHighlight, setPendingLatLng, setIsAddingMemory]
  );

  const onMarkerHover = useCallback(
    (memory: Memory, point: L.Point) => {
      if (!prefersHover) return;
      if (hoverHideTimeoutRef.current) {
        clearTimeout(hoverHideTimeoutRef.current);
        hoverHideTimeoutRef.current = null;
      }
      setHoveredMemory(memory);
      setHoverPoint({ x: point.x, y: point.y });
    },
    [prefersHover]
  );

  const onMarkerHoverOut = useCallback(() => {
    if (cardPinnedBySidebarRef.current) return;
    hoverHideTimeoutRef.current = setTimeout(() => {
      setHoveredMemory(null);
      setHoverPoint(null);
      hoverHideTimeoutRef.current = null;
    }, HOVER_HIDE_DELAY_MS);
  }, []);

  const onMapMouseMove = useCallback((e: L.LeafletMouseEvent) => {
    if (cardPinnedBySidebarRef.current) return;
    const target = e.originalEvent?.target as HTMLElement | undefined;
    if (!target?.closest?.('.memory-marker-wrapper')) {
      if (hoverHideTimeoutRef.current) clearTimeout(hoverHideTimeoutRef.current);
      hoverHideTimeoutRef.current = setTimeout(() => {
        setHoveredMemory(null);
        setHoverPoint(null);
        hoverHideTimeoutRef.current = null;
      }, HOVER_HIDE_DELAY_MS);
    }
  }, []);

  const onMapDragStart = useCallback(() => closeHoverCard(), [closeHoverCard]);
  const onMapZoomStart = useCallback(() => closeHoverCard(), [closeHoverCard]);

  const onMarkerClick = useCallback(
    (memory: Memory) => {
      closeHoverCard();
      setEditingMemory(memory);
    },
    [closeHoverCard, setEditingMemory]
  );

  const onCardMouseEnter = useCallback(() => {
    if (hoverHideTimeoutRef.current) {
      clearTimeout(hoverHideTimeoutRef.current);
      hoverHideTimeoutRef.current = null;
    }
  }, []);

  const onCardMouseLeave = useCallback(() => {
    if (cardPinnedBySidebarRef.current) return;
    setHoveredMemory(null);
    setHoverPoint(null);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverHideTimeoutRef.current) clearTimeout(hoverHideTimeoutRef.current);
    };
  }, []);

  // When sidebar selects a memory, flyTo is done by Sidebar; we show the card when the map finishes moving.
  useEffect(() => {
    if (!cardTargetMemoryId) return;
    const map = mapRef.current;
    if (!map) return;
    const memory = visibleMemories.find((m) => m.id === cardTargetMemoryId);
    if (!memory) return;
    const onMoveEnd = () => {
      cardPinnedBySidebarRef.current = true;
      const point = map.latLngToContainerPoint([memory.lat, memory.lng]);
      setHoveredMemory(memory);
      setHoverPoint({ x: point.x, y: point.y });
      setCardTargetMemoryId(null);
    };
    map.once('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [cardTargetMemoryId, visibleMemories, setCardTargetMemoryId]);

  return (
    <div
      className={`absolute inset-0 transition-[filter] duration-300 ${
        mapBlurred ? 'filter blur-[4px]' : ''
      }`}
    >
      <MapContainer
        ref={useCallback((r: L.Map | null) => {
          mapRef.current = r ?? null;
        }, [])}
        center={[43.6532, -79.3832]}
        zoom={11}
        className="h-full w-full animate-map-in opacity-0"
        style={{ cursor: 'crosshair' }}
        zoomControl={false}
      >
        <SetMapRef />
        <ZoomControlPlacement />
        <TileLayer url={tileUrl} />
        <HeatmapLayer memories={visibleMemories} enabled={heatmapEnabled} />
        <MapContent
          memories={visibleMemories}
          groups={groups}
          pendingLatLng={pendingLatLng}
          searchHighlight={searchHighlight}
          timelineEnabled={timelineEnabled}
          hiddenGroupIds={hiddenGroupIds}
          theme={theme}
          mapBlurred={mapBlurred}
          hintCenterLeft={hintCenterLeft}
          showMarkers={markersVisible}
          visibleMemoryIds={visibleMemoryIds}
          onMapClick={onMapClick}
          onMapMouseMove={onMapMouseMove}
          onMapDragStart={onMapDragStart}
          onMapZoomStart={onMapZoomStart}
          onMarkerHover={onMarkerHover}
          onMarkerHoverOut={onMarkerHoverOut}
          onMarkerClick={onMarkerClick}
        />
      </MapContainer>
      {hoveredMemory && hoverPoint && (
        <MemoryHoverCard
          memory={hoveredMemory}
          point={hoverPoint}
          onMouseEnter={onCardMouseEnter}
          onMouseLeave={onCardMouseLeave}
          onClick={() => {
            setEditingMemory(hoveredMemory);
            closeHoverCard();
          }}
        />
      )}
    </div>
  );
}
