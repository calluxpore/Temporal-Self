import { createContext, useContext } from 'react';
import type L from 'leaflet';

export type MapContextValue = {
  map: L.Map | null;
  setMap: (map: L.Map | null) => void;
};

export const MapContext = createContext<MapContextValue | null>(null);

export function useMapRef(): L.Map | null {
  const ctx = useContext(MapContext);
  return ctx?.map ?? null;
}

export function useSetMapRef(): (map: L.Map | null) => void {
  const ctx = useContext(MapContext);
  return ctx?.setMap ?? (() => {});
}
