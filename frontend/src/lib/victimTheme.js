const VICTIM_KEY = 'survAIve-victim-theme'
const RESP_KEY   = 'survAIve-resp-theme'

/** Returns 'dark' (default) or 'light' from localStorage — victim preference. */
export const getVictimTheme = () => {
  try { return localStorage.getItem(VICTIM_KEY) ?? 'dark' } catch { return 'dark' }
}
/** Persists the victim theme preference. */
export const saveVictimTheme = (v) => {
  try { localStorage.setItem(VICTIM_KEY, v) } catch {}
}

/** Returns 'dark' (default) or 'light' from localStorage — responder preference. */
export const getResponderTheme = () => {
  try { return localStorage.getItem(RESP_KEY) ?? 'dark' } catch { return 'dark' }
}
/** Persists the responder theme preference. */
export const saveResponderTheme = (v) => {
  try { localStorage.setItem(RESP_KEY, v) } catch {}
}

const ADMIN_KEY = 'survAIve-admin-theme'

/** Returns 'dark' (default) or 'light' from localStorage — admin preference. */
export const getAdminTheme = () => {
  try { return localStorage.getItem(ADMIN_KEY) ?? 'dark' } catch { return 'dark' }
}
/** Persists the admin theme preference. */
export const saveAdminTheme = (v) => {
  try { localStorage.setItem(ADMIN_KEY, v) } catch {}
}

const SUPERADMIN_KEY = 'survAIve-superadmin-theme'

/** Returns 'dark' (default) or 'light' from localStorage — superadmin preference. */
export const getSuperAdminTheme = () => {
  try { return localStorage.getItem(SUPERADMIN_KEY) ?? 'dark' } catch { return 'dark' }
}
/** Persists the superadmin theme preference. */
export const saveSuperAdminTheme = (v) => {
  try { localStorage.setItem(SUPERADMIN_KEY, v) } catch {}
}
