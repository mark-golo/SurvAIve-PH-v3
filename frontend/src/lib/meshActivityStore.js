import { db } from './db'

// Active outgoing SOS state (victim side)
let _activeSOS = {
  packetId:           null,
  sosDisplayId:       null,    // "SOS-XXXXX" human-readable ID
  ackLevel:           1,
  ackDevices:         [],      // [{ deviceId, hopCount, receiverRole, time }, ...]
  ackMaxHops:         0,
  broadcastSubState:  null,    // 'advertising' | 'awaiting_peers' | 'connecting' | 'transmitted' | 'failed' | null
  broadcastErrorCode: null,    // error code from advertising_failed
}

// Received SOS log — max 10 entries, newest first
let _receivedSOS = []
const MAX_LOG = 10

// Mesh event log (all event types) — in-memory cap raised to 200; full history in IndexedDB
let _eventLog = []
const MAX_EVENT_LOG = 200

let _handlers = []

// ── State persistence helpers ──────────────────────────────────────────────────

let _saveMeshStateTimer = null
function _debouncedSaveMeshState() {
  clearTimeout(_saveMeshStateTimer)
  _saveMeshStateTimer = setTimeout(() => {
    db.saveMeshState('activeSOS', _activeSOS).catch(() => {})
  }, 500)
}

// Restore _activeSOS from IndexedDB on module load (survives app kill/restart).
// Only restores if the saved SOS is less than 30 minutes old to avoid surfacing
// stale emergency state after the session has ended.
;(async () => {
  try {
    const saved = await db.getMeshState('activeSOS')
    if (saved?.packetId) {
      const savedAt = saved.ackDevices?.[saved.ackDevices.length - 1]?.time ?? 0
      const age = Date.now() - Math.max(savedAt, 0)
      if (age < 30 * 60 * 1000) {
        _activeSOS = saved
        _notify()
      }
    }
  } catch {}
})()

// Restore recent event log from IndexedDB on module load.
;(async () => {
  try {
    const persisted = await db.getMeshEventLog(MAX_EVENT_LOG)
    if (persisted.length) {
      // Merge: in-memory events (logged before restore completed) take precedence
      const existingIds = new Set(_eventLog.map(e => e.id))
      const merged = [..._eventLog, ...persisted.filter(e => !existingIds.has(e.id))]
      merged.sort((a, b) => b.time - a.time)
      _eventLog = merged.slice(0, MAX_EVENT_LOG)
      _notify()
    }
  } catch {}
})()

// ── Exports ────────────────────────────────────────────────────────────────────

export function logMeshEvent(type, data) {
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, data, time: Date.now() }
  _eventLog = [entry, ..._eventLog].slice(0, MAX_EVENT_LOG)
  // Persist to IndexedDB (fire-and-forget — UI is never blocked on this)
  db.logMeshEvent(type, data).catch(() => {})
  _notify()
}

export function getMeshEventLog() { return _eventLog }

export function setActiveSOS(packetId, sosDisplayId) {
  _activeSOS = { packetId, sosDisplayId: sosDisplayId ?? null, ackLevel: 1, ackDevices: [], ackMaxHops: 0, broadcastSubState: null }
  _debouncedSaveMeshState()
  _notify()
}

export function updateACKState({ ackLevel, device, ackMaxHops }) {
  _activeSOS = {
    ..._activeSOS,
    ackLevel,
    ackMaxHops,
    ackDevices: device ? [..._activeSOS.ackDevices, device] : _activeSOS.ackDevices,
  }
  _debouncedSaveMeshState()
  _notify()
}

export function clearActiveSOS() {
  _activeSOS = { packetId: null, sosDisplayId: null, ackLevel: 1, ackDevices: [], ackMaxHops: 0, broadcastSubState: null, broadcastErrorCode: null }
  db.saveMeshState('activeSOS', _activeSOS).catch(() => {})
  _notify()
}

export function setBroadcastSubState(sub) {
  _activeSOS = { ..._activeSOS, broadcastSubState: sub }
  _debouncedSaveMeshState()
  _notify()
}

export function setBroadcastErrorCode(code) {
  _activeSOS = { ..._activeSOS, broadcastErrorCode: code }
  _debouncedSaveMeshState()
  _notify()
}

export function getActiveSOS() {
  return _activeSOS
}

// Computed helpers kept for backward compat
export function getACKDeviceCount() {
  return _activeSOS.ackDevices.length
}

// Normalize originDeviceId for cross-format comparison.
// Beacon encodes only the first 6 chars of Android ID; GATT sends the full 16-char ID.
function _originKey(id) { return (id ?? '').slice(0, 6).toLowerCase() }

// Returns true when id1 and id2 refer to the same SOS via beacon vs GATT.
// Beacon form: "beacon-abc123"; full UUID: "abc12345-6789-..."
function _isSamePacket(id1, id2) {
  if (!id1 || !id2) return false
  if (id1 === id2) return true
  const beaconOf = (full) => `beacon-${full.replace(/-/g, '').slice(0, 6)}`
  if (id1.startsWith('beacon-') && !id2.startsWith('beacon-')) return id1 === beaconOf(id2)
  if (id2.startsWith('beacon-') && !id1.startsWith('beacon-')) return id2 === beaconOf(id1)
  return false
}

export function addReceivedSOS(data, rawPacket) {
  const now = Date.now()
  const originKey = _originKey(rawPacket?.originDeviceId)
  const newId = rawPacket?.id ?? ''

  if (originKey && originKey !== 'unknow') {
    const idx = _receivedSOS.findIndex(s =>
      _originKey(s.rawPacket?.originDeviceId) === originKey &&
      _isSamePacket(s.rawPacket?.id ?? '', newId) &&
      now - s.time < 120_000
    )
    if (idx >= 0) {
      // GATT upgrading a beacon entry: merge non-null/non-empty fields over the existing data.
      const existing = _receivedSOS[idx]
      const merged = {
        rawPacket,
        time: existing.time,
        data: {
          ...existing.data,
          ...Object.fromEntries(
            Object.entries(data).filter(([, v]) =>
              v !== null && v !== undefined && v !== '' &&
              !(Array.isArray(v) && v.length === 0)
            )
          ),
        },
      }
      const updated = _receivedSOS.slice()
      updated[idx] = merged
      _receivedSOS = updated
      _notify()
      return
    }
  }

  _receivedSOS = [{ data, rawPacket, time: now }, ..._receivedSOS].slice(0, MAX_LOG)
  _notify()
}

export function getReceivedSOS() {
  return _receivedSOS
}

export function onActivityChange(fn) {
  _handlers.push(fn)
  return () => {
    _handlers = _handlers.filter((h) => h !== fn)
  }
}

function _notify() {
  _handlers.forEach((fn) => fn())
}
