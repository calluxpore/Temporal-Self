import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { Memory, MemoryMood } from '../types/memory';
import { parseMemoryMood } from '../utils/memoryMoods';

const MOOD_CONFIG: Record<MemoryMood, { color: string; weight: number }> = {
  radiant: { color: '#f59e0b', weight: 1.0 },
  content: { color: '#22c55e', weight: 0.9 },
  neutral: { color: '#94a3b8', weight: 0.75 },
  concerned: { color: '#a855f7', weight: 0.95 },
  distraught: { color: '#ef4444', weight: 1.0 },
};

type HeatLayerInternals = ReturnType<typeof L.heatLayer> & {
  _reset?: () => void;
  _canvas?: HTMLCanvasElement;
};

function moodGradient(color: string): Record<number, string> {
  return {
    0: 'rgba(0,0,0,0)',
    0.25: `${color}99`,
    0.62: `${color}e0`,
    1: color,
  };
}

function syncAllLayers(layers: Partial<Record<MemoryMood, ReturnType<typeof L.heatLayer>>>) {
  for (const mood of Object.keys(MOOD_CONFIG) as MemoryMood[]) {
    (layers[mood] as HeatLayerInternals | undefined)?._reset?.();
  }
}

function setAllCanvasOpacity(
  layers: Partial<Record<MemoryMood, ReturnType<typeof L.heatLayer>>>,
  opacity: string
) {
  for (const mood of Object.keys(MOOD_CONFIG) as MemoryMood[]) {
    const c = (layers[mood] as HeatLayerInternals | undefined)?._canvas;
    if (c) c.style.opacity = opacity;
  }
}

export function MoodHeatmapLayer({
  memories,
  enabled,
}: {
  memories: Memory[];
  enabled: boolean;
}) {
  const map = useMap();
  const layersRef = useRef<Partial<Record<MemoryMood, ReturnType<typeof L.heatLayer>>>>({});

  useEffect(() => {
    if (!enabled) {
      for (const mood of Object.keys(MOOD_CONFIG) as MemoryMood[]) {
        const layer = layersRef.current[mood];
        if (!layer) continue;
        map.removeLayer(layer);
      }
      layersRef.current = {};
      return;
    }

    const next: Partial<Record<MemoryMood, ReturnType<typeof L.heatLayer>>> = {};
    for (const mood of Object.keys(MOOD_CONFIG) as MemoryMood[]) {
      const cfg = MOOD_CONFIG[mood];
      const layer = L.heatLayer([], {
        radius: 62,
        blur: 52,
        minOpacity: 0.36,
        max: 1,
        maxZoom: 16,
        gradient: moodGradient(cfg.color),
      });
      layer.addTo(map);
      next[mood] = layer;
    }
    layersRef.current = next;

    return () => {
      for (const mood of Object.keys(MOOD_CONFIG) as MemoryMood[]) {
        const layer = layersRef.current[mood];
        if (!layer) continue;
        map.removeLayer(layer);
      }
      layersRef.current = {};
    };
  }, [map, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const dim = () => setAllCanvasOpacity(layersRef.current, '0');
    const onMoveEnd = () => {
      setAllCanvasOpacity(layersRef.current, '1');
      syncAllLayers(layersRef.current);
    };
    const onZoomEnd = () => syncAllLayers(layersRef.current);

    map.on('dragstart', dim);
    map.on('moveend', onMoveEnd);
    map.on('zoomend', onZoomEnd);

    return () => {
      map.off('dragstart', dim);
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onZoomEnd);
      setAllCanvasOpacity(layersRef.current, '1');
    };
  }, [map, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const byMood: Record<MemoryMood, [number, number, number][]> = {
      radiant: [],
      content: [],
      neutral: [],
      concerned: [],
      distraught: [],
    };
    for (const m of memories) {
      const mood = parseMemoryMood(m.mood);
      if (!mood) continue;
      byMood[mood].push([m.lat, m.lng, MOOD_CONFIG[mood].weight]);
    }
    for (const mood of Object.keys(byMood) as MemoryMood[]) {
      layersRef.current[mood]?.setLatLngs(byMood[mood]);
    }
    syncAllLayers(layersRef.current);
  }, [enabled, memories]);

  return null;
}
