const VICTIM_KEY     = 'survAIve-victim-theme'
const RESP_KEY       = 'survAIve-resp-theme'
const ADMIN_KEY      = 'survAIve-admin-theme'
const AGENCY_KEY     = 'survAIve-agency-theme'
const SUPERADMIN_KEY = 'survAIve-superadmin-theme'

/**
 * Resolves a stored theme value ('dark' | 'light' | 'system') to an effective
 * theme ('dark' | 'light') by reading the OS preference for 'system'.
 */
export function resolveTheme(stored) {
  if (stored === 'system') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch { return 'dark' }
  }
  return stored ?? 'dark'
}

/** Returns stored theme ('dark' | 'light' | 'system', default 'dark') — victim. */
export const getVictimTheme = () => {
  try { return localStorage.getItem(VICTIM_KEY) ?? 'dark' } catch { return 'dark' }
}
export const saveVictimTheme = (v) => {
  try { localStorage.setItem(VICTIM_KEY, v) } catch {}
}

/** Returns stored theme ('dark' | 'light' | 'system', default 'dark') — responder. */
export const getResponderTheme = () => {
  try { return localStorage.getItem(RESP_KEY) ?? 'dark' } catch { return 'dark' }
}
export const saveResponderTheme = (v) => {
  try { localStorage.setItem(RESP_KEY, v) } catch {}
}

/** Returns stored theme ('dark' | 'light' | 'system', default 'dark') — admin. */
export const getAdminTheme = () => {
  try { return localStorage.getItem(ADMIN_KEY) ?? 'dark' } catch { return 'dark' }
}
export const saveAdminTheme = (v) => {
  try { localStorage.setItem(ADMIN_KEY, v) } catch {}
}

/** Returns stored theme ('dark' | 'light' | 'system', default 'dark') — agency. */
export const getAgencyTheme = () => {
  try { return localStorage.getItem(AGENCY_KEY) ?? 'dark' } catch { return 'dark' }
}
export const saveAgencyTheme = (v) => {
  try { localStorage.setItem(AGENCY_KEY, v) } catch {}
}

/** Returns stored theme ('dark' | 'light' | 'system', default 'dark') — superadmin. */
export const getSuperAdminTheme = () => {
  try { return localStorage.getItem(SUPERADMIN_KEY) ?? 'dark' } catch { return 'dark' }
}
export const saveSuperAdminTheme = (v) => {
  try { localStorage.setItem(SUPERADMIN_KEY, v) } catch {}
}
