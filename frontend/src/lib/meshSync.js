/**
 * meshSync.js — global handler for SOS packets received via mesh.
 *
 * Call startMeshSync() once at app startup (main-app.jsx).
 * When any mesh peer relays an SOS to this device, this module:
 *   1. Stores the packet locally in IndexedDB (always)
 *   2. POSTs to the backend API if the device is online
 *   3. Sends an ACK back through the mesh with this device's role
 *   4. Emits an in-app alert for responder UI
 *   5. Fires a local push notification (native only, when enabled)
 *
 * Wire format: SOS and ACK inner payloads use compact 1–2 char field names
 * (e.g. t=type, v=victim_id, la=lat, lo=lng, si=sos_id, rr=receiver_role,
 *  sv=service_type)
 * to keep total MeshPacket JSON under the 244-byte BLE ATT write limit.
 * expandSOS() / expandACK() restore full field names for downstream consumers.
 */
import { mesh, onNativeMeshEvent, onBroadcastStatus } from './mesh'
import { db } from './db'
import api from './api'
import { emitMeshSOSAlert } from './meshAlerts'
import { addReceivedSOS, getReceivedSOS, updateACKState, getActiveSOS, logMeshEvent, setBroadcastSubState, setBroadcastErrorCode } from './meshActivityStore'
import { getNetworkOnline } from './capacitor'
import { useAuthStore } from '../store/auth'
import { useAlertStore } from '../store/alertStore'

// Canonical ACK→SOS correlator. Both IDs normalised: beacon-/ack- prefix stripped,
// whitespace trimmed, lowercased. Full UUIDs matched by exact hex; short IDs by exact string.
function _normalizeId(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/^beacon-/, '').replace(/^ack-/, '')
}
function _ackMatchesSos(activeId, incomingId) {
  const active   = _normalizeId(activeId)
  const incoming = _normalizeId(incomingId)
  if (!active || !incoming) return false
  const isUuid = v => /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/.test(v)
  // Full UUIDs must match exactly.
  if (isUuid(active) && isUuid(incoming)) return active.replace(/-/g, '') === incoming.replace(/-/g, '')
  // Short BLE beacon IDs (6–8 hex chars) matched as a strict prefix of the full UUID.
  const activeHex   = isUuid(active)   ? active.replace(/-/g, '')   : ''
  const incomingHex = isUuid(incoming) ? incoming.replace(/-/g, '') : ''
  if (activeHex   && /^[0-9a-f]{6,8}$/.test(incoming)) return activeHex.startsWith(incoming)
  if (incomingHex && /^[0-9a-f]{6,8}$/.test(active))   return incomingHex.startsWith(active)
  return active === incoming
}

let _unsubscribe    = null
let _eventUnsub     = null
let _unsubBroadcast = null
// _seenIds: Map<packetId, timestamp_ms> for time-based eviction (replay-attack hardening)
const _seenIds = new Map()
const SEEN_MAX = 300
const SEEN_TTL_MS = 5 * 60 * 1000   // 5 minutes
const MAX_RETRY_COUNT = 5

function _addSeen(id) {
  _seenIds.set(id, Date.now())
  if (_seenIds.size > SEEN_MAX) {
    // Bulk-evict: remove all entries older than TTL first
    const cutoff = Date.now() - SEEN_TTL_MS
    for (const [k, ts] of _seenIds) { if (ts < cutoff) _seenIds.delete(k) }
    // If still over limit, remove oldest 100
    if (_seenIds.size > SEEN_MAX) {
      let pruned = 0
      for (const k of _seenIds.keys()) {
        if (pruned >= 100) break
        _seenIds.delete(k); pruned++
      }
    }
  }
}

// Deterministic notification ID from packet UUID (avoids collision under burst)
function _notifId(uuid) {
  let h = 0
  for (let i = 0; i < uuid.length; i++) { h = Math.imul(31, h) + uuid.charCodeAt(i) | 0 }
  return Math.abs(h) % 2147483647 || 1
}

// Expand compact SOS inner payload to full field names
function expandSOS(data) {
  return {
    type:         data.t  ?? data.type         ?? 'sos',
    lat:          data.la ?? data.lat          ?? null,
    lng:          data.lo ?? data.lng          ?? null,
    status:       data.s  ?? data.status       ?? null,
    people_count: data.n  ?? data.people_count ?? null,
    barangay:     data.b  ?? data.barangay     ?? null,
    municipality: data.m  ?? data.municipality ?? null,
    service_type: data.sv ?? data.service_type ?? [],
  }
}

