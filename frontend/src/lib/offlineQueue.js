// Offline SOS queue drain — re-sends SOS reports saved to IndexedDB while offline.
// Called by capacitor.js on startup and whenever connectivity is restored.
import { db } from './db'
import api from './api'
import { supabase } from './supabase'
import { sendEmergencySMS, isSMSCapable } from './smsPlugin'
import { PHILSMS_RECEIVING_NUMBER } from './smsConfig'

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

// Drain SMS-pending records: when internet is not available but cellular is, retry
// any records that were queued with smsStatus 'pending' (SMS was not attempted yet).
// Called from capacitor.js on startup when only cellular connectivity is detected.
export async function drainSMSPendingQueue() {
  if (!isSMSCapable()) return
  try {
    const all = await db.getPendingSOS()
    const smsUnsent = all.filter(r => r.smsStatus === 'pending' && r.source === 'sms')
    if (!smsUnsent.length) return
    console.log('[offlineQueue] retrying SMS for', smsUnsent.length, 'queued record(s)')
    for (const item of smsUnsent) {
      try {
        const svcArr = Array.isArray(item.service_type) ? item.service_type : [item.service_type ?? 'mdrrmo']
        const lines = [
          'SURVAIvePH SOS',
          `ID: SVP-${(item.meshPacketId ?? item.mesh_packet_id ?? '').slice(0, 8).toUpperCase()}`,
          `TYPE: ${svcArr[0]?.toUpperCase() ?? 'GENERAL'}`,
          `STATUS: ${(item.status ?? 'unknown').toUpperCase()}`,
          `LOC: ${[item.barangay, item.municipality].filter(Boolean).join(', ') || 'UNKNOWN'}`,
        ]
        if (item.lat && item.lng) lines.push(`GPS: ${Number(item.lat).toFixed(4)},${Number(item.lng).toFixed(4)}`)
        if (item.notes) lines.push(`MSG: ${String(item.notes).slice(0, 80)}`)
        const message = lines.join('\n')
        await sendEmergencySMS({
          reportId:  item.meshPacketId ?? item.mesh_packet_id ?? String(item.localId),
          recipient: PHILSMS_RECEIVING_NUMBER,
          message,
        })
        await db.markSMSSent(item.localId)
        console.log('[offlineQueue] SMS retry succeeded for localId', item.localId)
      } catch (e) {
        console.warn('[offlineQueue] SMS retry failed for localId', item.localId, e?.message)
      }
    }
  } catch (e) {
    console.warn('[offlineQueue] drainSMSPendingQueue error:', e?.message)
  }
}

// Drain pending AI review updates that were queued in localStorage while offline.
export async function drainPendingReviews() {
  let queue = []
  try {
    queue = JSON.parse(localStorage.getItem('survAIve-pending-reviews') ?? '[]')
  } catch { return }
  if (!queue.length) return

  console.log('[offlineQueue] draining', queue.length, 'pending AI review(s)')
  const failed = []
  for (const item of queue) {
    try {
      const { error } = await supabase
        .from('sos_reports')
        .update(item.payload)
        .eq('id', item.reportId)
      if (error) throw new Error(error.message)
      console.log('[offlineQueue] synced AI review for reportId', item.reportId)
    } catch (e) {
      console.warn('[offlineQueue] AI review sync failed for reportId', item.reportId, e?.message)
      failed.push(item)
    }
  }
  try {
    if (failed.length) {
      localStorage.setItem('survAIve-pending-reviews', JSON.stringify(failed))
    } else {
      localStorage.removeItem('survAIve-pending-reviews')
    }
  } catch { /* ignore */ }
}
