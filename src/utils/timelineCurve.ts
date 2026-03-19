/**
 * Catmull-Rom spline: smooth curve that passes through all points.
 * Returns interpolated [lat, lng] positions for use with Leaflet Polyline.
 * Currently unused — timeline uses straight segments; keep for optional future smoothing.
 */
export function smoothCurveThroughPoints(
  points: [number, number][],
  segmentsPerEdge: number = 24
): [number, number][] {
  if (points.length < 2) return points;
  if (points.length === 2) return points;

  const out: [number, number][] = [points[0]];
  const n = points.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];

    for (let k = 1; k <= segmentsPerEdge; k++) {
      const t = k / segmentsPerEdge;
      const t2 = t * t;
      const t3 = t2 * t;
      const lat =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const lng =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([lat, lng]);
    }
  }

  return out;
}
