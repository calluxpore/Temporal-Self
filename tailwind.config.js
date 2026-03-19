/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cormorant Garamond', 'serif'],
        mono: ['DM Mono', 'monospace'],
        body: ['Lora', 'serif'],
      },
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-glow': 'var(--color-accent-glow)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        danger: 'var(--color-danger)',
      },
      animation: {
        'map-in': 'mapFadeIn 800ms ease-out forwards',
        'sidebar-in': 'sidebarSlideIn 400ms cubic-bezier(0.22, 1, 0.36, 1) 200ms forwards',
        'marker-in': 'markerScaleIn 500ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'pulse-ring': 'pulseRing 2s ease-in-out infinite',
      },
      keyframes: {
        mapFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        sidebarSlideIn: {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        markerScaleIn: {
          '0%': { opacity: '0', transform: 'scale(0)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseRing: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0', transform: 'scale(1.8)' },
        },
        ripple: {
          '0%': { opacity: '0.6', transform: 'scale(0)' },
          '100%': { opacity: '0', transform: 'scale(4)' },
        },
      },
    },
  },
  plugins: [],
};
