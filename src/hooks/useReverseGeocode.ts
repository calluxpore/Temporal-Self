import { useState, useEffect } from 'react';
import { formatCoords } from '../utils/formatCoords';

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'MemoryAtlas/1.0 (https://github.com/memory-atlas)';

/** Cache by rounded coords to avoid repeated requests and respect rate limits. */
const cache = new Map<string, string>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function useReverseGeocode(lat: number, lng: number): { location: string | null; loading: boolean } {
  const key = cacheKey(lat, lng);
  const [location, setLocation] = useState<string | null>(() => cache.get(key) ?? null);
  const [loading, setLoading] = useState(() => !cache.has(key));

  useEffect(() => {
    const cachedNow = cache.get(key);
    if (cachedNow !== undefined) {
      setLocation(cachedNow);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
    });
    fetch(`${NOMINATIM_REVERSE}?${params}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Reverse geocode failed'))))
      .then((data: { display_name?: string }) => {
        if (cancelled) return;
        const name = typeof data?.display_name === 'string' ? data.display_name.trim() : null;
        const value = name || formatCoords(lat, lng);
        cache.set(key, value);
        setLocation(value);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = formatCoords(lat, lng);
        cache.set(key, fallback);
        setLocation(fallback);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, key]);

  return { location: loading ? null : location, loading };
}
