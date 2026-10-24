import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { victimRouter } from './router-victim'
import { initCapacitor } from './lib/capacitor'
import { startMeshSync } from './lib/meshSync'
import { mesh } from './lib/mesh'

// Boot Capacitor plugins before rendering — logs platform context and allows
// native plugins (Geolocation, Network, MeshNetwork) to initialise.
initCapacitor()
startMeshSync()
mesh.getStats().catch(() => {})   // eagerly registers native listener before first packet

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={victimRouter} />
  </StrictMode>,
)
