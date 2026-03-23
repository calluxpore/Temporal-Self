import L from 'leaflet';
import { rightDockPanelWidthPx } from './rightDockWidth';

/** Padding for flyToBounds so the focus stays in the map strip not covered by the memory search drawer. */
export function flyToBoundsChromePadding(opts: {
  viewportWidth: number;
  isMd: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  /** Extra inset from chrome edges (matches previous symmetric 56px padding). */
  edgePad?: number;
}): { paddingTopLeft: L.PointExpression; paddingBottomRight: L.PointExpression } {
  const edge = opts.edgePad ?? 56;
  const rightPx = rightDockPanelWidthPx(opts.viewportWidth);
  const leftPx = opts.isMd && opts.sidebarOpen ? opts.sidebarWidth : 0;
  return {
    paddingTopLeft: L.point(leftPx + edge, edge),
    paddingBottomRight: L.point(rightPx + edge, edge),
  };
}

export type MapSearchChromeOpts = {
  viewportWidth: number;
  isMd: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
};

/** Fit a tight bounds around one point so Leaflet centers it in the padded “safe” area (not under the drawer). */
export function flyToPointClearingMemorySearchDock(
  map: L.Map,
  lat: number,
  lng: number,
  chrome: MapSearchChromeOpts,
  flyOpts: { maxZoom: number; duration?: number }
) {
  const pad = flyToBoundsChromePadding(chrome);
  const d = 0.0002;
  const b = L.latLngBounds([lat - d, lng - d], [lat + d, lng + d]);
  map.flyToBounds(b, {
    ...pad,
    maxZoom: flyOpts.maxZoom,
    duration: flyOpts.duration ?? 0.5,
    animate: true,
  });
}
