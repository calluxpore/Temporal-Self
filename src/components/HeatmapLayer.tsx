import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { Memory } from '../types/memory';

type HeatLayerInternals = ReturnType<typeof L.heatLayer> & {
  _reset?: () => void;
  _canvas?: HTMLCanvasElement;
};

/** Heatmap gradient: low (blue) → high (orange/red), visible on light and dark maps. */
const HEAT_GRADIENT: Record<number, string> = {
  0: 'rgba(0,100,255,0)',
  0.3: 'rgba(0,150,255,0.5)',
  0.6: 'rgba(255,200,0,0.75)',
  1: 'rgba(255,80,0,0.95)',
};

function syncHeatLayer(layer: HeatLayerInternals | null) {
  layer?._reset?.();
}

/** Add heatmap layer to map when enabled; points from memory coordinates. */
export function HeatmapLayer({
  memories,
  enabled,
}: {
  memories: Memory[];
  enabled: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<ReturnType<typeof L.heatLayer> | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }
    const heat = L.heatLayer([], {
      radius: 60,
      blur: 48,
      minOpacity: 0.3,
      max: 1,
      maxZoom: 16,
      gradient: HEAT_GRADIENT,
    });
    heat.addTo(map);
    layerRef.current = heat;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, enabled]);

  useEffect(() => {
    if (!enabled || !layerRef.current) return;

    const layer = layerRef.current as HeatLayerInternals;
    const canvas = layer._canvas;

    const dim = () => {
      if (canvas) canvas.style.opacity = '0';
    };
    /** Restore after pan inertia finishes — avoids full redraw every frame and wrong offset during drag. */
    const onMoveEnd = () => {
      if (canvas) canvas.style.opacity = '1';
      syncHeatLayer(layer);
    };
    const onZoomEnd = () => syncHeatLayer(layer);

    map.on('dragstart', dim);
    map.on('moveend', onMoveEnd);
    map.on('zoomend', onZoomEnd);

    return () => {
      map.off('dragstart', dim);
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onZoomEnd);
      if (canvas) canvas.style.opacity = '1';
    };
  }, [map, enabled]);

  useEffect(() => {
    if (!enabled || !layerRef.current) return;
    const points: [number, number, number][] = memories.map((m) => [m.lat, m.lng, 1]);
    layerRef.current.setLatLngs(points);
    syncHeatLayer(layerRef.current as HeatLayerInternals);
  }, [enabled, memories]);

  return null;
}
