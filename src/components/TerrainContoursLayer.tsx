import { TileLayer } from 'react-leaflet';

export function TerrainContoursLayer({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <TileLayer
      url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
      subdomains={['a', 'b', 'c']}
      opacity={0.35}
      zIndex={260}
    />
  );
}
