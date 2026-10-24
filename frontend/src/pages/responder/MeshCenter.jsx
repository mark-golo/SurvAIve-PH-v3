import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getResponderTheme } from '../../lib/victimTheme'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio, Wifi, Battery, AlertTriangle, Home, List, Map, Settings,
  Activity, CheckCircle2, XCircle, ArrowRightLeft, RefreshCw, Archive,
  ZapOff, Users, Gauge, Wrench, ToggleLeft, ToggleRight, Search,
  ChevronDown, ChevronUp, Bluetooth,
} from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { mesh } from '../../lib/mesh'
import { db } from '../../lib/db'
import { MeshNetwork } from '../../plugins/MeshNetworkPlugin'
import { getReceivedSOS, getMeshEventLog, onActivityChange } from '../../lib/meshActivityStore'
import { useAlertStore } from '../../store/alertStore'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Mesh',     path: '/responder/mesh'     },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

const TABS = [
  { key: 'overview',    label: 'Overview',    Icon: Gauge         },
  { key: 'peers',       label: 'Peers',       Icon: Users         },
  { key: 'activity',    label: 'Activity',    Icon: Activity      },
  { key: 'tracker',     label: 'Tracker',     Icon: Search        },
  { key: 'diagnostics', label: 'Diag',        Icon: Wrench        },
  { key: 'settings',    label: 'Settings',    Icon: Settings      },
]

const EVENT_META = {
  sos_broadcast:          { label: 'SOS Broadcast Sent',          color: '#f59e0b', Icon: Radio          },
  broadcast_started:      { label: 'BLE Advertising Started',     color: '#22c55e', Icon: Radio          },
  broadcast_failed:       { label: 'BLE Advertising Failed',      color: '#ef4444', Icon: ZapOff         },
  peer_discovered:        { label: 'Peer Discovered',             color: '#00d4ff', Icon: Wifi           },
  connection_established: { label: 'GATT Connection',             color: '#22c55e', Icon: Wifi           },
  peer_disconnected:      { label: 'Peer Disconnected',           color: '#8b5cf6', Icon: Wifi           },
  sos_transmitted:        { label: 'SOS GATT Write Confirmed — Receiver ACK Pending', color: '#22c55e', Icon: CheckCircle2 },
  sos_received:           { label: 'SOS Received via Mesh',       color: '#ef4444', Icon: AlertTriangle  },
  sos_stored_locally:     { label: 'SOS Stored Offline',          color: '#8b5cf6', Icon: Archive        },
  sos_acknowledged:       { label: 'SOS Acknowledged',            color: '#22c55e', Icon: CheckCircle2   },
  sos_relayed:            { label: 'SOS Relayed',                 color: '#00d4ff', Icon: ArrowRightLeft  },
  ack_sent:               { label: 'ACK Sent',                    color: '#22c55e', Icon: CheckCircle2   },
  ack_received:           { label: 'ACK Received',                color: '#22c55e', Icon: CheckCircle2   },
  duplicate_detected:     { label: 'Duplicate Suppressed',        color: '#6b7280', Icon: XCircle        },
  transmission_failed:    { label: 'Transmission Failed',         color: '#ef4444', Icon: XCircle        },
  retry_attempted:        { label: 'Retry Attempted',             color: '#f59e0b', Icon: RefreshCw      },
  sync_completed:         { label: 'Offline Queue Synced',        color: '#22c55e', Icon: Archive        },
  scan_started:           { label: 'BLE Scan Started',            color: '#00d4ff', Icon: Radio          },
  scan_failed:            { label: 'BLE Scan Failed',             color: '#ef4444', Icon: ZapOff         },
  scanner_null:           { label: 'Scanner Null (retrying)',      color: '#f59e0b', Icon: ZapOff         },
  beacon_decoded:         { label: 'Beacon Decoded',              color: '#00d4ff', Icon: Radio          },
  sos_beacon_queued:      { label: 'SOS Beacon Queued — receipt not confirmed', color: '#f59e0b', Icon: Radio },
  sos_beacon_retry_held:   { label: 'SOS Beacon Retry Held — another beacon active', color: '#f59e0b', Icon: Activity },
  sos_beacon_encode_failed:{ label: 'SOS Beacon Encoding Failed — GATT may still work', color: '#ef4444', Icon: XCircle },
  backend_sync_pending:    { label: 'SOS Stored Locally — Backend Sync Pending', color: '#f59e0b', Icon: Archive },
  ack_beacon_deferred:    { label: 'ACK Beacon Deferred to Preserve SOS', color: '#f59e0b', Icon: Activity },
  ack_transmitted:        { label: 'ACK GATT Write Confirmed',        color: '#22c55e', Icon: CheckCircle2 },
  packet_transmitted:     { label: 'Packet GATT Write Confirmed',     color: '#22c55e', Icon: CheckCircle2 },
  scan_permission_denied: { label: 'BLE Scan Permission Failure',     color: '#ef4444', Icon: ZapOff },
  gatt_server_unavailable:{ label: 'GATT Server Unavailable',         color: '#ef4444', Icon: ZapOff },
  gatt_service_add_rejected:{ label: 'GATT Service Registration Failed', color: '#ef4444', Icon: ZapOff },
  ack_transport_accepted: { label: 'ACK Transport Accepted — not receipt proof', color: '#f59e0b', Icon: Activity },
  ack_transport_pending:  { label: 'ACK Waiting for Nearby Peer',     color: '#f59e0b', Icon: RefreshCw },
  ack_broadcast_error:    { label: 'ACK Broadcast Error',             color: '#ef4444', Icon: XCircle },
  ack_deferred_storage_failure:{ label: 'ACK Deferred — SOS Not Stored', color: '#ef4444', Icon: Archive },
  sos_persisted:          { label: 'SOS Persisted',                   color: '#22c55e', Icon: Archive },
  sos_mirrored_locally:   { label: 'SOS Mirrored Locally',            color: '#22c55e', Icon: Archive },
}

