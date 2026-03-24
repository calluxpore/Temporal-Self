import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';

type GeoJsonData = GeoJSON.FeatureCollection<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>;

const BOUNDARIES_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

export function BoundariesLayer({ enabled }: { enabled: boolean }) {
  const [data, setData] = useState<GeoJsonData | null>(null);

  useEffect(() => {
    if (!enabled || data) return;
    let mounted = true;
    fetch(BOUNDARIES_URL)
      .then((r) => r.json())
      .then((json: GeoJsonData) => {
        if (!mounted) return;
        setData(json);
      })
      .catch(() => {
        if (!mounted) return;
        setData(null);
      });
    return () => {
      mounted = false;
    };
  }, [enabled, data]);

  if (!enabled || !data) return null;
  return (
    <GeoJSON
      data={data}
      style={{
        color: '#6b7280',
        weight: 1,
        opacity: 0.75,
        fillOpacity: 0,
      }}
    />
  );
}