export function startMeshSync() {
  console.info('[meshSync] startMeshSync called')
  // H5 fix: if _unsubscribe exists but the native engine died (isConnected false),
  // clear the stale handler so we re-register a fresh listener.
  if (_unsubscribe && !mesh.isConnected?.()) { stopMeshSync() }
  if (_unsubscribe) return
  mesh.getStats().catch(() => {})  // eagerly trigger ensureStarted() so native listener is live before first packet
  // Subscribe to native low-level events (peer_discovered, sos_transmitted, etc.)
  _eventUnsub = onNativeMeshEvent(({ eventType, ...evData }) => logMeshEvent(eventType, evData))
  // Keep broadcastSubState updated even when SOSReport.jsx has unmounted — this
  // subscription lives for the full app session so "connecting" / "sos_transmitted"
  // events are never lost because the originating component navigated away.
  _unsubBroadcast = onBroadcastStatus(({ status, errorCode }) => {
    if (status === 'advertising_requesting') setBroadcastSubState('requesting')
    if (status === 'advertising_started') setBroadcastSubState('advertising')
    if (status === 'advertising_failed')  { setBroadcastSubState('failed'); setBroadcastErrorCode(errorCode ?? null) }
    if (status === 'awaiting_peers')      setBroadcastSubState('awaiting_peers')
    if (status === 'connecting')          setBroadcastSubState('connecting')
    if (status === 'sos_transmitted')     setBroadcastSubState('transmitted')
  })
  console.info('[meshSync] receiver pipeline subscribed')
  _unsubscribe = mesh.onMessage(async (data, rawPacket) => {
    console.log('[meshSync] onMessage entered', {
      id:           rawPacket?.id   ?? null,
      type:         rawPacket?.type ?? null,
      payloadBytes: typeof rawPacket?.payload === 'string' ? rawPacket.payload.length : 0,
    })
    // ── ACK packets — update victim's SOS status level ─────────────────────────
    if (rawPacket?.type === 'ack') {
      try {
        logMeshEvent('ack_rx_js', {
          packetId:       rawPacket.id ?? null,
          originDeviceId: rawPacket.originDeviceId ?? null,
          si:             data?.si ?? null,
        })
        const sosId    = data.si  ?? data.sos_id
        const role     = data.rr  ?? data.receiver_role  ?? 'device'
        const hopsUsed = 5 - ((data.hcr ?? data.hop_count_remaining) ?? 5)
        const cur      = getActiveSOS()
        if (sosId && _ackMatchesSos(cur.packetId, sosId)) {
          // Missing stage → 'sos_received' for backward compat with pre-stage APKs.
          const stage = data?.stage ?? 'sos_received'
          if (stage === 'beacon_seen') {
            // Receiver only saw the BLE advertisement — not the full GATT payload.
            // Log for diagnostics but do NOT advance ackLevel or ackDevices.
            logMeshEvent('ack_beacon_seen', {
              sos_id:   sosId,
              deviceId: rawPacket.originDeviceId,
              hopCount: hopsUsed,
            })
          } else {
            let newLevel = cur.ackLevel
            if ((role === 'responder' || role === 'admin') && newLevel < 4) newLevel = 4
            else if (hopsUsed >= 1 && newLevel < 3) newLevel = 3
            else if (newLevel < 2) newLevel = 2
            updateACKState({
              ackLevel:   newLevel,
              device:     { deviceId: rawPacket.originDeviceId ?? 'unknown', hopCount: hopsUsed, receiverRole: role, time: Date.now() },
              ackMaxHops: Math.max(cur.ackMaxHops, hopsUsed),
            })
            logMeshEvent('ack_received', { sos_id: sosId, deviceId: rawPacket.originDeviceId, hopCount: hopsUsed, receiverRole: role, newLevel })
          }
        } else {
          // ACK arrived but could not be matched to the active SOS — log for diagnostics.
          // reason='no_si_field'  → ACK payload missing si (old APK or encode bug)
          // reason='no_active_sos' → setActiveSOS() was never called (SOS cleared prematurely)
          // reason='id_mismatch'  → si present but doesn't match cur.packetId (different session)
          logMeshEvent('ack_unmatched', {
            incomingSosId:  sosId ?? null,
            activePacketId: cur?.packetId ?? null,
            originDeviceId: rawPacket?.originDeviceId ?? null,
            reason: !sosId
              ? 'no_si_field'
              : !cur?.packetId
                ? 'no_active_sos'
                : 'id_mismatch',
          })
        }
      } catch (err) {
        logMeshEvent('ack_processing_error', {
          error:    String(err),
          packetId: rawPacket?.id ?? null,
        })
      }
      return
    }

    if (rawPacket?.type !== 'sos') return
    const packetId = rawPacket.id
    if (packetId && _seenIds.has(packetId)) {
      logMeshEvent('duplicate_detected', { packetId, originDeviceId: rawPacket.originDeviceId ?? 'unknown' })
      return
    }
    if (packetId) _addSeen(packetId)

    // Expand compact field names to full names for all downstream use
    // Guard against null data (beacon packets may deliver data={} or payload="null")
    const expanded = expandSOS(data ?? {})

    console.log('[meshSync] SOS received via mesh', rawPacket.id, 'hops:', rawPacket.hopCount)

    try {
      // ── UI updates first — never block these on network I/O ───────────────────
      // RC-10: moved before api.post so the SOS shows immediately even when the
      // XAMPP backend is unreachable (WiFi connected but server down causes api.post
      // to hang for the full HTTP timeout, blocking these calls in the old order).
      // Duplicate guard: check BEFORE addReceivedSOS so we can skip db.queueSOS on
      // re-ACK'd duplicate SOS packets (forwarded again by Kotlin after 30s cooldown).
      // Normalize beacon-ID (beacon-XXXXXX) and full UUID to the same 6-char prefix so
      // a GATT packet arriving after its beacon is treated as a duplicate, not a new SOS.
      function _shortId(id) {
        if (!id) return ''
        if (id.startsWith('beacon-')) return id.slice(7, 13).toLowerCase()
        return id.replace(/-/g, '').slice(0, 6).toLowerCase()
      }
      const shortId = _shortId(rawPacket.id)
      const alreadyReceived = getReceivedSOS().some(s =>
        s.rawPacket?.id === rawPacket.id ||
        (shortId && _shortId(s.rawPacket?.id) === shortId)
      )
      addReceivedSOS(expanded, rawPacket)
      logMeshEvent('sos_received', {
        packetId:       rawPacket.id         ?? null,
        barangay:       expanded.barangay    ?? 'Unknown',
        status:         expanded.status      ?? 'sos',
        peopleCount:    expanded.people_count ?? null,
        hops:           5 - (rawPacket.hopCount ?? 5),
        originDeviceId: rawPacket.originDeviceId ?? 'unknown',
      })
      console.log('[meshSync] SOS alert emitted to UI subscribers', rawPacket.id)
      emitMeshSOSAlert(expanded, rawPacket)

      // ── RC3: persist locally FIRST — before ACK and before backend ─────────────
      // Skip DB write for duplicates (re-ACK path) to prevent double IndexedDB entries.
      const role = useAuthStore.getState().role ?? 'device'
      let localId
      if (!alreadyReceived) {
        try {
          localId = await db.queueSOS({
            ...expanded,
            receivedViaMesh: true,
            meshOriginId: rawPacket.originDeviceId,
            meshPacketId: rawPacket.id,
            timestamp: rawPacket.timestamp ?? Date.now(),
          })
          console.log('[meshSync] SOS saved to IndexedDB', expanded.barangay, expanded.municipality)
          logMeshEvent('sos_stored_locally', { sos_id: rawPacket.id, local_id: localId, barangay: expanded.barangay })
        } catch (dbErr) {
          console.warn('[meshSync] IndexedDB write failed:', dbErr.message)
          logMeshEvent('sos_persist_failed', { sos_id: rawPacket.id, error: String(dbErr) })
        }
      }

      // ── ACK — sent after local persist (or skipped persist for duplicate) ───────
      // Guard: skip if packet lacks identity fields (malformed beacon with null id/origin).
      if (!rawPacket.id || !rawPacket.originDeviceId) {
        logMeshEvent('ack_skipped', { reason: 'missing_packet_identity', rawId: rawPacket?.id ?? null })
        return
      }

      logMeshEvent('ack_send_started', {
        sos_id:        rawPacket.id,
        receiver_role: role,
      })

      const isProvisional = data?.provisional === true || data?.source === 'ble_beacon'
      try {
        const ackResult = await mesh.broadcast({
          t:     'ack',
          si:    rawPacket.id,
          hcr:   rawPacket.hopCount,
          rr:    role,
          stage: isProvisional ? 'beacon_seen' : 'sos_received',
          v:     1,
        })

        if (ackResult?.success === true) {
          logMeshEvent('ack_queued', {
            sos_id:              rawPacket.id,
            ack_packet_id:       ackResult.packetId ?? null,
            receiver_role:       role,
            transport:           ackResult.transport ?? 'unknown',
            hop_count_remaining: rawPacket.hopCount,
            barangay:            expanded.barangay ?? null,
            status:              'transport_accepted',
          })
        } else {
          logMeshEvent('ack_send_failed', {
            sos_id:   rawPacket.id,
            reason:   'broadcast_not_accepted',
            response: ackResult ?? null,
          })
        }
      } catch (ackErr) {
        logMeshEvent('ack_send_failed', {
          sos_id: rawPacket.id,
          reason: String(ackErr),
        })
      }

      // ── Backend sync in background — does NOT gate the ACK ───────────────────
      if (getNetworkOnline()) {
        api.post('/sos', {
          ...expanded,
          relay_source:   rawPacket.originDeviceId,
          mesh_packet_id: rawPacket.id,
        }).then(async (serverResponse) => {
          console.log('[meshSync] SOS relayed to Supabase', rawPacket.id)
          if (localId) {
            try { await db.markSOSSynced(localId, serverResponse?.id) } catch {}
          }
          logMeshEvent('sos_persisted', { sos_id: rawPacket.id, server_id: serverResponse?.id })
        }).catch(() => {
          logMeshEvent('backend_sync_pending', { sos_id: rawPacket.id })
        })
      } else {
        logMeshEvent('backend_sync_pending', { sos_id: rawPacket.id })
      }

      // ── Local push notification ───────────────────────────────────────────────
      if (window.Capacitor?.isNativePlatform?.()) {
        const notificationsEnabled = useAlertStore.getState()?.notificationEnabled ?? true
        if (notificationsEnabled) {
          try {
            const { LocalNotifications } = await import('@capacitor/local-notifications')
            await LocalNotifications.schedule({
              notifications: [{
                id: _notifId(rawPacket.id ?? String(Date.now())),
                title: 'SOS Received via Mesh',
                body: `${(expanded.status ?? 'EMERGENCY').toUpperCase()} · ${expanded.barangay ?? 'Unknown'} · ${5 - (rawPacket.hopCount ?? 5)} hop(s)`,
                schedule: { at: new Date(Date.now() + 100) },
              }],
            })
          } catch (e) {
            console.warn('[meshSync] local notification failed:', e.message)
          }
        }
      }
    } catch (e) {
      console.error('[meshSync] handler crash — SOS may not have been fully processed:', e)
    }
  })
  // Gap 3 fix: auto-drain offline queue whenever connectivity is restored.
  if (window.Capacitor?.isNativePlatform?.()) {
    import('@capacitor/network').then(({ Network }) => {
      Network.addListener('networkStatusChange', (status) => {
        if (status.connected) drainOfflineQueue()
      })
    }).catch(() => {})
  }
  // Backfill peer_discovered events for peers already known when this subscription
  // started (the BLE engine may have discovered peers before startMeshSync() ran).
  mesh.getPeers().then(peers => {
    peers.forEach(p => logMeshEvent('peer_discovered', {
      address: p.id, transport: p.transport ?? 'BLE', source: 'backfill',
    }))
  }).catch(() => {})
  // Drain offline queue immediately if already connected (Gap 3 only fires on change).
  if (getNetworkOnline()) drainOfflineQueue()
}

