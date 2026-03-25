import buffer from '@turf/buffer';
import distance from '@turf/distance';
import { featureCollection, point } from '@turf/helpers';
import union from '@turf/union';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { Memory } from '../types/memory';

/** Synthetic id for the pending map click while adding a memory (included in merge preview only). */
export const RADIUS_PREVIEW_MEMORY_ID = '__ts_pending_radius__';

/** Merge intersecting radius circles when a cluster has at least this many nodes (2 = any intersecting pair). */
export const RADIUS_MERGE_MIN_CLUSTER = 2;

type MergedPolygonFeature = Feature<Polygon | MultiPolygon>;

export type MergedRadiusLayer = { feature: MergedPolygonFeature; key: string };

function unionFindParent(parent: number[], i: number): number {
  if (parent[i] !== i) parent[i] = unionFindParent(parent, parent[i]);
  return parent[i];
}

function unionFindMerge(parent: number[], a: number, b: number) {
  const ra = unionFindParent(parent, a);
  const rb = unionFindParent(parent, b);
  if (ra !== rb) parent[rb] = ra;
}

function previewMemory(lat: number, lng: number): Memory {
  return {
    id: RADIUS_PREVIEW_MEMORY_ID,
    lat,
    lng,
    title: '',
    date: '',
    notes: '',
    createdAt: '',
  };
}

/**
 * Clusters memories whose radius circles intersect (centers within 2× radius, plus tiny epsilon).
 */
function clusterByIntersectingRadius(memories: Memory[], radiusMeters: number): Memory[][] {
  const n = memories.length;
  if (n === 0) return [];
  const parent = Array.from({ length: n }, (_, i) => i);
  const radiusKm = radiusMeters / 1000;
  const maxD = 2 * radiusKm * 1.00001;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distance([memories[i].lng, memories[i].lat], [memories[j].lng, memories[j].lat], {
        units: 'kilometers',
      });
      if (d <= maxD) unionFindMerge(parent, i, j);
    }
  }

  const buckets = new Map<number, Memory[]>();
  for (let i = 0; i < n; i++) {
    const r = unionFindParent(parent, i);
    const arr = buckets.get(r);
    if (arr) arr.push(memories[i]);
    else buckets.set(r, [memories[i]]);
  }
  return [...buckets.values()];
}

export type BuildRadiusCircleOptions = {
  /** While adding a memory, include this point in intersect/merge so the overlay updates live. */
  previewLatLng?: { lat: number; lng: number } | null;
};

/**
 * For each intersection cluster: if it has at least {@link RADIUS_MERGE_MIN_CLUSTER} memories,
 * replace those circles with one merged polygon (true union of buffered points). Otherwise keep
 * separate circles per memory. Optional {@link previewLatLng} participates in clustering only.
 */
export function buildRadiusCircleLayers(
  memories: Memory[],
  radiusMeters: number,
  options?: BuildRadiusCircleOptions
): { individual: Memory[]; merged: MergedRadiusLayer[] } {
  const preview = options?.previewLatLng ?? null;
  if (memories.length === 0 && !preview) return { individual: [], merged: [] };

  const working = preview ? [...memories, previewMemory(preview.lat, preview.lng)] : memories;
  const clusters = clusterByIntersectingRadius(working, radiusMeters);
  const individual: Memory[] = [];
  const merged: MergedRadiusLayer[] = [];
  let previewMerged = false;

  for (const cluster of clusters) {
    const hasPreview = cluster.some((m) => m.id === RADIUS_PREVIEW_MEMORY_ID);
    const realInCluster = cluster.filter((m) => m.id !== RADIUS_PREVIEW_MEMORY_ID);

    if (cluster.length >= RADIUS_MERGE_MIN_CLUSTER) {
      const radiusKm = radiusMeters / 1000;
      const polygons = cluster
        .map((m) => buffer(point([m.lng, m.lat]), radiusKm, { units: 'kilometers', steps: 32 }))
        .filter((f): f is NonNullable<typeof f> => Boolean(f));

      if (polygons.length === 0) {
        individual.push(...realInCluster);
        continue;
      }

      const combined = union(featureCollection(polygons));
      if (combined) {
        const stableKey = cluster
          .map((m) => m.id)
          .sort()
          .join('|');
        merged.push({ feature: combined as MergedPolygonFeature, key: `radius-merged-${stableKey}` });
        if (hasPreview) previewMerged = true;
      } else individual.push(...realInCluster);
    } else {
      individual.push(...realInCluster);
    }
  }

  if (preview && !previewMerged) {
    individual.push(previewMemory(preview.lat, preview.lng));
  }

  return { individual, merged };
}
