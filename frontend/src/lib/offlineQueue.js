// Offline SOS queue drain — re-sends SOS reports saved to IndexedDB while offline.
// Called by capacitor.js on startup and whenever connectivity is restored.
import { db } from './db'
import api from './api'

const MAX_RETRY_COUNT = 5

export async function drainOfflineQueue() {
  try {
    const pending = await db.getPendingSOS()
    if (!pending.length) return
    console.log('[offlineQueue] draining', pending.length, 'queued SOS record(s)')
    let drained = 0
    for (const item of pending) {
      // Skip permanently failed items
      if ((item.retryCount ?? 0) >= MAX_RETRY_COUNT) {
        console.warn('[offlineQueue] skipping localId', item.localId, '— exceeded max retries')
        continue
      }
      try {
        const serverResponse = await api.post('/sos', {
          ...item,
          // mesh_packet_id is the client-generated dedup UUID (legacy name) — the
          // backend's UNIQUE constraint uses it to reject duplicate submissions.
          mesh_packet_id: item.meshPacketId ?? null,
        })
        await db.markSOSSynced(item.localId, serverResponse?.id)
        console.log('[offlineQueue] drained localId', item.localId)
        drained++
      } catch (e) {
        console.warn('[offlineQueue] drain failed for localId', item.localId, e?.message)
        try { await db.addRetryCount(item.localId) } catch {}
      }
    }
    if (drained > 0) {
      // Purge old synced records (older than 7 days) to keep IndexedDB lean
      try { await db.purgeSyncedSOS() } catch {}
    }
  } catch (e) {
    console.warn('[offlineQueue] drainOfflineQueue error:', e?.message)
  }
}