export function stopMeshSync() {
  _unsubscribe?.()
  _unsubscribe = null
  _eventUnsub?.()
  _eventUnsub = null
  _unsubBroadcast?.()
  _unsubBroadcast = null
}

export async function drainOfflineQueue() {
  try {
    const pending = await db.getPendingSOS()
    if (!pending.length) return
    console.log('[meshSync] draining', pending.length, 'queued SOS record(s)')
    let drained = 0
    for (const item of pending) {
      // Skip permanently failed items
      if ((item.retryCount ?? 0) >= MAX_RETRY_COUNT) {
        console.warn('[meshSync] skipping localId', item.localId, '— exceeded max retries')
        continue
      }
      try {
        const serverResponse = await api.post('/sos', {
          ...item,
          relay_source:   item.receivedViaMesh ? item.meshOriginId : null,
          mesh_packet_id: item.meshPacketId ?? null,
        })
        await db.markSOSSynced(item.localId, serverResponse?.id)
        console.log('[meshSync] drained localId', item.localId)
        drained++
      } catch (e) {
        console.warn('[meshSync] drain failed for localId', item.localId, e?.message)
        try { await db.addRetryCount(item.localId) } catch {}
      }
    }
    if (drained > 0) {
      logMeshEvent('sync_completed', { count: drained })
      // Purge old synced records (older than 7 days) to keep IndexedDB lean
      try { await db.purgeSyncedSOS() } catch {}
    }
  } catch (e) {
    console.warn('[meshSync] drainOfflineQueue error:', e?.message)
  }
}
