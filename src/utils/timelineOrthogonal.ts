import L from 'leaflet';

export interface OrthogonalRouteOptions {
  /**
   * Corner rounding radius in screen pixels.
   * Since we build in container/screen space, this feels consistent across zoom levels.
   */
  radiusPx?: number;
  /** Number of segments to approximate the quarter-circle arc. */
  arcSegments?: number;
}

type PointPx = { x: number; y: number };

function pushUnique(out: PointPx[], p: PointPx) {
  const last = out[out.length - 1];
  if (!last) {
    out.push(p);
    return;
  }
  if (Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) return;
  out.push(p);
}

/**
 * Builds a polyline that moves strictly horizontal then vertical (in screen coordinates),
 * with rounded 90-degree corners.
 */
export function buildOrthogonalRoute(
  map: L.Map,
  points: [number, number][],
  opts?: OrthogonalRouteOptions
): [number, number][] {
  if (points.length < 2) return points;

  const radiusPx = opts?.radiusPx ?? 10;
  const arcSegments = Math.max(2, opts?.arcSegments ?? 6);

  const pxPoints = points.map(([lat, lng]) => map.latLngToContainerPoint([lat, lng]));
  const outPx: PointPx[] = [];
  pushUnique(outPx, { x: pxPoints[0].x, y: pxPoints[0].y });

  for (let i = 0; i < pxPoints.length - 1; i++) {
    const cur = pxPoints[i];
    const nxt = pxPoints[i + 1];

    const dx = nxt.x - cur.x;
    const dy = nxt.y - cur.y;

    // Already aligned in either axis -> just connect.
    if (Math.abs(dx) < 0.01 || Math.abs(dy) < 0.01) {
      pushUnique(outPx, { x: nxt.x, y: nxt.y });
      continue;
    }

    const dirX = dx > 0 ? 1 : -1;
    const dirY = dy > 0 ? 1 : -1;
    const corner: PointPx = { x: nxt.x, y: cur.y };

    const maxR = Math.min(Math.abs(dx) / 2, Math.abs(dy) / 2);
    const r = Math.max(0, Math.min(radiusPx, maxR));
    if (r < 0.5) {
      // Too tight to round - fall back to sharp right-angle.
      pushUnique(outPx, corner);
      pushUnique(outPx, { x: nxt.x, y: nxt.y });
      continue;
    }

    const preCorner: PointPx = { x: corner.x - dirX * r, y: corner.y };
    const postCorner: PointPx = { x: corner.x, y: corner.y + dirY * r };

    // Horizontal -> pre-corner
    pushUnique(outPx, preCorner);

    // Rounded elbow:
    // The sharp corner is at `corner`. For a radius `r`, the tangent points are:
    // - preCorner  = (corner.x - dirX*r, corner.y)
    // - postCorner = (corner.x, corner.y + dirY*r)
    // The quarter-circle arc that is tangent to both segments has its center at:
    // - center = (preCorner.x, postCorner.y)
    const centerX = preCorner.x;
    const centerY = postCorner.y;

    // Start/end angles relative to the arc center.
    // startRel is (preCorner - center) = (0, -dirY*r)
    // endRel   is (postCorner - center) = (dirX*r, 0)
    const startAngle = Math.atan2(-dirY * r, 0);
    const cross = dirX * dirY; // sign determines clockwise vs counterclockwise sweep
    const sweep = cross >= 0 ? Math.PI / 2 : -Math.PI / 2;

    for (let s = 1; s < arcSegments; s++) {
      const t = s / arcSegments; // (0, 1)
      const alpha = startAngle + sweep * t;
      const x = centerX + r * Math.cos(alpha);
      const y = centerY + r * Math.sin(alpha);
      pushUnique(outPx, { x, y });
    }

    // Post-corner -> vertical -> next point
    pushUnique(outPx, postCorner);
    pushUnique(outPx, { x: nxt.x, y: nxt.y });
  }

  return outPx.map((p) => {
    const latlng = map.containerPointToLatLng(L.point(p.x, p.y));
    return [latlng.lat, latlng.lng] as [number, number];
  });
}

