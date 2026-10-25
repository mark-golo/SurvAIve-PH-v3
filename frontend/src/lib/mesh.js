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
let _startPromise    = null     // mutex — prevents concurrent startMesh() calls
let _msgHandlers     = []       // registered onMessage() callbacks
let _listenerHandle  = null     // Capacitor PluginListenerHandle for cleanup
let _lastStats       = null     // cached result of the last getStats() call

// Packets received before any onMessage() handler is registered are buffered here
// and replayed when the first handler registers. This closes the race where
// onServiceConnected drains the Kotlin startupBuffer (firing notifyListeners) before
// startMeshSync() has called mesh.onMessage() — without this, early SOSes are lost.
const _preHandlerBuffer = []
const MAX_PRE_BUFFER = 20

// meshEvent pre-handler buffer (same race-free pattern as _preHandlerBuffer above)
let _meshEventHandlers = []
const _meshEventPreBuffer = []
const MAX_MESH_EVENT_BUFFER = 50

// meshBroadcastStatus pre-handler buffer
let _broadcastStatusHandlers = []
const _broadcastStatusPreBuffer = []
const MAX_BROADCAST_STATUS_BUFFER = 20

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Lazily start the native mesh engine on first use.
 * This avoids requesting BLE/location permissions until the user actually
 * triggers a mesh-related action (opening MeshStatus or sending an SOS).
 */
async function ensureStarted() {
  if (_isStarted) return
  if (!_startPromise) {
    _startPromise = (async () => {
      // Register listener FIRST — Capacitor does not buffer events, so any packet
      // that arrives between startMesh() resolving and addListener() being called
      // would otherwise be silently dropped.
      _listenerHandle = await MeshNetwork.addListener('meshPacketReceived', (packet) => {
        // Stage 3 of receive chain: Capacitor event reached JS listener.
        console.log('[mesh] meshPacketReceived: id=', packet?.id, 'type=', packet?.type, 'hopCount=', packet?.hopCount)
        // Beacons no longer reach this path (BLEMeshStrategy fires beacon_provisional
        // without invoking onPacketReceived). Only full GATT packets arrive here.
        // Drop any malformed payload rather than delivering {} to downstream handlers.
        let data
        try {
          const raw = packet?.payload
          if (typeof raw !== 'string' || !raw || raw === 'null') {
            throw new Error('missing payload')
          }
          data = JSON.parse(raw)
          if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('payload is not a JSON object')
          }
        } catch (err) {
          console.error('[mesh] dropping malformed mesh payload', {
            id:      packet?.id,
            type:    packet?.type,
            error:   String(err),
            payload: packet?.payload,
          })
          return
        }
        const payloadType = data.t ?? data.type
        if (packet?.type === 'sos' && payloadType && payloadType !== 'sos') {
          console.error('[mesh] dropping SOS packet with mismatched payload type',
            { id: packet?.id, payloadType })
          return
        }
        if (_msgHandlers.length > 0) {
          _msgHandlers.forEach((fn) => fn(data, packet))
        } else {
          // No handlers yet — buffer for replay when first handler registers.
          if (_preHandlerBuffer.length >= MAX_PRE_BUFFER) _preHandlerBuffer.shift()
          _preHandlerBuffer.push({ data, packet })
        }
      })
      // Register meshEvent listener BEFORE startMesh() for the same reason as above:
      // peer_discovered and other events fire during BLE scan init inside startMesh().
      await MeshNetwork.addListener('meshEvent', (evt) => {
        if (evt?.eventType === 'bt_disabled') { _isStarted = false; _startPromise = null }
        if (_meshEventHandlers.length > 0) {
          _meshEventHandlers.forEach(fn => { try { fn(evt) } catch {} })
        } else {
          if (_meshEventPreBuffer.length >= MAX_MESH_EVENT_BUFFER) _meshEventPreBuffer.shift()
          _meshEventPreBuffer.push(evt)
        }
      })
      // Register meshBroadcastStatus listener BEFORE startMesh() — advertising_started
      // fires during BLEMeshStrategy.startAdvertising() inside startMesh().
      await MeshNetwork.addListener('meshBroadcastStatus', (evt) => {
        if (_broadcastStatusHandlers.length > 0) {
          _broadcastStatusHandlers.forEach(fn => { try { fn(evt) } catch {} })
        } else {
          if (_broadcastStatusPreBuffer.length >= MAX_BROADCAST_STATUS_BUFFER)
            _broadcastStatusPreBuffer.shift()
          _broadcastStatusPreBuffer.push(evt)
        }
      })
      // Race against a 12s timeout — if the service hangs (crash, permission stuck),
      // the catch block resets _startPromise so the next call can retry.
      const startTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('startMesh timeout')), 12000)
      )
      await Promise.race([MeshNetwork.startMesh(), startTimeout])
      _isStarted = true
    })().catch((err) => {
      // RC-4: remove the dangling listener before resetting so the next retry
      // doesn't register a second meshPacketReceived listener.
      if (_listenerHandle) {
        _listenerHandle.remove().catch(() => {})
        _listenerHandle = null
      }
      _isStarted = false
      _startPromise = null
      throw err  // H4 fix: propagate so callers know the engine didn't start
    })
  }
  await _startPromise
}

// ── Public interface ──────────────────────────────────────────────────────────

