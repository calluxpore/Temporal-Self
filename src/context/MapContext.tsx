import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type L from 'leaflet';

type MapContextValue = {
  map: L.Map | null;
  setMap: (map: L.Map | null) => void;
};

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<L.Map | null>(null);
  const setMapStable = useCallback((m: L.Map | null) => setMap(m), []);
  return (
    <MapContext.Provider value={{ map, setMap: setMapStable }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapRef() {
  const ctx = useContext(MapContext);
  return ctx?.map ?? null;
}

export function useSetMapRef() {
  const ctx = useContext(MapContext);
  return ctx?.setMap ?? (() => {});
}
