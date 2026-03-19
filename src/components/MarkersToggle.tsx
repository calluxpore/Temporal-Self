import { useMemoryStore } from '../store/memoryStore';

export function MarkersToggle() {
  const markersVisible = useMemoryStore((s) => s.markersVisible);
  const setMarkersVisible = useMemoryStore((s) => s.setMarkersVisible);

  return (
    <button
      type="button"
      onClick={() => setMarkersVisible(!markersVisible)}
      className="fixed z-[900] flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95"
      style={{
        top: 'calc(max(1.5rem, env(safe-area-inset-top, 0px)) + 17.5rem)',
        right: 'max(1.5rem, env(safe-area-inset-right, 0px))',
      }}
      aria-label={markersVisible ? 'Hide markers and names' : 'Show markers and names'}
      title={markersVisible ? 'Hide markers and names' : 'Show markers and names'}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-secondary"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </button>
  );
}
