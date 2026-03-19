import { useRef, useEffect } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { FOCUS_SEARCH_EVENT } from '../hooks/useKeyboardShortcuts';

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchQuery = useMemoryStore((s) => s.searchQuery);
  const setSearchQuery = useMemoryStore((s) => s.setSearchQuery);

  useEffect(() => {
    const fn = () => inputRef.current?.focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, fn);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, fn);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-surface/80 focus-within:border-accent/60 focus-within:bg-surface transition-colors">
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search memories... (/)"
        className="font-mono w-full min-h-[36px] touch-target rounded-xl bg-transparent py-2 px-3 text-xs text-text-primary placeholder-text-muted outline-none border-none focus:ring-0"
        aria-label="Search memories by title, notes, or date"
      />
    </div>
  );
}
