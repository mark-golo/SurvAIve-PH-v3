/**
 * capacitor.js — Native device API wrappers
 *
 * Drop-in replacements for Web APIs that break or degrade inside the Capacitor
 * Android WebView. Import these in place of navigator.geolocation / navigator.onLine.
 *
 * On the web (Admin dashboard build) the same functions work because the underlying
 * Capacitor plugins fall back to the browser equivalents automatically.
 */
import { Geolocation } from '@capacitor/geolocation'
import { Network }     from '@capacitor/network'
import { MeshNetwork } from '../plugins/MeshNetworkPlugin'

// Sync flag — defaults to true (safe: assumes online until told otherwise).
// Seeded accurately by initCapacitor() via Network.getStatus() on first call.
// Do NOT read navigator.onLine here: in the Android WebView it can briefly report
// false before the Capacitor Network plugin has initialised, which would incorrectly
// block early SOS submissions.
let _online = true
export function getNetworkOnline() { return _online }

// ── Geolocation ───────────────────────────────────────────────────────────────

/**
 * Returns the device's current GPS coordinates.
 * Equivalent to navigator.geolocation.getCurrentPosition() but returns a Promise
 * and works in the Android WebView without extra permission dialogs (Capacitor
 * handles the runtime permission prompt through AndroidManifest declarations).
 *
 * @returns {Promise<GeolocationCoordinates>}
 */
export async function getPosition() {
  const result = await Geolocation.getCurrentPosition({ enableHighAccuracy: true })
  return result.coords
}

// ── Network ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the device currently has any network connectivity
 * (Wi-Fi, mobile data, or Ethernet). Does NOT guarantee internet access —
 * the device may be on the admin's local hotspot (offline mesh mode).
 *
 * @returns {Promise<boolean>}
 */
export async function isOnline() {
  const status = await Network.getStatus()
  return status.connected
}

/**
 * Subscribe to network connectivity changes.
 *
 * @param {function(connected: boolean): void} callback
 * @returns {Promise<import('@capacitor/core').PluginListenerHandle>}
 */
export async function onNetworkChange(callback) {
  return Network.addListener('networkStatusChange', ({ connected }) => callback(connected))
}

// ── Backend reachability probe ─────────────────────────────────────────────
// Confirms actual Supabase availability (not just OS network layer).
// Result is cached for 8 s to avoid hammering on rapid re-checks.
let _probeCachedResult = null
let _probeCachedAt = 0

export async function probeBackend() {
  const now = Date.now()
  if (_probeCachedResult !== null && now - _probeCachedAt < 8000) {
    return _probeCachedResult
  }
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    _probeCachedResult = getNetworkOnline()
    _probeCachedAt = now
    return _probeCachedResult
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: key },
      signal: ctrl.signal,
    })
    _probeCachedResult = res.ok || res.status === 401
  } catch {
    _probeCachedResult = false
  } finally {
    clearTimeout(timer)
  }
  _probeCachedAt = now
  return _probeCachedResult
}

export function invalidateProbeCache() {
  _probeCachedAt = 0
}

// ── Initialisation ────────────────────────────────────────────────────────────

/**
 * Called once from main-victim.jsx / main-responder.jsx at app start.
 * Logs the runtime context and can be extended with any startup side-effects.
 */
export function initCapacitor() {
  if (window.Capacitor?.isNativePlatform?.()) {
    console.log('[SurvAIve] Running in native Android context (Capacitor)')
    // Prompt BT + WiFi enable so mesh can start immediately — fire and forget
    MeshNetwork.enableRadios().catch(() => {})
  } else {
    console.log('[SurvAIve] Running in browser / PWA context')
  }

  // Seed accurate network status from Capacitor, then keep _online live.
  // On web this is a no-op since navigator.onLine is already the source of truth.
  Network.getStatus().then(s => {
    _online = s.connected
    if (_online) {
      import('./meshSync').then(({ drainOfflineQueue }) => drainOfflineQueue()).catch(() => {})
    }
  }).catch(() => {})
  Network.addListener('networkStatusChange', async ({ connected }) => {
    const wasOffline = !_online
    _online = connected
    if (connected && wasOffline) {
      console.log('[capacitor] network restored — draining offline queue')
      import('./meshSync').then(({ drainOfflineQueue }) => drainOfflineQueue()).catch(() => {})
    }
  })
}