function ago(ms) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 5)  return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function peerAlias(id) {
  if (!id) return 'Unknown'
  const clean = id.replace(/:/g, '')
  return clean.slice(0, 4).toUpperCase() + '…' + clean.slice(-2).toUpperCase()
}

function getEventSubtext(e) {
  const d = e.data ?? {}
  const parts = []
  if (d.packetId)        parts.push(d.packetId.slice(-8))
  if (d.peerId)          parts.push('Peer: ' + peerAlias(d.peerId))
  if (d.originDeviceId)  parts.push('Origin: ' + peerAlias(d.originDeviceId))
  if (d.hopCount != null) parts.push(String(d.hopCount) + ' hop' + (String(d.hopCount) !== '1' ? 's' : ''))
  if (d.barangay)        parts.push(d.barangay)
  if (d.errorCode != null) parts.push('Error: ' + d.errorCode)
  if (d.count   != null) parts.push(d.count + ' packets')
  if (d.status)          parts.push(d.status)
  return parts.join(' · ')
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ stats, peers, receivedSOS, eventLog, relayOn, setRelayOn }) {
  // Count only confirmed ATT write responses. "Transport accepted" means queued/attempted, not received.
  const acksSent = eventLog.filter(e => e.type === 'ack_transmitted').length
  const relayed  = eventLog.filter(e => e.type === 'sos_relayed').length
  const synced   = eventLog.filter(e => e.type === 'sync_completed').reduce((a, e) => a + (e.data?.count ?? 0), 0)
  const errors   = eventLog.filter(e => e.type === 'transmission_failed').length

  return (
    <div className="space-y-4">
      {/* Node visualization */}
      <GlassCard className="text-center py-5">
        <div className="relative inline-flex items-center justify-center">
          {relayOn && [1, 2, 3].map(i => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-[rgba(34,197,94,0.3)]"
              style={{ width: `${56 + i * 32}px`, height: `${56 + i * 32}px` }}
              animate={{ opacity: [0.6, 0.1, 0.6], scale: [1, 1.05, 1] }}
              transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
            />
          ))}
          <div className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            relayOn
              ? 'bg-[rgba(34,197,94,0.2)] border-2 border-[rgba(34,197,94,0.5)] shadow-[0_0_30px_rgba(34,197,94,0.4)]'
              : 'bg-[rgba(107,114,128,0.2)] border-2 border-[rgba(107,114,128,0.3)]'
          }`}>
            <Radio size={26} className={relayOn ? 'text-[#22c55e]' : 'text-slate-500'} />
          </div>
        </div>
        <p className={`text-base font-bold mt-5 ${relayOn ? 'text-[#22c55e]' : 'text-slate-400'}`}>
          {relayOn ? 'Active Relay Mode' : 'Relay Off'}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {relayOn ? 'Forwarding emergency messages from nearby devices' : 'Not relaying mesh traffic'}
        </p>
        <div className="mt-3">
          <NeonButton variant={relayOn ? 'ghost' : 'green'} size="sm"
            onClick={async () => { const n = !relayOn; setRelayOn(n); await mesh.setRelay(n) }}>
            {relayOn ? 'Disable Relay' : 'Enable Relay'}
          </NeonButton>
        </div>
      </GlassCard>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Peers Nearby',   value: stats.peersNearby, color: '#22c55e' },
          { label: 'Transport',      value: stats.transport ?? '—', color: '#00d4ff' },
          { label: 'SOS Received',   value: receivedSOS.length, color: '#ef4444' },
          { label: 'ACK Writes Confirmed', value: acksSent, color: '#22c55e' },
          { label: 'Relayed',        value: relayed, color: '#00d4ff' },
          { label: 'Server Synced',  value: synced, color: '#8b5cf6' },
          { label: 'Relay On',       value: stats.relayEnabled ? 'Yes' : 'No', color: stats.relayEnabled ? '#22c55e' : '#6b7280' },
          { label: 'Errors',         value: errors, color: errors > 0 ? '#ef4444' : '#6b7280' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass rounded-xl p-3 text-center">
            <p className="text-xl font-black" style={{ color }}>{value}</p>
            <p className="text-[9px] text-slate-500 uppercase mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {receivedSOS.length > 0 && (
        <GlassCard>
          <p className="text-xs font-semibold text-[#ef4444] uppercase tracking-wider mb-3">
            Received SOS via Mesh
          </p>
          <div className="space-y-0">
            <AnimatePresence>
              {receivedSOS.slice(0, 5).map((entry, i) => (
                <motion.div
                  key={entry.rawPacket?.id ?? i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0"
                >
                  <AlertTriangle size={13} className="text-[#ef4444] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {(entry.data.status ?? 'SOS').toUpperCase()} · {entry.data.barangay ?? 'Unknown'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {entry.data.people_count ? `${entry.data.people_count}p · ` : ''}
                      {5 - (entry.rawPacket?.hopCount ?? 5)} hop(s) · {ago(entry.time)}
                      {entry.data.service_type?.length > 0 && ` · ${entry.data.service_type.join(', ')}`}
                    </p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(239,68,68,0.15)] text-[#ef4444] font-bold shrink-0">
                    ACK SENT
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </GlassCard>
      )}

      {relayOn && (
        <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.3)] flex items-start gap-2">
          <Battery size={13} className="text-[#f59e0b] shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400">
            Active relay mode increases battery consumption. Consider charging your device.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Tab: Peers ────────────────────────────────────────────────────────────────

function PeersTab({ peers, stats }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="glass rounded-xl p-3 flex-1 text-center">
          <p className="text-2xl font-black text-[#22c55e]">{stats.peersNearby}</p>
          <p className="text-[9px] text-slate-500 uppercase mt-0.5">Discovered</p>
        </div>
        <div className="glass rounded-xl p-3 flex-1 text-center">
          <p className="text-2xl font-black text-[#00d4ff]">{stats.transport ?? '—'}</p>
          <p className="text-[9px] text-slate-500 uppercase mt-0.5">Transport</p>
        </div>
      </div>

      <GlassCard>
        <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">
          {peers.length > 0 ? `${peers.length} Peer(s) in Range` : 'No peers in range'}
        </p>
        {peers.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            Enable BLE and wait for nearby devices to be discovered
          </p>
        ) : (
          <div className="space-y-0">
            {peers.map(peer => (
              <div key={peer.id} className="flex items-center gap-3 py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                <Wifi size={13} className="text-[#00d4ff] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{peerAlias(peer.id)}</p>
                  <p className="text-[10px] text-slate-500">
                    {peer.transport ?? 'BLE'} · {ago(peer.lastSeen)}
                    {(peer.relayEnabled ?? peer.isRelaying) ? ' · relaying' : ''}
                  </p>
                </div>
                <div className="flex gap-0.5 items-end h-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i}
                      className={`w-1.5 rounded-sm ${i <= (peer.signal ?? 2) ? 'bg-[#22c55e]' : 'bg-slate-700'}`}
                      style={{ height: `${i * 25}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

