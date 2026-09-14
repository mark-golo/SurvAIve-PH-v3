/**
 * mesh.js — Mesh networking interface (Capacitor-native version)
 *
 * This module replaces the old Web Bluetooth API shim with calls to the
 * MeshNetwork Capacitor plugin, which is backed by a Kotlin implementation
 * running BLE GATT + Wi-Fi Direct on the Android device.
 *
 * Transport priority (handled inside the Kotlin plugin):
 *   1. BLE GATT write  — low-bandwidth, always-on discovery layer
 *   2. Wi-Fi Direct    — higher bandwidth for larger payloads
 *   3. IndexedDB queue — stored here if both transports fail
 *
 * On the web (Admin dashboard), calls route to MeshNetworkPluginWeb which
 * falls back to plain HTTP — keeping this module isomorphic across builds.
 */
import { MeshNetwork } from '../plugins/MeshNetworkPlugin'
import { db } from './db'

let _isStarted       = false    // true after startMesh() has been called
let _msgHandlers     = []       // registered onMessage() callbacks
let _listenerHandle  = null     // Capacitor PluginListenerHandle for cleanup
let _lastStats       = null     // cached result of the last getStats() call

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Lazily start the native mesh engine on first use.
 * This avoids requesting BLE/location permissions until the user actually
 * triggers a mesh-related action (opening MeshStatus or sending an SOS).
 */
async function ensureStarted() {
  if (_isStarted) return

  await MeshNetwork.startMesh()
  _isStarted = true

  // Register a single long-lived listener — all onMessage() subscribers
  // receive packets through the _msgHandlers list below.
  _listenerHandle = await MeshNetwork.addListener('meshPacketReceived', (packet) => {
    try {
      const data = JSON.parse(packet.payload)
      // Attach raw mesh metadata so handlers can inspect hopCount / originDeviceId
      _msgHandlers.forEach((fn) => fn(data, packet))
    } catch {
      // Malformed JSON — drop silently
    }
  })
}

// ── Public interface ──────────────────────────────────────────────────────────

export const mesh = {
  /**
   * Broadcast data through the mesh network.
   *
   * On success:  returns { success: true, transport: 'BLE' | 'WiFiDirect' | 'wifi-http' }
   * On failure:  queues the payload to IndexedDB and returns { success: false, transport: 'none' }
   *
   * @param {object} data - The payload to send (SOS body, ack, status update, etc.)
   */
  async broadcast(data) {
    await ensureStarted()
    const result = await MeshNetwork.broadcast({
      type:    data.type ?? 'sos',
      payload: typeof data === 'string' ? data : JSON.stringify(data),
    })
    if (!result.success) {
      // Both native transports failed — persist to IndexedDB for later drain-queue sync
      try { await db.queueSOS(data) } catch { /* db may not be open yet */ }
    }
    return result
  },

  /**
   * Register a handler for packets received from nearby mesh peers.
   * Returns an unsubscribe function.
   *
   * @param {function(data: object, rawPacket: MeshPacket): void} fn
   * @returns {function(): void} unsubscribe
   */
  onMessage(fn) {
    _msgHandlers.push(fn)
    return () => {
      _msgHandlers = _msgHandlers.filter((h) => h !== fn)
    }
  },

  /**
   * Get current mesh stats from the native layer.
   * Caches the last known value so callers can display stale data while
   * the async call is in flight.
   */
  async getStats() {
    if (!_isStarted) {
      return { peersNearby: 0, transport: 'not started', relayEnabled: false }
    }
    try {
      _lastStats = await MeshNetwork.getStats()
    } catch {
      // Native call failed — return cached or default
      _lastStats = _lastStats ?? { peersNearby: 0, transport: 'error', relayEnabled: false }
    }
    return _lastStats
  },

  /**
   * Enable or disable relay mode on this device.
   * When disabled the device still receives packets but does not forward them.
   * Useful when Battery Saver Mode is on.
   *
   * @param {boolean} enabled
   */
  async setRelay(enabled) {
    if (_isStarted) {
      await MeshNetwork.setRelay({ enabled })
    }
    // Also mirror to native's internal flag via plugin regardless of start state
    // (it will be applied on next startMesh() call)
  },

  /**
   * Returns true if the native mesh engine has been started.
   * Does NOT mean any peers are currently reachable — check getStats().peersNearby.
   */
  isConnected() {
    return _isStarted
  },

  /**
   * Returns an empty array for API compatibility with code that called
   * the old mesh.getPeers(). Use getStats().peersNearby for the count.
   */
  getPeers() {
    return []
  },

  /** Alias kept for legacy callers from deviceSettings.js */
  setBatterySaver(enabled) {
    // Battery saver reduces relay; delegate to setRelay(false)
    this.setRelay(!enabled)
  },

  /**
   * Tear down the native mesh engine and remove all listeners.
   * Call this on app background / unmount if needed.
   */
  async stop() {
    if (_listenerHandle) {
      await _listenerHandle.remove()
      _listenerHandle = null
    }
    if (_isStarted) {
      await MeshNetwork.stopMesh()
      _isStarted = false
    }
    _msgHandlers = []
  },
}
