import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const isElectron = process.env.ELECTRON === '1'
const base = isElectron ? './' : '/Temporal-Self/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(isElectron
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            base: '/Temporal-Self/',
            manifest: {
              name: 'Temporal Self',
              short_name: 'Temporal Self',
              description: 'Temporal Self — map-based memory journal',
              theme_color: '#0a0a0b',
              background_color: '#0a0a0b',
              display: 'standalone',
              start_url: '/Temporal-Self/',
              scope: '/Temporal-Self/',
              icons: [
                {
                  src: 'favicon.svg',
                  type: 'image/svg+xml',
                  purpose: 'any',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10 } },
                },
                {
                  urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|webp)/i,
                  handler: 'StaleWhileRevalidate',
                  options: { cacheName: 'tile-cache', expiration: { maxEntries: 64 } },
                },
              ],
            },
          }),
        ]),
  ],
  base,
})
