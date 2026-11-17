import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { responderRouter } from './router-responder'
import { initCapacitor } from './lib/capacitor'

// Boot Capacitor plugins before rendering — logs platform context and allows
// native plugins (Geolocation, Network) to initialise. initCapacitor also
// drains the offline SOS queue on startup and whenever connectivity returns.
initCapacitor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={responderRouter} />
  </StrictMode>,
)
