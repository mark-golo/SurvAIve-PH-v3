import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAlertStore = create(
  persist(
    (set) => ({
      soundEnabled:        true,
      visualEnabled:       true,
      notificationEnabled: true,
      volume:              0.7,

      toggleSound:        () => set(s => ({ soundEnabled:        !s.soundEnabled })),
      toggleVisual:       () => set(s => ({ visualEnabled:       !s.visualEnabled })),
      toggleNotification: () => set(s => ({ notificationEnabled: !s.notificationEnabled })),
      setVolume:          (v) => set({ volume: v }),
    }),
    { name: 'survAIve-alert-settings' }
  )
)
