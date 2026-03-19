import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const fn = () => setMatches(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return matches;
}

const MD_BREAKPOINT = 768;

/** True when viewport width >= 768px. */
export function useIsMd(): boolean {
  return useMediaQuery(`(min-width: ${MD_BREAKPOINT}px)`);
}
