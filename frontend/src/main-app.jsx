import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { initCapacitor } from './lib/capacitor'
import { db } from './lib/db'
import api from './lib/api'
import { startMeshSync } from './lib/meshSync'

initCapacitor()
startMeshSync()

function App() {
  useEffect(() => {
    const drain = async () => {
      try {
        const pending = await db.getPendingSOS()
        for (const item of pending) {
          try {
            await api.post('/sos', item)
            await db.markSOSSynced(item.localId)
          } catch {}
        }
      } catch {}
    }
    window.addEventListener('online', drain)
    return () => window.removeEventListener('online', drain)
  }, [])

  return <RouterProvider router={router} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
