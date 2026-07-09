import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { DevLogin }   from './pages/DevLogin'
import { StaffLogin } from './pages/StaffLogin'

// Victim pages
import { LandingAuth }     from './pages/victim/LandingAuth'
import { ProfileLogin }    from './pages/victim/ProfileLogin'
import { GuestChallenge }  from './pages/victim/GuestChallenge'
import { HomeScreen }      from './pages/victim/HomeScreen'
import { SOSReport }       from './pages/victim/SOSReport'
import { MeshStatus }      from './pages/victim/MeshStatus'
import { LocalMap }        from './pages/victim/LocalMap'
import { VictimSettings }  from './pages/victim/VictimSettings'

// Responder pages
import { ResponderHome }     from './pages/responder/ResponderHome'
import { VictimQueue }       from './pages/responder/VictimQueue'
import { RescueDetail }      from './pages/responder/RescueDetail'
import { FieldMap }          from './pages/responder/FieldMap'
import { MeshRelay }         from './pages/responder/MeshRelay'
import { ResponderSettings } from './pages/responder/ResponderSettings'

// Admin pages
import { CommandCenter }       from './pages/admin/CommandCenter'
import { VictimTable }         from './pages/admin/VictimTable'
import { ConstituentRegistry } from './pages/admin/ConstituentRegistry'
import { SafetyVerification }  from './pages/admin/SafetyVerification'
import { AdminAnalytics }      from './pages/admin/AdminAnalytics'
import { RespondersView }      from './pages/admin/RespondersView'
import { StaffManagement as AdminStaffManagement } from './pages/admin/StaffManagement'
import { EvacuationCenters } from './pages/admin/EvacuationCenters'

// Super admin pages
import { ProvincialDashboard }  from './pages/superadmin/ProvincialDashboard'
import { MunicipalityList }     from './pages/superadmin/MunicipalityList'
import { ProvincialAnalytics }  from './pages/superadmin/ProvincialAnalytics'
import { EscalationFeed }       from './pages/superadmin/EscalationFeed'
import { StaffManagement as SuperAdminStaffManagement } from './pages/superadmin/StaffManagement'

function RoleGuard({ allowed }) {
  const { role, isAuthenticated } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/" replace />
  if (!allowed.includes(role)) return <Navigate to="/" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  { path: '/',          element: <LandingAuth /> },
  { path: '/dev',          element: <DevLogin /> },
  { path: '/staff-login',  element: <StaffLogin /> },
  { path: '/login',     element: <ProfileLogin /> },
  { path: '/guest',     element: <GuestChallenge /> },

  // Victim routes (victim role or guest)
  {
    element: <RoleGuard allowed={['victim']} />,
    children: [
      { path: '/home',     element: <HomeScreen /> },
      { path: '/sos',      element: <SOSReport /> },
      { path: '/mesh',     element: <MeshStatus /> },
      { path: '/map',      element: <LocalMap /> },
      { path: '/settings', element: <VictimSettings /> },
    ],
  },

  // Responder routes
  {
    element: <RoleGuard allowed={['responder']} />,
    children: [
      { path: '/responder',              element: <ResponderHome /> },
      { path: '/responder/queue',        element: <VictimQueue /> },
      { path: '/responder/rescue/:id',   element: <RescueDetail /> },
      { path: '/responder/map',          element: <FieldMap /> },
      { path: '/responder/relay',        element: <MeshRelay /> },
      { path: '/responder/settings',     element: <ResponderSettings /> },
    ],
  },

  // Admin routes
  {
    element: <RoleGuard allowed={['admin']} />,
    children: [
      { path: '/admin',               element: <CommandCenter /> },
      { path: '/admin/victims',       element: <VictimTable /> },
      { path: '/admin/constituents',  element: <ConstituentRegistry /> },
      { path: '/admin/safety',        element: <SafetyVerification /> },
      { path: '/admin/analytics',     element: <AdminAnalytics /> },
      { path: '/admin/responders',    element: <RespondersView /> },
      { path: '/admin/staff',                 element: <AdminStaffManagement /> },
      { path: '/admin/evacuation-centers',   element: <EvacuationCenters /> },
    ],
  },

  // Super admin routes
  {
    element: <RoleGuard allowed={['superadmin']} />,
    children: [
      { path: '/superadmin',                    element: <ProvincialDashboard /> },
      { path: '/superadmin/municipalities',     element: <MunicipalityList /> },
      { path: '/superadmin/analytics',          element: <ProvincialAnalytics /> },
      { path: '/superadmin/escalations',        element: <EscalationFeed /> },
      { path: '/superadmin/staff',              element: <SuperAdminStaffManagement /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
])
