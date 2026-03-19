import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'
import { getPersistedStateForFlashPrevention } from './utils/idbStorage'

// Apply persisted theme before first paint (storage is in IndexedDB after migration)
getPersistedStateForFlashPrevention()
  .then((raw) => {
    try {
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { theme?: string } }
        if (parsed?.state?.theme === 'light') document.documentElement.dataset.theme = 'light'
      }
    } catch { /* ignore */ }
  })
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
