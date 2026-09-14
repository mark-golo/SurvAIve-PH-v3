/**
 * router-victim.jsx — Hash-based router for the Victim Android App
 *
 * Only victim-facing pages are included. Admin / Responder / SuperAdmin pages
 * are excluded from this build to keep the APK bundle small.
 *
 * Hash routing (/#/path) is required because the Android WebView serves assets
 * from capacitor://localhost — a pseudo-origin that doesn't support path-based
 * routing without a server rewrite rule.
 */
import { createHashRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store/auth'

// Auth screens
import { LandingAuth }    from './pages/victim/LandingAuth'
import { ProfileLogin }   from './pages/victim/ProfileLogin'
import { GuestChallenge } from './pages/victim/GuestChallenge'
import { VictimSignup }   from './pages/victim/VictimSignup'

// Victim app screens
import { HomeScreen }     from './pages/victim/HomeScreen'
import { SOSReport }      from './pages/victim/SOSReport'
import { MeshStatus }     from './pages/victim/MeshStatus'
import { LocalMap }       from './pages/victim/LocalMap'
import { VictimSettings } from './pages/victim/VictimSettings'

/** Guard: redirects to landing if the user is not authenticated as a victim */
function VictimGuard() {
  const { role, isAuthenticated } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/" replace />
  if (role !== 'victim') return <Navigate to="/" replace />
  return <Outlet />
}

export const victimRouter = createHashRouter([
  // ── Public / Auth ────────────────────────────────────────────────────────────
  { path: '/',         element: <LandingAuth /> },
  { path: '/login',    element: <ProfileLogin /> },
  { path: '/guest',    element: <GuestChallenge /> },
  { path: '/signup',   element: <VictimSignup /> },

  // ── Protected victim screens ─────────────────────────────────────────────────
  {
    element: <VictimGuard />,
    children: [
      { path: '/home',     element: <HomeScreen /> },
      { path: '/sos',      element: <SOSReport /> },
      { path: '/mesh',     element: <MeshStatus /> },
      { path: '/map',      element: <LocalMap /> },
      { path: '/settings', element: <VictimSettings /> },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
])
