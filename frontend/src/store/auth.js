import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { MeshNetwork } from '../plugins/MeshNetworkPlugin'
import { logActivity } from '../lib/api'

function syncRoleToNative(role) {
  if (window.Capacitor?.isNativePlatform?.() && role) {
    MeshNetwork.setUserRole({ role }).catch(() => {})
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      role: null,
      isGuest: false,
      scope: null,

      // scope defaults to user.municipality/province if not explicitly provided
      login: (token, user, scope = null) => {
        const resolvedScope = scope ?? (
          (user?.municipality || user?.province || user?.agency_type)
            ? { municipality: user.municipality ?? null, province: user.province ?? null, agency_type: user.agency_type ?? null }
            : null
        )
        // Always merge agency_type from the user object so it survives even when
        // StaffLogin provides an explicit scope without it
        const finalScope = resolvedScope && user?.agency_type != null
          ? { ...resolvedScope, agency_type: user.agency_type }
          : resolvedScope
        const role = user?.role ?? null
        set({ token, user, role, isGuest: false, scope: finalScope })
        syncRoleToNative(role)
        logActivity('LOGIN', 'auth', 'profiles', user?.id)
      },

      setGuest: (guestData) => {
        set({ user: guestData, role: 'victim', isGuest: true, token: null, scope: null })
        syncRoleToNative('victim')
      },

      logout: async () => {
        logActivity('LOGOUT', 'auth', 'profiles', get().user?.id)
        await supabase.auth.signOut().catch(() => {})
        try { await MeshNetwork.setUserRole({ role: null }) } catch {}
        set({ token: null, user: null, role: null, isGuest: false, scope: null })
      },

      updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),

      isAuthenticated: () => !!(get().token || get().isGuest),
    }),
    { name: 'survAIve-auth' }
  )
)
