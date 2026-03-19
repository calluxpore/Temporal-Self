import { useMemoryStore } from '../store/memoryStore';

export function FavoritesToggle() {
  const filterStarred = useMemoryStore((s) => s.filterStarred);
  const setFilterStarred = useMemoryStore((s) => s.setFilterStarred);

  return (
    <button
      type="button"
      onClick={() => setFilterStarred(!filterStarred)}
      className="fixed z-[900] flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95"
      style={{
        top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 21rem)',
        right: 'max(1.5rem, env(safe-area-inset-right, 0px))',
      }}
      aria-label={filterStarred ? 'Show all memories' : 'Show favorites only'}
      title={filterStarred ? 'Show all memories' : 'Show favorites only'}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={filterStarred ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-secondary"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
