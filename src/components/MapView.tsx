import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Rectangle, Polyline, Circle, GeoJSON, useMapEvents, useMap } from 'react-leaflet';
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
import { MoodHeatmapLayer } from './MoodHeatmapLayer';
import type { Memory, Group } from '../types/memory';
import type { SearchHighlight } from '../store/memoryStore';
import { getMemoryLabel } from '../utils/memoryLabel';
import { memoriesInSidebarOrder, compareOrderThenCreatedAt } from '../utils/memoryOrder';
import { filterMemoriesByDate } from '../utils/dateFilter';
import { smoothCurveThroughPoints } from '../utils/timelineCurve';
import { buildOrthogonalRoute } from '../utils/timelineOrthogonal';
import { useChromeCenterLeft } from '../hooks/useChromeCenterLeft';
import { buildRadiusCircleLayers } from '../utils/radiusCircleMerge';

/** Bottom-right: zoom added first (toward corner), locate second so it stacks above the +/- bar. */
function LocateAndZoomControls() {
  const map = useMap();
  const setMapView = useMemoryStore((s) => s.setMapView);

  useEffect(() => {
    const locateSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12h3.5M18 12h3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

    const LocateControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd(mapInstance: L.Map) {
        const wrapper = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-locate');
        const btn = L.DomUtil.create('a', 'leaflet-control-locate-btn', wrapper);
        btn.href = '#';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Center map on your location');
        btn.title = 'My location';
        btn.innerHTML = locateSvg;

        L.DomEvent.disableClickPropagation(wrapper);

        L.DomEvent.on(btn, 'click', (domEvent) => {
          L.DomEvent.stop(domEvent);
          if (!navigator.geolocation) {
            btn.title = 'Geolocation not available';
            window.setTimeout(() => {
              btn.title = 'My location';
            }, 2500);
            return;
          }
          btn.classList.add('leaflet-control-locate-pending');
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              btn.classList.remove('leaflet-control-locate-pending');
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              const zoom = Math.max(mapInstance.getZoom(), 14);
              mapInstance.setView([lat, lng], zoom, { animate: true });
              setMapView({ lat, lng, zoom });
            },
            () => {
              btn.classList.remove('leaflet-control-locate-pending');
              btn.title = 'Could not get location';
              window.setTimeout(() => {
                btn.title = 'My location';
              }, 2500);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
          );
        });

        return wrapper;
      },
    });

    const zoom = L.control.zoom({ position: 'bottomright' });
    const locate = new LocateControl();
    zoom.addTo(map);
    locate.addTo(map);
    return () => {
      map.removeControl(locate);
      map.removeControl(zoom);
    };
  }, [map, setMapView]);

  return null;
}

