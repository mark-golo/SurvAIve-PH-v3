import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { victimRouter } from './router-victim'
import { initCapacitor } from './lib/capacitor'

// Boot Capacitor plugins before rendering — logs platform context and allows
// native plugins (Geolocation, Network, MeshNetwork) to initialise.
initCapacitor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={victimRouter} />
  </StrictMode>,
)
