import { useEffect, useMemo, useState } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { useIsMd } from './useMediaQuery';
import { rightDockPanelWidthPx } from '../utils/rightDockWidth';

/**
 * Horizontal center for fixed UI (top bar, bottom search, map hints) over the visible map:
 * accounts for the left sidebar band and the right settings / add-edit drawer (md+ only),
 * with the same `transition-[left] duration-300` consumers as the sidebar case.
 */
export function useChromeCenterLeft(): string {
  const isMd = useIsMd();
  const sidebarOpen = useMemoryStore((s) => s.sidebarOpen);
  const sidebarWidth = useMemoryStore((s) => s.sidebarWidth);
  const settingsDrawerOpen = useMemoryStore((s) => s.settingsDrawerOpen);
  const memorySearchDrawerOpen = useMemoryStore((s) => s.memorySearchDrawerOpen);
  const editingMemory = useMemoryStore((s) => s.editingMemory);
  const isAddingMemory = useMemoryStore((s) => s.isAddingMemory);
  const pendingLatLng = useMemoryStore((s) => s.pendingLatLng);

  const rightDockOpen =
    settingsDrawerOpen ||
    memorySearchDrawerOpen ||
    editingMemory != null ||
    (isAddingMemory && pendingLatLng != null);

  const [vw, setVw] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return useMemo(() => {
    if (!isMd) return '50%';
    const leftPx = sidebarOpen ? sidebarWidth : 0;
    const rightPx = rightDockOpen ? rightDockPanelWidthPx(vw) : 0;
    return `calc(${leftPx}px + (100vw - ${leftPx}px - ${rightPx}px) / 2)`;
  }, [isMd, sidebarOpen, sidebarWidth, rightDockOpen, vw]);
}
