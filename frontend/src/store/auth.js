import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

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
          (user?.municipality || user?.province)
            ? { municipality: user.municipality ?? null, province: user.province ?? null }
            : null
        )
        set({ token, user, role: user?.role ?? null, isGuest: false, scope: resolvedScope })
      },

      setGuest: (guestData) =>
        set({ user: guestData, role: 'victim', isGuest: true, token: null, scope: null }),

      logout: async () => {
        await supabase.auth.signOut().catch(() => {})
        set({ token: null, user: null, role: null, isGuest: false, scope: null })
      },

      updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),

      isAuthenticated: () => !!(get().token || get().isGuest),
    }),
    { name: 'survAIve-auth' }
  )
)
