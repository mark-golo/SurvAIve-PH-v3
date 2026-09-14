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

// ── Initialisation ────────────────────────────────────────────────────────────

/**
 * Called once from main-victim.jsx / main-responder.jsx at app start.
 * Logs the runtime context and can be extended with any startup side-effects.
 */
export function initCapacitor() {
  if (window.Capacitor?.isNativePlatform?.()) {
    console.log('[SurvAIve] Running in native Android context (Capacitor)')
  } else {
    console.log('[SurvAIve] Running in browser / PWA context')
  }
}
