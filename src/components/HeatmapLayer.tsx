import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { Memory } from '../types/memory';

/** Heatmap gradient: low (blue) → high (orange/red), visible on light and dark maps. */
const HEAT_GRADIENT: Record<number, string> = {
  0: 'rgba(0,100,255,0)',
  0.3: 'rgba(0,150,255,0.5)',
  0.6: 'rgba(255,200,0,0.75)',
  1: 'rgba(255,80,0,0.95)',
};

/** Add heatmap layer to map when enabled; points from memory coordinates. Shows where memories are concentrated (needs at least one memory in view). */
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
      radius: 45,
      blur: 28,
      minOpacity: 0.35,
      max: 1,
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
    const points: [number, number, number][] = memories.map((m) => [m.lat, m.lng, 1]);
    layerRef.current.setLatLngs(points);
  }, [enabled, memories]);

  return null;
}
