/**
 * router-responder.jsx — Hash-based router for the Responder Android App
 *
 * Only responder-facing pages are included. Victim / Admin / SuperAdmin pages
 * are excluded from this build to keep the APK bundle small.
 *
 * Hash routing (/#/path) is required because the Android WebView serves assets
 * from capacitor://localhost — a pseudo-origin that doesn't support path-based
 * routing without a server rewrite rule.
 */
import { createHashRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store/auth'

// Auth screens (staff login is shared)
import { StaffLogin } from './pages/StaffLogin'

// Responder app screens
import { ResponderHome }     from './pages/responder/ResponderHome'
import { VictimQueue }       from './pages/responder/VictimQueue'
import { RescueDetail }      from './pages/responder/RescueDetail'
import { FieldMap }          from './pages/responder/FieldMap'
import { MeshRelay }         from './pages/responder/MeshRelay'
import { ResponderSettings } from './pages/responder/ResponderSettings'

/** Guard: redirects to login if the user is not authenticated as a responder */
function ResponderGuard() {
  const { role, isAuthenticated } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/" replace />
  if (role !== 'responder') return <Navigate to="/" replace />
  return <Outlet />
}

export const responderRouter = createHashRouter([
  // ── Public / Auth ────────────────────────────────────────────────────────────
  { path: '/',        element: <StaffLogin /> },
  { path: '/login',   element: <StaffLogin /> },

  // ── Protected responder screens ──────────────────────────────────────────────
  {
    element: <ResponderGuard />,
    children: [
      { path: '/responder',              element: <ResponderHome /> },
      { path: '/responder/queue',        element: <VictimQueue /> },
      { path: '/responder/rescue/:id',   element: <RescueDetail /> },
      { path: '/responder/map',          element: <FieldMap /> },
      { path: '/responder/relay',        element: <MeshRelay /> },
      { path: '/responder/settings',     element: <ResponderSettings /> },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
])