// ── Tab: Activity ─────────────────────────────────────────────────────────────

function ActivityTab({ eventLog }) {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  const filterKeys = ['all', 'sos', 'ack', 'peer', 'error']
  const filterMap = {
    sos:   ['sos_received', 'sos_transmitted', 'sos_relayed', 'sos_broadcast', 'sos_stored_locally'],
    ack:   ['ack_sent', 'ack_received', 'sos_acknowledged'],
    peer:  ['peer_discovered', 'connection_established', 'peer_disconnected'],
    error: ['transmission_failed', 'broadcast_failed', 'scan_failed', 'scanner_null'],
  }

  const filtered = filter === 'all' ? eventLog : eventLog.filter(e => (filterMap[filter] ?? []).includes(e.type))

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {filterKeys.map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-all ${
              filter === k
                ? 'bg-[rgba(0,212,255,0.2)] text-[#00d4ff] border border-[rgba(0,212,255,0.4)]'
                : 'text-slate-500 border border-[rgba(255,255,255,0.08)] hover:text-slate-300'
            }`}>
            {k}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-600 self-center">{filtered.length} events</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <Activity size={32} className="text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No events in this category yet</p>
        </div>
      ) : (
        <div className="space-y-0">
          {filtered.map(e => {
            const meta = EVENT_META[e.type] ?? { label: e.type, color: '#6b7280', Icon: Activity }
            const { Icon, color, label } = meta
            const sub = getEventSubtext(e)
            const isOpen = expanded === e.id
            return (
              <div key={e.id} className="border-b border-[rgba(255,255,255,0.05)] last:border-0">
                <button
                  className="w-full flex items-center gap-3 py-2.5 text-left"
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                >
                  <Icon size={13} style={{ color }} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{label}</p>
                    {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
                  </div>
                  <span className="text-[9px] text-slate-600 shrink-0 mr-1">{ago(e.time)}</span>
                  {isOpen ? <ChevronUp size={12} className="text-slate-500 shrink-0" /> : <ChevronDown size={12} className="text-slate-600 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="ml-7 mb-2 bg-[rgba(0,0,0,0.3)] rounded p-2">
                    <p className="text-[10px] text-slate-400 font-mono break-all">
                      {JSON.stringify(e.data ?? {}, null, 2)}
                    </p>
                    <p className="text-[9px] text-slate-600 mt-1">{new Date(e.time).toLocaleString()}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Tracker ──────────────────────────────────────────────────────────────

function TrackerTab({ receivedSOS, eventLog }) {
  const [search, setSearch] = useState('')

  const results = receivedSOS.filter(e => {
    if (!search) return true
    const id = e.rawPacket?.id ?? ''
    const origin = e.rawPacket?.originDeviceId ?? ''
    const brgy = e.data?.barangay ?? ''
    return id.toLowerCase().includes(search.toLowerCase()) ||
           origin.toLowerCase().includes(search.toLowerCase()) ||
           brgy.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search SOS ID, origin, barangay…"
          className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-xl
                     pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none
                     focus:border-[rgba(0,212,255,0.4)]"
        />
      </div>

      {results.length === 0 ? (
        <div className="text-center py-10">
          <Search size={32} className="text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            {search ? 'No matching SOS entries' : 'Received SOS messages will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((entry, i) => {
            const id = entry.rawPacket?.id ?? `entry-${i}`
            const relatedEvents = eventLog.filter(e =>
              e.data?.packetId?.endsWith(id.slice(-8)) ||
              e.data?.sos_id?.endsWith(id.slice(-8))
            )
            const ackEvents = relatedEvents.filter(e => e.type === 'ack_sent' || e.type === 'ack_received')
            const relayEvents = relatedEvents.filter(e => e.type === 'sos_relayed')
            const syncEvent = relatedEvents.find(e => e.type === 'sync_completed')
            return (
              <GlassCard key={id}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-black text-[#ef4444]">
                      {(entry.data.status ?? 'SOS').toUpperCase()}
                    </p>
                    <p className="text-[10px] text-slate-400">{entry.data.barangay ?? 'Unknown'}, {entry.data.municipality ?? ''}</p>
                  </div>
                  <p className="text-[9px] text-slate-600">{ago(entry.time)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: `${entry.data.people_count ?? '?'} person(s)`, color: '#f59e0b' },
                    { label: `${5 - (entry.rawPacket?.hopCount ?? 5)} hop(s)`, color: '#00d4ff' },
                    ...(entry.data.service_type?.map(t => ({ label: t.toUpperCase(), color: '#8b5cf6' })) ?? []),
                  ].map(({ label, color }, ci) => (
                    <span key={ci} className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase"
                      style={{ background: color + '22', color }}>
                      {label}
                    </span>
                  ))}
                </div>
                <div className="space-y-1">
                  <DeliveryRow icon={CheckCircle2} color="#22c55e"
                    label="ACK Sent" count={ackEvents.length} />
                  <DeliveryRow icon={ArrowRightLeft} color="#00d4ff"
                    label="Relayed" count={relayEvents.length} />
                  <DeliveryRow icon={Archive} color="#8b5cf6"
                    label="Server Sync" count={syncEvent ? 1 : 0} />
                </div>
                <p className="text-[9px] text-slate-700 mt-2 font-mono">
                  ID: {id.slice(-12)}
                </p>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DeliveryRow({ icon: Icon, color, label, count }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={11} style={{ color }} className="shrink-0" />
      <p className="text-[10px] text-slate-400 flex-1">{label}</p>
      <span className="text-[10px] font-bold" style={{ color: count > 0 ? color : '#4b5563' }}>
        {count > 0 ? count : '—'}
      </span>
    </div>
  )
}

// ── Tab: Diagnostics ──────────────────────────────────────────────────────────

function DiagnosticsTab({ stats, eventLog }) {
  const [queueCount, setQueueCount] = useState(null)

  useEffect(() => {
    db.getPendingSOS().then(p => setQueueCount(p.length)).catch(() => setQueueCount(0))
  }, [])

  const recentErrors = eventLog.filter(e =>
    ['transmission_failed','broadcast_failed','scan_failed','scanner_null'].includes(e.type)
  ).slice(0, 5)

  const rows = [
    { label: 'Mesh engine',       value: stats.transport !== 'not started' ? 'Running' : 'Stopped', ok: stats.transport !== 'not started' },
    { label: 'Active transport',  value: stats.transport ?? 'none',        ok: stats.transport && stats.transport !== 'none' && stats.transport !== 'not started' },
    { label: 'Peers discovered',  value: String(stats.peersNearby),        ok: stats.peersNearby > 0 },
    { label: 'Relay enabled',     value: stats.relayEnabled ? 'Yes' : 'No', ok: stats.relayEnabled },
    { label: 'IDB queue (pending)', value: queueCount === null ? '…' : String(queueCount), ok: queueCount === 0 },
  ]

  return (
    <div className="space-y-4">
      <GlassCard>
        <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">
          System Status
        </p>
        <div className="space-y-2">
          {rows.map(({ label, value, ok }) => (
            <div key={label} className="flex items-center gap-2">
              {ok
                ? <CheckCircle2 size={12} className="text-[#22c55e] shrink-0" />
                : <XCircle     size={12} className="text-[#ef4444] shrink-0" />}
              <p className="text-xs text-slate-400 flex-1">{label}</p>
              <p className="text-xs font-semibold" style={{ color: ok ? '#22c55e' : '#ef4444' }}>{value}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {recentErrors.length > 0 && (
        <GlassCard>
          <p className="text-xs font-semibold text-[#ef4444] uppercase tracking-wider mb-3">
            Recent Errors
          </p>
          <div className="space-y-1">
            {recentErrors.map(e => {
              const meta = EVENT_META[e.type] ?? { label: e.type, color: '#ef4444', Icon: XCircle }
              return (
                <div key={e.id} className="flex items-start gap-2">
                  <meta.Icon size={11} style={{ color: meta.color }} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-white">{meta.label}</p>
                    <p className="text-[10px] text-slate-500">{getEventSubtext(e)} · {ago(e.time)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      )}

      {recentErrors.length === 0 && (
        <div className="text-center py-6">
          <CheckCircle2 size={28} className="text-[#22c55e] mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-semibold">No recent errors</p>
        </div>
      )}
    </div>
  )
}

// ── Tab: Settings ─────────────────────────────────────────────────────────────

function SettingsTab({ relayOn, setRelayOn }) {
  const notificationEnabled  = useAlertStore(s => s.notificationEnabled ?? true)
  const toggleNotification   = useAlertStore(s => s.toggleNotification)

  return (
    <div className="space-y-3">
      <GlassCard>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Mesh Engine
        </p>
        <div className="space-y-3">
          <ToggleRow
            label="Relay Mode"
            description="Forward emergency messages through this device"
            on={relayOn}
            onToggle={async () => {
              const n = !relayOn
              setRelayOn(n)
              await mesh.setRelay(n)
            }}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Notifications
        </p>
        <ToggleRow
          label="Push Notifications"
          description="Local alerts when an SOS arrives via mesh"
          on={notificationEnabled}
          onToggle={() => toggleNotification?.()}
        />
      </GlassCard>

      <GlassCard>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Radios
        </p>
        <NeonButton
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => MeshNetwork.enableRadios().catch(() => {})}
        >
          <Bluetooth size={13} className="mr-1" />
          Enable BT + WiFi
        </NeonButton>
      </GlassCard>
    </div>
  )
}

function ToggleRow({ label, description, on, onToggle }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <p className="text-xs font-semibold text-white">{label}</p>
        {description && <p className="text-[10px] text-slate-500">{description}</p>}
      </div>
      <button onClick={onToggle} className="shrink-0">
        {on
          ? <ToggleRight size={24} className="text-[#22c55e]" />
          : <ToggleLeft  size={24} className="text-slate-500" />}
      </button>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function MeshCenter() {
  const navigate = useNavigate()
  const [isLight] = useState(() => getResponderTheme() === 'light')
  const [activeTab, setActiveTab] = useState('overview')
  const [relayOn, setRelayOn]   = useState(true)
  const [peers,   setPeers]     = useState([])
  const [stats,   setStats]     = useState({ peersNearby: 0, transport: '—', relayEnabled: false })
  const [receivedSOS, setReceivedSOS] = useState(getReceivedSOS)
  const [eventLog,    setEventLog]    = useState(getMeshEventLog)

  useEffect(() => onActivityChange(() => {
    setReceivedSOS(getReceivedSOS())
    setEventLog(getMeshEventLog())
  }), [])

  const loadStats = useCallback(async () => {
    try {
      const s = await mesh.getStats()
      setStats(s)
      setRelayOn(s.relayEnabled ?? true)
    } catch {}
    try { setPeers(await mesh.getPeers()) } catch {}
  }, [])

  useEffect(() => {
    loadStats()
    const t = setInterval(loadStats, 3000)
    return () => clearInterval(t)
  }, [loadStats])

  const tabProps = { stats, peers, receivedSOS, eventLog, relayOn, setRelayOn }

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Mesh Center" subtitle="Emergency mesh network" onBack />

      {/* Tab bar — horizontal scroll on small screens */}
      <div className="flex shrink-0 border-b border-[rgba(255,255,255,0.08)] overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 flex items-center justify-center gap-1 px-3 py-2.5 text-[10px] font-semibold
              uppercase tracking-wider transition-all border-b-2 ${
              activeTab === key
                ? 'text-[#22c55e] border-[#22c55e]'
                : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-20">
        {activeTab === 'overview'    && <OverviewTab    {...tabProps} />}
        {activeTab === 'peers'       && <PeersTab       {...tabProps} />}
        {activeTab === 'activity'    && <ActivityTab    eventLog={eventLog} />}
        {activeTab === 'tracker'     && <TrackerTab     receivedSOS={receivedSOS} eventLog={eventLog} />}
        {activeTab === 'diagnostics' && <DiagnosticsTab stats={stats} eventLog={eventLog} />}
        {activeTab === 'settings'    && <SettingsTab    relayOn={relayOn} setRelayOn={setRelayOn} />}
      </main>

      <MobileNavBar items={NAV} active="/responder/mesh" navigate={navigate} />
    </div>
  )
}

// Backward-compat alias — /responder/relay still works
export { MeshCenter as MeshRelay }