const pendingPulseIcon = L.divIcon({
  className: 'pending-pulse-wrapper',
  html: '<div class="marker-pulse-ring"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const dragFocusIcon = L.divIcon({
  className: 'drag-focus-icon',
  html: '<div class="drag-focus-cross" />',
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
const CUSTOM_STYLE_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DEFAULT_CENTER: [number, number] = [43.6532, -79.3832];
const DEFAULT_ZOOM = 11;

function MapClickHandler({
  onMapClick,
  onMapBackgroundClick,
  onMapMouseMove,
  onMapDragStart,
  onMapZoomStart,
  mapBlurred,
  hidePinHint = false,
  hintCenterLeft,
}: {
  onMapClick: (latlng: L.LatLng, originalEvent?: MouseEvent) => void;
  onMapBackgroundClick?: () => void;
  onMapMouseMove?: (e: L.LeafletMouseEvent) => void;
  onMapDragStart?: () => void;
  onMapZoomStart?: () => void;
  mapBlurred: boolean;
  hidePinHint?: boolean;
  hintCenterLeft: string;
}) {
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditModeOpen = useMemoryStore((s) => s.editingMemory != null);
  const isAddMemoryOpen = useMemoryStore((s) => s.isAddingMemory && s.pendingLatLng != null);
  const settingsDrawerOpen = useMemoryStore((s) => s.settingsDrawerOpen);
  const setSettingsDrawerOpen = useMemoryStore((s) => s.setSettingsDrawerOpen);
  const memorySearchDrawerOpen = useMemoryStore((s) => s.memorySearchDrawerOpen);
  const setMemorySearchDrawerOpen = useMemoryStore((s) => s.setMemorySearchDrawerOpen);
  const recallModalMemoryId = useMemoryStore((s) => s.recallModalMemoryId);
  const setRecallModalMemoryId = useMemoryStore((s) => s.setRecallModalMemoryId);
  const setRecallMode = useMemoryStore((s) => s.setRecallMode);
  const endRecallSession = useMemoryStore((s) => s.endRecallSession);

  useMapEvents({
    click(e) {
      const target = e.originalEvent?.target as HTMLElement | undefined;
      if (target?.closest?.('.leaflet-control-container')) return;
      if (e.originalEvent?.ctrlKey) return;

      // Settings drawer: first map click only closes it; next click can pin a new memory.
      if (settingsDrawerOpen) {
        setSettingsDrawerOpen(false);
        return;
      }

      if (memorySearchDrawerOpen) {
        setMemorySearchDrawerOpen(false);
        return;
      }

      if (recallModalMemoryId) {
        endRecallSession();
        setRecallModalMemoryId(null);
        setRecallMode(null);
        return;
      }

      // Editing or creating a memory: map background closes the side drawer instead of starting another pin.
      if (isEditModeOpen || isAddMemoryOpen) {
        if (target?.closest?.('.memory-marker-wrapper, .memory-hover-card')) return;
        onMapBackgroundClick?.();
        return;
      }

      setRipple({ x: e.containerPoint.x, y: e.containerPoint.y });
      onMapClick(e.latlng, e.originalEvent);
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
      {hoverTooltip && !mapBlurred && !hidePinHint && (
        <div
          className="pointer-events-none fixed z-[1000] font-mono text-[10px] tracking-widest text-accent opacity-90 transition-[left] duration-300"
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
const MEMORY_RADIUS_METERS = 2000;

function MapContent({
  memories,
  groups,
  pendingLatLng,
  searchHighlight,
  timelineEnabled,
  timelineLineStyle,
  hiddenGroupIds,
  theme,
  mapBlurred,
  hidePinHint,
  hintCenterLeft,
  showMarkers,
  showRadiusCircles,
  pendingRadiusPreview,
  visibleMemoryIds,
  memorySearchMatchSet,
  onMapClick,
  onMapBackgroundClick,
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
  timelineLineStyle: 'spline' | 'orthogonal';
  hiddenGroupIds: Set<string>;
  theme: 'dark' | 'light';
  mapBlurred: boolean;
  hidePinHint: boolean;
  hintCenterLeft: string;
  showMarkers: boolean;
  showRadiusCircles: boolean;
  /** Pending click position while adding a memory — included in radius merge preview. */
  pendingRadiusPreview: { lat: number; lng: number } | null;
  visibleMemoryIds: Set<string>;
  memorySearchMatchSet: Set<string> | null;
  onMapClick: (latlng: L.LatLng) => void;
  onMapBackgroundClick?: () => void;
  onMapMouseMove?: (e: L.LeafletMouseEvent) => void;
  onMapDragStart?: () => void;
  onMapZoomStart?: () => void;
  onMarkerHover: (memory: Memory, point: L.Point) => void;
  onMarkerHoverOut: () => void;
  onMarkerClick?: (memory: Memory) => void;
}) {
  const map = useMap();
  const memoryIdToLabel = useMemo(() => {
    const labels = new Map<string, string>();
    const visible = memories.filter((m) => visibleMemoryIds.has(m.id));
    const groupedVisible = visible.filter((m) => (m.groupId ?? null) !== null);
    const ungroupedVisible = visible.filter((m) => (m.groupId ?? null) === null).sort(compareOrderThenCreatedAt);

    // Suffix from group order in `groups` (stable while group exists). Hiding a group on the map
    // must not renumber other groups; deleting a group removes its slot and may renumber.
    groups.forEach((g, groupIndex) => {
      const inGroup = groupedVisible
        .filter((m) => (m.groupId ?? null) === g.id)
        .sort(compareOrderThenCreatedAt);
      if (inGroup.length === 0) return;
      const suffix = String(groupIndex + 1);
      inGroup.forEach((m, i) => labels.set(m.id, `${getMemoryLabel(i)}${suffix}`));
    });

    // Keep ungrouped independent as well.
    ungroupedVisible.forEach((m, i) => labels.set(m.id, getMemoryLabel(i)));
    return labels;
  }, [memories, groups, visibleMemoryIds]);
  const sortedVisible = useMemo(
    () => memoriesInSidebarOrder(memories, groups).filter((m) => visibleMemoryIds.has(m.id)),
    [memories, groups, visibleMemoryIds]
  );

  const radiusCircleLayers = useMemo(() => {
    if (!showRadiusCircles) return null;
    return buildRadiusCircleLayers(sortedVisible, MEMORY_RADIUS_METERS, {
      previewLatLng: pendingRadiusPreview,
    });
  }, [showRadiusCircles, sortedVisible, pendingRadiusPreview]);

  const { timelinePaths, routeStartIds, routeEndIds } = (() => {
    if (!timelineEnabled)
      return {
        timelinePaths: [] as [number, number][][],
        routeStartIds: new Set<string>(),
        routeEndIds: new Set<string>(),
      };

    const makePositions = (raw: [number, number][]) =>
      timelineLineStyle === 'spline' ? smoothCurveThroughPoints(raw, 16) : buildOrthogonalRoute(map, raw, { radiusPx: 12, arcSegments: 6 });

    const paths: [number, number][][] = [];
    const routeStartIds = new Set<string>();
    const routeEndIds = new Set<string>();
    for (const g of groups) {
      if (hiddenGroupIds.has(g.id)) continue;
      const groupMemories = memories
        .filter((m) => (m.groupId ?? null) === g.id && !(m.hidden ?? false))
        .sort(compareOrderThenCreatedAt);
      if (groupMemories.length < 2) continue;
      const raw = groupMemories.map((m) => [m.lat, m.lng] as [number, number]);
      paths.push(makePositions(raw));
      routeStartIds.add(groupMemories[0].id);
      routeEndIds.add(groupMemories[groupMemories.length - 1].id);
    }
    const ungrouped = memories
      .filter((m) => (m.groupId ?? null) === null && !(m.hidden ?? false))
      .sort(compareOrderThenCreatedAt);
    if (ungrouped.length >= 2) {
      const raw = ungrouped.map((m) => [m.lat, m.lng] as [number, number]);
      paths.push(makePositions(raw));
      routeStartIds.add(ungrouped[0].id);
      routeEndIds.add(ungrouped[ungrouped.length - 1].id);
    }
    return { timelinePaths: paths, routeStartIds, routeEndIds };
  })();

  return (
    <>
      <MapClickHandler
        onMapClick={onMapClick}
        onMapBackgroundClick={onMapBackgroundClick}
        onMapMouseMove={onMapMouseMove}
        onMapDragStart={onMapDragStart}
        onMapZoomStart={onMapZoomStart}
        mapBlurred={mapBlurred}
        hidePinHint={hidePinHint}
        hintCenterLeft={hintCenterLeft}
      />
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
          key={`timeline-${i}`}
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
      {pendingLatLng && (
        <Marker
          position={[pendingLatLng.lat, pendingLatLng.lng]}
          icon={pendingPulseIcon}
          zIndexOffset={500}
          interactive={false}
        />
      )}
      {showRadiusCircles &&
        radiusCircleLayers &&
        radiusCircleLayers.merged.map((layer) => (
          <GeoJSON
            key={layer.key}
            data={layer.feature}
            pathOptions={{
              color: theme === 'dark' ? '#93c5fd' : '#2563eb',
              weight: 1.5,
              opacity: 0.55,
              fillColor: theme === 'dark' ? '#60a5fa' : '#3b82f6',
              fillOpacity: 0.08,
              interactive: false,
            }}
          />
        ))}
      {showRadiusCircles &&
        radiusCircleLayers &&
        radiusCircleLayers.individual.map((m) => (
          <Circle
            key={`radius-${m.id}`}
            center={[m.lat, m.lng]}
            radius={MEMORY_RADIUS_METERS}
            pathOptions={{
              color: theme === 'dark' ? '#93c5fd' : '#2563eb',
              weight: 1.5,
              opacity: 0.55,
              fillColor: theme === 'dark' ? '#60a5fa' : '#3b82f6',
              fillOpacity: 0.08,
              interactive: false,
            }}
          />
        ))}
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
              routeRole={routeEndIds.has(m.id) ? 'end' : routeStartIds.has(m.id) ? 'start' : undefined}
              searchHit={memorySearchMatchSet?.has(m.id) ?? false}
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
    const fn = () => setPrefersHover(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);
  return prefersHover;
}

export function MapView({
  splashActive = false,
  onboardingActive = false,
  onMapClickForPhoto,
}: {
  splashActive?: boolean;
  onboardingActive?: boolean;
  onMapClickForPhoto?: (latlng: L.LatLng) => boolean;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const hoverHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When true, the card was shown from sidebar click; don't hide it on mouse leave. */
  const cardPinnedBySidebarRef = useRef(false);
  const [hoveredMemory, setHoveredMemory] = useState<Memory | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragFocusLatLng, setDragFocusLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [draggingMemoryId, setDraggingMemoryId] = useState<string | null>(null);
  const isDraggingMemory = draggingMemoryId != null;
  const isDraggingMemoryRef = useRef(false);
  const draggingMemoryIdRef = useRef<string | null>(null);
  const grabDeltaRef = useRef<{ dx: number; dy: number } | null>(null);
  const dragContainerRectRef = useRef<DOMRect | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingDragRef = useRef<{ lat: number; lng: number; x: number; y: number } | null>(null);
  const suppressCardClickRef = useRef(false);
  const suppressMapClickUntilRef = useRef(0);
  const selectionDragRef = useRef<{
    pointerId: number;
    start: L.Point;
    addToSelection: boolean;
  } | null>(null);
  const prefersHover = usePrefersHover();
  const mapView = useMemoryStore((s) => s.mapView);
  const hasChosenStartLocation = useMemoryStore((s) => s.hasChosenStartLocation);
  const setMapView = useMemoryStore((s) => s.setMapView);
  const setHasChosenStartLocation = useMemoryStore((s) => s.setHasChosenStartLocation);
  const showStartLocationPrompt = !splashActive && !onboardingActive && !hasChosenStartLocation && !mapView;

  const memories = useMemoryStore((s) => s.memories);
  const filterStarred = useMemoryStore((s) => s.filterStarred);
  const dateFilterFrom = useMemoryStore((s) => s.dateFilterFrom);
  const dateFilterTo = useMemoryStore((s) => s.dateFilterTo);
  const heatmapEnabled = useMemoryStore((s) => s.heatmapEnabled);
  const moodHeatmapEnabled = useMemoryStore((s) => s.moodHeatmapEnabled);
  const markersVisible = useMemoryStore((s) => s.markersVisible);
  const radiusCirclesEnabled = useMemoryStore((s) => s.radiusCirclesEnabled);
  const visibleMemories = useMemo(() => {
    let list = filterStarred ? memories.filter((m) => m.starred) : memories;
    list = filterMemoriesByDate(list, dateFilterFrom, dateFilterTo);
    return list;
  }, [memories, filterStarred, dateFilterFrom, dateFilterTo]);

  const hoveredMemoryLive = useMemo(() => {
    if (!hoveredMemory) return null;
    return visibleMemories.find((m) => m.id === hoveredMemory.id) ?? hoveredMemory;
  }, [hoveredMemory, visibleMemories]);
  const groups = useMemoryStore((s) => s.groups);
  const theme = useMemoryStore((s) => s.theme);
  const mapStyle = useMemoryStore((s) => s.mapStyle);
  const pendingLatLng = useMemoryStore((s) => s.pendingLatLng);
  const recallMode = useMemoryStore((s) => s.recallMode);
  const searchHighlight = useMemoryStore((s) => s.searchHighlight);
  const timelineEnabled = useMemoryStore((s) => s.timelineEnabled);
  const timelineLineStyle = useMemoryStore((s) => s.timelineLineStyle);
  const isAddingMemory = useMemoryStore((s) => s.isAddingMemory);
  const pushUndo = useMemoryStore((s) => s.pushUndo);
  const updateMemoryWithoutUndo = useMemoryStore((s) => s.updateMemoryWithoutUndo);
  const selectedMemoryIds = useMemoryStore((s) => s.selectedMemoryIds);
  const setSelection = useMemoryStore((s) => s.setSelection);
  const bulkDelete = useMemoryStore((s) => s.bulkDelete);
  const skipDeleteConfirmation = useMemoryStore((s) => s.skipDeleteConfirmation);
  const [selectionRectPx, setSelectionRectPx] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const hintCenterLeft = useChromeCenterLeft();
  const setPendingLatLng = useMemoryStore((s) => s.setPendingLatLng);
  const setSearchHighlight = useMemoryStore((s) => s.setSearchHighlight);
  const setIsAddingMemory = useMemoryStore((s) => s.setIsAddingMemory);
  const setEditingMemory = useMemoryStore((s) => s.setEditingMemory);
  const cardTargetMemoryId = useMemoryStore((s) => s.cardTargetMemoryId);
  const setCardTargetMemoryId = useMemoryStore((s) => s.setCardTargetMemoryId);

  const mapBlurred = isAddingMemory;
  const spatialWalkActive = recallMode === 'spatial';
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
  const memorySearchMatchIds = useMemoryStore((s) => s.memorySearchMatchIds);
  const memorySearchMatchSet = useMemo(() => {
    if (!memorySearchMatchIds?.length) return null;
    return new Set(memorySearchMatchIds);
  }, [memorySearchMatchIds]);
  const tileUrl =
    mapStyle === 'watercolor'
      ? CUSTOM_STYLE_TILE_URL
      : theme === 'dark'
        ? TILE_URLS.dark
        : TILE_URLS.light;

  const hasSelection = selectedMemoryIds.length > 0;

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
    (latlng: L.LatLng, originalEvent?: MouseEvent) => {
      if (originalEvent?.ctrlKey) return;
      if (Date.now() < suppressMapClickUntilRef.current) return;
      if (isDraggingMemoryRef.current) return;
      if (onMapClickForPhoto?.(latlng)) return;
      closeHoverCard();
      setSearchHighlight(null);
      setPendingLatLng({ lat: latlng.lat, lng: latlng.lng });
      setIsAddingMemory(true);
    },
    [closeHoverCard, onMapClickForPhoto, setSearchHighlight, setPendingLatLng, setIsAddingMemory]
  );

  const onMarkerHover = useCallback(
    (memory: Memory, point: L.Point) => {
      if (spatialWalkActive) return;
      if (!prefersHover) return;
      if (hoverHideTimeoutRef.current) {
        clearTimeout(hoverHideTimeoutRef.current);
        hoverHideTimeoutRef.current = null;
      }
      setHoveredMemory(memory);
      setHoverPoint({ x: point.x, y: point.y });
    },
    [prefersHover, spatialWalkActive]
  );

  const onMarkerHoverOut = useCallback(() => {
    if (spatialWalkActive) return;
    if (isDraggingMemoryRef.current) return;
    if (cardPinnedBySidebarRef.current) return;
    hoverHideTimeoutRef.current = setTimeout(() => {
      setHoveredMemory(null);
      setHoverPoint(null);
      hoverHideTimeoutRef.current = null;
    }, HOVER_HIDE_DELAY_MS);
  }, [spatialWalkActive]);

  const onMapMouseMove = useCallback((e: L.LeafletMouseEvent) => {
    if (isDraggingMemoryRef.current) return;
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

  const onMapDragStart = useCallback(() => {
    if (isDraggingMemoryRef.current) return;
    closeHoverCard();
  }, [closeHoverCard]);
  const onMapZoomStart = useCallback(() => {
    if (isDraggingMemoryRef.current) return;
    closeHoverCard();
  }, [closeHoverCard]);

  const onMarkerClick = useCallback(
    (memory: Memory) => {
      if (spatialWalkActive) return;
      closeHoverCard();
      setEditingMemory(memory);
    },
    [closeHoverCard, setEditingMemory, spatialWalkActive]
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

  // Persist last map position/zoom so the app reopens where user left off.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const persistView = () => {
      const center = map.getCenter();
      setMapView({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    };
    map.on('moveend', persistView);
    map.on('zoomend', persistView);
    persistView();
    return () => {
      map.off('moveend', persistView);
      map.off('zoomend', persistView);
    };
  }, [setMapView]);

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

  // Ctrl + drag on the map to marquee-select memories.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || spatialWalkActive || mapBlurred) return;
    const container = map.getContainer();

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.leaflet-control-container, .memory-hover-card')) return;
      const rect = container.getBoundingClientRect();
      const start = L.point(e.clientX - rect.left, e.clientY - rect.top);
      selectionDragRef.current = {
        pointerId: -1,
        start,
        addToSelection: e.shiftKey,
      };
      setSelectionRectPx({ x: start.x, y: start.y, width: 0, height: 0 });
      map.dragging.disable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
      if (map.doubleClickZoom) map.doubleClickZoom.disable();
      if (map.boxZoom) map.boxZoom.disable();
      e.stopImmediatePropagation();
      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseMove = (e: MouseEvent) => {
      const drag = selectionDragRef.current;
      if (!drag) return;
      const rect = container.getBoundingClientRect();
      const cur = L.point(e.clientX - rect.left, e.clientY - rect.top);
      const x = Math.min(drag.start.x, cur.x);
      const y = Math.min(drag.start.y, cur.y);
      const width = Math.abs(cur.x - drag.start.x);
      const height = Math.abs(cur.y - drag.start.y);
      setSelectionRectPx({ x, y, width, height });
      e.preventDefault();
    };

    const finishSelection = (e: MouseEvent) => {
      const drag = selectionDragRef.current;
      if (!drag) return;
      const rect = container.getBoundingClientRect();
      const end = L.point(e.clientX - rect.left, e.clientY - rect.top);
      selectionDragRef.current = null;

      const dx = Math.abs(end.x - drag.start.x);
      const dy = Math.abs(end.y - drag.start.y);
      if (dx >= 4 && dy >= 4) {
        const min = L.point(Math.min(drag.start.x, end.x), Math.min(drag.start.y, end.y));
        const max = L.point(Math.max(drag.start.x, end.x), Math.max(drag.start.y, end.y));
        const nw = map.containerPointToLatLng(min);
        const se = map.containerPointToLatLng(max);
        const bounds = L.latLngBounds(nw, se);
        const matched = visibleMemories
          .filter((m) => visibleMemoryIds.has(m.id))
          .filter((m) => bounds.contains([m.lat, m.lng]))
          .map((m) => m.id);
        if (drag.addToSelection) {
          const merged = new Set([...selectedMemoryIds, ...matched]);
          setSelection(Array.from(merged));
        } else {
          setSelection(matched);
        }
        // Prevent click-to-pin that can fire right after marquee selection.
        suppressMapClickUntilRef.current = Date.now() + 300;
      }

      setSelectionRectPx(null);
      map.dragging.enable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
      if (map.doubleClickZoom) map.doubleClickZoom.enable();
      if (map.boxZoom) map.boxZoom.enable();
      e.preventDefault();
      e.stopPropagation();
    };

    container.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', finishSelection, true);
    return () => {
      selectionDragRef.current = null;
      setSelectionRectPx(null);
      container.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', finishSelection, true);
      map.dragging.enable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
      if (map.doubleClickZoom) map.doubleClickZoom.enable();
      if (map.boxZoom) map.boxZoom.enable();
    };
  }, [
    spatialWalkActive,
    mapBlurred,
    selectedMemoryIds,
    setSelection,
    visibleMemories,
    visibleMemoryIds,
  ]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest('input, textarea, [contenteditable="true"], [role="textbox"]');
    const onKeyDown = (e: KeyboardEvent) => {
      if (!hasSelection) return;
      if (isTypingTarget(e.target)) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      e.preventDefault();
      if (!skipDeleteConfirmation) {
        const ok = window.confirm(`Delete ${selectedMemoryIds.length} selected memory(ies)?`);
        if (!ok) return;
      }
      bulkDelete(selectedMemoryIds);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [bulkDelete, hasSelection, selectedMemoryIds, skipDeleteConfirmation]);

  const startDraggingMemory = useCallback(
    (
      memory: Memory,
      startPoint: { x: number; y: number },
      e: React.PointerEvent<HTMLDivElement>
    ) => {
      const map = mapRef.current;
      if (!map) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (draggingMemoryIdRef.current) return;

      suppressCardClickRef.current = false;

      // Snapshot the current state once so dragging can be undone as a single action.
      pushUndo();

      // Drag state (use refs so map event callbacks remain current).
      draggingMemoryIdRef.current = memory.id;
      isDraggingMemoryRef.current = true;
      setDraggingMemoryId(memory.id);

      cardPinnedBySidebarRef.current = true;
      const initialLatLng = map.containerPointToLatLng(L.point(startPoint.x, startPoint.y));
      setDragFocusLatLng({ lat: initialLatLng.lat, lng: initialLatLng.lng });
      if (hoverHideTimeoutRef.current) {
        clearTimeout(hoverHideTimeoutRef.current);
        hoverHideTimeoutRef.current = null;
      }

      const containerEl = map.getContainer();
      const rect = containerEl.getBoundingClientRect();
      dragContainerRectRef.current = rect;

      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      grabDeltaRef.current = { dx: pointerX - startPoint.x, dy: pointerY - startPoint.y };

      // Disable map panning/zoom while dragging the card.
      map.dragging.disable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
      if (map.doubleClickZoom) map.doubleClickZoom.disable();
      if (map.boxZoom) map.boxZoom.disable();

      e.preventDefault();
      e.stopPropagation();

      const onPointerMove = (ev: PointerEvent) => {
        if (draggingMemoryIdRef.current !== memory.id) return;
        const r = dragContainerRectRef.current;
        const delta = grabDeltaRef.current;
        if (!r || !delta) return;

        const px = ev.clientX - r.left;
        const py = ev.clientY - r.top;
        const markerX = px - delta.dx;
        const markerY = py - delta.dy;

        const latlng = map.containerPointToLatLng(L.point(markerX, markerY));
        pendingDragRef.current = { lat: latlng.lat, lng: latlng.lng, x: markerX, y: markerY };

        if (dragRafRef.current != null) return;
        dragRafRef.current = requestAnimationFrame(() => {
          const pending = pendingDragRef.current;
          dragRafRef.current = null;
          pendingDragRef.current = null;

          if (!pending) return;
          if (draggingMemoryIdRef.current !== memory.id) return;

          updateMemoryWithoutUndo(memory.id, { lat: pending.lat, lng: pending.lng });
          setHoverPoint({ x: pending.x, y: pending.y });
          setDragFocusLatLng({ lat: pending.lat, lng: pending.lng });
        });
      };

      const stopDrag = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', stopDrag);
        window.removeEventListener('pointercancel', stopDrag);

        if (dragRafRef.current != null) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        pendingDragRef.current = null;
        grabDeltaRef.current = null;
        dragContainerRectRef.current = null;
        setDragFocusLatLng(null);

        const mapNow = mapRef.current;
        if (mapNow) {
          isDraggingMemoryRef.current = false;
          mapNow.dragging.enable();
          if (mapNow.scrollWheelZoom) mapNow.scrollWheelZoom.enable();
          if (mapNow.doubleClickZoom) mapNow.doubleClickZoom.enable();
          if (mapNow.boxZoom) mapNow.boxZoom.enable();
        } else {
          isDraggingMemoryRef.current = false;
        }

        draggingMemoryIdRef.current = null;
        setDraggingMemoryId(null);

        cardPinnedBySidebarRef.current = false;
        // Suppress the card "click to edit" that can fire after a drag.
        suppressCardClickRef.current = true;
        window.setTimeout(() => {
          suppressCardClickRef.current = false;
        }, 250);
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', stopDrag);
      window.addEventListener('pointercancel', stopDrag);
    },
    [pushUndo, updateMemoryWithoutUndo, setDraggingMemoryId]
  );

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
        center={mapView ? [mapView.lat, mapView.lng] : DEFAULT_CENTER}
        zoom={mapView?.zoom ?? DEFAULT_ZOOM}
        className="h-full w-full animate-map-in opacity-0"
        style={{ cursor: isDraggingMemory ? 'grabbing' : 'crosshair' }}
        zoomControl={false}
      >
        <SetMapRef />
        <LocateAndZoomControls />
        <TileLayer url={tileUrl} subdomains="abcd" />
        <HeatmapLayer memories={visibleMemories} enabled={heatmapEnabled && !spatialWalkActive} />
        <MoodHeatmapLayer memories={visibleMemories} enabled={moodHeatmapEnabled && !spatialWalkActive} />
        <MapContent
          memories={visibleMemories}
          groups={groups}
          pendingLatLng={pendingLatLng}
          searchHighlight={searchHighlight}
          timelineEnabled={timelineEnabled}
          timelineLineStyle={timelineLineStyle}
          hiddenGroupIds={hiddenGroupIds}
          theme={theme}
          mapBlurred={mapBlurred}
          hidePinHint={spatialWalkActive}
          hintCenterLeft={hintCenterLeft}
          showMarkers={markersVisible}
          showRadiusCircles={radiusCirclesEnabled && !spatialWalkActive}
          pendingRadiusPreview={isAddingMemory && pendingLatLng ? pendingLatLng : null}
          visibleMemoryIds={visibleMemoryIds}
          memorySearchMatchSet={memorySearchMatchSet}
          onMapClick={onMapClick}
          onMapBackgroundClick={() => {
            setEditingMemory(null);
            setPendingLatLng(null);
            setIsAddingMemory(false);
          }}
          onMapMouseMove={onMapMouseMove}
          onMapDragStart={onMapDragStart}
          onMapZoomStart={onMapZoomStart}
          onMarkerHover={onMarkerHover}
          onMarkerHoverOut={onMarkerHoverOut}
          onMarkerClick={spatialWalkActive ? undefined : onMarkerClick}
        />
        {dragFocusLatLng && (
          <Marker
            position={[dragFocusLatLng.lat, dragFocusLatLng.lng]}
            icon={dragFocusIcon}
            interactive={false}
            zIndexOffset={2500}
          />
        )}
      </MapContainer>
      {selectionRectPx && (
        <div
          className="pointer-events-none absolute z-[1200] border border-accent bg-accent/15"
          style={{
            left: selectionRectPx.x,
            top: selectionRectPx.y,
            width: selectionRectPx.width,
            height: selectionRectPx.height,
          }}
        />
      )}
      {hasSelection && !spatialWalkActive && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1200] -translate-x-1/2 rounded-md border border-border bg-surface/90 px-2 py-1 font-mono text-[10px] text-text-primary shadow">
          {selectedMemoryIds.length} selected - press Delete
        </div>
      )}
      {!spatialWalkActive && hoveredMemoryLive && hoverPoint && (
        <MemoryHoverCard
          memory={hoveredMemoryLive}
          point={hoverPoint}
          isDragging={isDraggingMemory}
          onStartDrag={
            isDraggingMemory
              ? undefined
              : (e) => startDraggingMemory(hoveredMemoryLive, hoverPoint, e)
          }
          onMouseEnter={onCardMouseEnter}
          onMouseLeave={onCardMouseLeave}
          onClick={() => {
            if (suppressCardClickRef.current) return;
            setEditingMemory(hoveredMemoryLive);
            closeHoverCard();
          }}
        />
      )}
      {showStartLocationPrompt && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-surface/95 p-5 shadow-2xl backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-accent/80">
                  Map preferences
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-text-primary">
                  Preferred start location
                </h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-text-secondary">
                  Choose where your map should open when you return to Temporal Self. You can change
                  this later in settings.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                onClick={() => {
                  setHasChosenStartLocation(true);
                }}
              >
                Use default
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
                onClick={() => {
                  const map = mapRef.current;
                  if (!map || !navigator.geolocation) {
                    setHasChosenStartLocation(true);
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const lat = pos.coords.latitude;
                      const lng = pos.coords.longitude;
                      const zoom = 13;
                      map.setView([lat, lng], zoom, { animate: true });
                      setMapView({ lat, lng, zoom });
                      setHasChosenStartLocation(true);
                    },
                    () => {
                      setHasChosenStartLocation(true);
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
              >
                Use current location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
