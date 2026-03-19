import { useState, useCallback, type ReactNode } from 'react';
import { MapContext } from './mapContextState';

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<import('leaflet').Map | null>(null);
  const setMapStable = useCallback((m: import('leaflet').Map | null) => setMap(m), []);
  return (
    <MapContext.Provider value={{ map, setMap: setMapStable }}>
      {children}
    </MapContext.Provider>
  );
}