export const mesh = {
  /**
   * Broadcast data through the mesh network.
   *
   * On success:  returns { success: true, transport: 'BLE' | 'WiFiDirect' | 'wifi-http' }
   * On failure:  queues the payload to IndexedDB and returns { success: false, transport: 'none' }
   *
   * BLE ATT write limit: 244 bytes (MTU-247 minus 3-byte ATT header).
   * Payloads exceeding this are rejected before reaching the native layer.
   *
   * @param {object} data - The payload to send (SOS body, ack, status update, etc.)
   */
  async broadcast(data) {
    await ensureStarted()
    const serialised = typeof data === 'string' ? data : JSON.stringify(data)
    const pktType = data.t ?? data.type
    // No JS-side byte limit: native layer requests MTU 512 and fragments oversized
    // payloads using the binary fragment protocol. Rejecting here would prevent
    // native from even attempting delivery.
    const innerBytes = new TextEncoder().encode(serialised).byteLength
    // MeshPacket.toJson() wraps this inner payload: UUID(36) + ANDROID_ID(16) +
    // field names + JSON escaping of inner quotes ≈ 140 bytes of overhead.
    const estWireBytes = innerBytes + 140
    if (estWireBytes > 244) {
      console.warn('[mesh] broadcast: est. wire size', estWireBytes, 'B (inner',
        innerBytes, 'B + ~140B wrapper) > 244B ATT limit — native will fragment')
    }
    // Pre-persist SOS before transmission so a process kill between send and
    // GATT confirmation leaves a local record on the sender side.
    let _localSosId = null
    if (pktType === 'sos' || (!pktType && !serialised.includes('"t":"ack"'))) {
      try { _localSosId = await db.queueSOS(data) } catch { /* db may not be open yet */ }
    }
    const result = await MeshNetwork.broadcast({
      type:    data.t ?? data.type ?? 'sos',
      payload: serialised,
      ...(data._id ? { id: data._id } : {}),
    })
    console.log('[mesh] broadcast result: success=', result?.success, 'transport=', result?.transport, 'innerBytes=', innerBytes, 'estWireBytes=', estWireBytes)
    if (!result.success && !_localSosId) {
      // Both native transports failed and pre-persist also failed — last attempt.
      if (pktType === 'sos' || serialised.includes('"t":"sos"')) {
        try { await db.queueSOS(data) } catch { /* db may not be open yet */ }
      }
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
    if (_preHandlerBuffer.length > 0) {
      const toReplay = _preHandlerBuffer.splice(0)
      // Defer by one microtask so the caller finishes its own synchronous setup first.
      Promise.resolve().then(() => {
        toReplay.forEach(({ data, packet }) => {
          try { fn(data, packet) } catch {}
        })
      })
    }
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
    try { await ensureStarted() } catch (e) {
      _lastStats = { peersNearby: 0, transport: 'start_failed', relayEnabled: false, startError: String(e) }
      return _lastStats
    }
    if (!_isStarted) return { peersNearby: 0, transport: 'not started', relayEnabled: false }
    try {
      _lastStats = await MeshNetwork.getStats()
      // Detect service restart (Android START_STICKY): if the Kotlin side reports
      // "not started" while JS thinks it is, the service was killed and restarted but
      // the plugin's meshService ref is null. Reset so the next broadcast() triggers
      // ensureStarted() → startMesh() → rebind.
      if (_lastStats?.transport === 'not started') {
        _isStarted = false
        _startPromise = null
      }
    } catch {
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
    await ensureStarted()
    await MeshNetwork.setRelay({ enabled })
  },

  /**
   * Returns true if the native mesh engine has been started.
   * Does NOT mean any peers are currently reachable — check getStats().peersNearby.
   */
  isConnected() {
    return _isStarted
  },

  /**
   * Returns the list of currently discovered BLE peers from the native layer.
   */
  async getPeers() {
    try {
      await ensureStarted()
      const result = await MeshNetwork.getPeers()
      return result?.peers ?? []
    } catch {
      return []
    }
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

// bt_disabled handling is now inside the single meshEvent listener registered in
// ensureStarted() (before startMesh()), so no separate IIFE listener is needed.

/**
 * Subscribe to native BLE advertising status events.
 * Fires on: advertising_started, advertising_failed, awaiting_peers.
 * Returns an unsubscribe function (safe to call multiple times).
 *
 * @param {function({status: string, errorCode?: number}): void} fn
 * @returns {function(): void} unsubscribe
 */
export function onBroadcastStatus(fn) {
  _broadcastStatusHandlers.push(fn)
  if (_broadcastStatusPreBuffer.length > 0) {
    const toReplay = _broadcastStatusPreBuffer.splice(0)
    Promise.resolve().then(() => {
      toReplay.forEach(evt => { try { fn(evt) } catch {} })
    })
  }
  return () => { _broadcastStatusHandlers = _broadcastStatusHandlers.filter(h => h !== fn) }
}

/**
 * Subscribe to low-level native mesh events forwarded from the Android layer.
 * Each event includes an `eventType` field plus event-specific metadata.
 * Event types: peer_discovered, connection_established, peer_disconnected,
 *              sos_transmitted, transmission_failed, retry_attempted, sos_relayed.
 *
 * @param {function({eventType: string, [key: string]: any}): void} fn
 * @returns {function(): void} unsubscribe
 */
export function onNativeMeshEvent(fn) {
  _meshEventHandlers.push(fn)
  // Replay any events that arrived before this handler registered
  if (_meshEventPreBuffer.length > 0) {
    const toReplay = _meshEventPreBuffer.splice(0)
    Promise.resolve().then(() => {
      toReplay.forEach(evt => { try { fn(evt) } catch {} })
    })
  }
  return () => { _meshEventHandlers = _meshEventHandlers.filter(h => h !== fn) }
}
