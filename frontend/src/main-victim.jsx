import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { victimRouter } from './router-victim'
import { initCapacitor } from './lib/capacitor'
import { startMeshSync } from './lib/meshSync'
import { mesh } from './lib/mesh'

// Initialise native radios and the global receive pipeline before mounting UI.
initCapacitor()
startMeshSync()
mesh.getStats().catch((err) => console.error('[SurvAIve] victim mesh startup failed:', err))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={victimRouter} />
  </StrictMode>,
)
