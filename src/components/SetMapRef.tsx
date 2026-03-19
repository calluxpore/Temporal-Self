import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useSetMapRef } from '../context/MapContext';

export function SetMapRef() {
  const map = useMap();
  const setMap = useSetMapRef();
  useEffect(() => {
    setMap(map);
    return () => setMap(null);
  }, [map, setMap]);
  return null;
}
