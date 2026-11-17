import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/api'

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
        logActivity('LOGIN', 'auth', 'profiles', user?.id)
      },

      setGuest: (guestData) => {
        set({ user: guestData, role: 'victim', isGuest: true, token: null, scope: null })
      },

      logout: async () => {
        logActivity('LOGOUT', 'auth', 'profiles', get().user?.id)
        await supabase.auth.signOut().catch(() => {})
        set({ token: null, user: null, role: null, isGuest: false, scope: null })
      },

      // Synchronous session clear for the login page — clears stale state
      // immediately so there is no race with an incoming login() call.
      // Supabase sign-out is fire-and-forget: it never calls set() after firing.
      clearSession: () => {
        set({ token: null, user: null, role: null, isGuest: false, scope: null })
        supabase.auth.signOut().catch(() => {})
      },

      updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),

      isAuthenticated: () => !!(get().token || get().isGuest),
    }),
    { name: 'survAIve-auth' }
  )
)
