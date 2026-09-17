/**
 * meshSync.js — global handler for SOS packets received via mesh.
 *
 * Call startMeshSync() once at app startup (main-app.jsx).
 * When any mesh peer relays an SOS to this device, this module:
 *   1. Stores the packet locally in IndexedDB (always)
 *   2. POSTs to the backend API if the device is online
 */
import { mesh } from './mesh'
import { db } from './db'
import api from './api'

let _unsubscribe = null

export function startMeshSync() {
  if (_unsubscribe) return
  _unsubscribe = mesh.onMessage(async (data, rawPacket) => {
    if (rawPacket?.type !== 'sos') return
    try {
      await db.queueSOS({
        ...data,
        receivedViaMesh: true,
        meshOriginId: rawPacket.originDeviceId,
        timestamp: rawPacket.timestamp ?? Date.now(),
      })
    } catch {}
    if (navigator.onLine) {
      try {
        await api.post('/sos', {
          ...data,
          relay_source: rawPacket.originDeviceId,
        })
      } catch {}
    }
  })
}

export function stopMeshSync() {
  _unsubscribe?.()
  _unsubscribe = null
}
