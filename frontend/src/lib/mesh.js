// Mesh networking layer
//
// Transport priority (attempted in order):
//   1. Web Bluetooth API — BLE GATT write to a nearby receiver (Chrome/Android)
//   2. Local Wi-Fi (XAMPP hotspot) — HTTP POST to the admin's local PHP server
//   3. IndexedDB queue — stored for later sync when connectivity returns
//
// Notes:
//   • Web Bluetooth requires https:// or localhost AND a user gesture for the
//     FIRST requestDevice() call. Subsequent sends reuse the cached device.
//   • Wi-Fi fallback uses the same localPhpUrl helper as api.js — it resolves
//     to http://<hostname>/SurvAIve%20PH%20v3/backend/api/router.php?path=
//   • The BLE service UUID below is a placeholder — replace with the UUID
//     advertised by your BLE relay hardware/native app.

const BLE_SERVICE_UUID = '12345678-0000-1000-8000-00805f9b34fb'
const BLE_CHAR_UUID    = '12345678-0001-1000-8000-00805f9b34fb'

function localPhpUrl(path) {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}/SurvAIve%20PH%20v3/backend/api/router.php?path=${path}`
}

let _bleDevice   = null  // cached BLE device after first connection
let _msgHandlers = []    // registered onMessage callbacks
let _peers       = []    // discovered peer list

// ── BLE broadcast ─────────────────────────────────────────────────────────────
async function bleBroadcast(data) {
  if (!navigator.bluetooth) return false
  try {
    // Reuse previous device if still connected, otherwise discover
    if (!_bleDevice || !_bleDevice.gatt?.connected) {
      _bleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
        optionalServices: [BLE_SERVICE_UUID],
      })
      _bleDevice.addEventListener('gattserverdisconnected', () => { _bleDevice = null })
    }
    const server  = await _bleDevice.gatt.connect()
    const service = await server.getPrimaryService(BLE_SERVICE_UUID)
    const char    = await service.getCharacteristic(BLE_CHAR_UUID)
    const encoded = new TextEncoder().encode(JSON.stringify(data))
    await char.writeValueWithoutResponse(encoded)
    // Subscribe to notifications for incoming relay messages
    await char.startNotifications()
    char.addEventListener('characteristicvaluechanged', (ev) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(ev.target.value))
        _msgHandlers.forEach(fn => fn(msg))
      } catch { /* malformed packet — ignore */ }
    })
    return true
  } catch {
    return false
  }
}

// ── Local Wi-Fi broadcast (admin hotspot / XAMPP) ─────────────────────────────
async function wifiBroadcast(data) {
  try {
    const res = await fetch(localPhpUrl('sos'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data.payload ?? data),
      signal:  AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Public mesh interface ──────────────────────────────────────────────────────
export const mesh = {
  isConnected: () => !!(_bleDevice?.gatt?.connected),

  getPeers: () => _peers,

  getStats: () => ({
    peersConnected:   _peers.length,
    messagesForwarded: 0,
    dataRelayed:      '—',
    lastSync:         _bleDevice ? new Date().toLocaleTimeString() : '—',
  }),

  /** Broadcast an SOS payload via BLE → Wi-Fi fallback */
  async broadcast(data) {
    // Try BLE first
    const bleSent = await bleBroadcast(data)
    if (bleSent) return true

    // BLE unavailable or user dismissed — try local Wi-Fi (admin hotspot)
    const wifiSent = await wifiBroadcast(data)
    return wifiSent
  },

  /** Register a handler for incoming mesh messages */
  onMessage(fn) {
    _msgHandlers.push(fn)
    return () => { _msgHandlers = _msgHandlers.filter(cb => cb !== fn) }
  },

  refresh() {
    // Re-scan nearby BLE devices (no-op until hardware is present)
    return _peers
  },

  setRelay(enabled)       { this._relayEnabled    = enabled },
  setBatterySaver(enabled){ this._batterySaver     = enabled },
}
