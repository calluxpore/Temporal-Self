import { useMemoryStore } from '../store/memoryStore';

export function ThemeToggle() {
  const theme = useMemoryStore((s) => s.theme);
  const setTheme = useMemoryStore((s) => s.setTheme);

  const toggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div
      className="fixed z-[900] group"
      style={{ top: 'max(1.5rem, env(safe-area-inset-top, 0px))', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex h-12 w-12 min-h-[44px] min-w-[44px] touch-target items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-colors hover:bg-surface-elevated hover:border-accent active:scale-95"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>
      <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[10px] text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        Theme
      </span>
    </div>
  );
}
