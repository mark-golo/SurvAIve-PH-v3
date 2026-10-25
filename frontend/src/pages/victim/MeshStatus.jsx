import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio, RefreshCw, Wifi, Activity, AlertTriangle, Home, Map, Settings,
  MessageSquare, CheckCircle2, XCircle, ArrowRightLeft, Archive, ZapOff,
  Users,
} from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { mesh } from '../../lib/mesh'
import { db } from '../../lib/db'
import { getVictimTheme } from '../../lib/victimTheme'
import { getActiveSOS, getReceivedSOS, getMeshEventLog, onActivityChange } from '../../lib/meshActivityStore'

const NAV = [
  { icon: Home,          label: 'Home',     path: '/home'     },
  { icon: MessageSquare, label: 'SOS',      path: '/sos'      },
  { icon: Map,           label: 'Map',      path: '/map'      },
  { icon: Radio,         label: 'Mesh',     path: '/mesh'     },
  { icon: Settings,      label: 'Settings', path: '/settings' },
]

const TABS = [
  { key: 'connections', label: 'Connections', Icon: Wifi          },
  { key: 'sos_queue',   label: 'SOS Queue',   Icon: AlertTriangle },
  { key: 'activity',    label: 'Activity',    Icon: Activity      },
]

const ACK_LEVEL_LABELS = {
  1: { label: 'Broadcasting',            color: '#f59e0b' },
  2: { label: 'Received by Nearby Device', color: '#22c55e' },
  3: { label: 'Relayed',                 color: '#00d4ff' },
  4: { label: 'Responder Received',      color: '#22c55e' },
}

const EVENT_META = {
  sos_broadcast:          { label: 'SOS Broadcast Sent',            color: '#f59e0b', Icon: Radio          },
  broadcast_started:      { label: 'BLE Advertising Started',       color: '#22c55e', Icon: Radio          },
  broadcast_failed:       { label: 'BLE Advertising Failed',        color: '#ef4444', Icon: ZapOff         },
  peer_discovered:        { label: 'Peer Discovered',               color: '#00d4ff', Icon: Wifi           },
  connection_established: { label: 'GATT Connection Established',   color: '#22c55e', Icon: Wifi           },
  peer_disconnected:      { label: 'Peer Disconnected',             color: '#8b5cf6', Icon: Wifi           },
  sos_transmitted:        { label: 'SOS Transmitted',               color: '#22c55e', Icon: CheckCircle2   },
  sos_received:           { label: 'SOS Received via Mesh',         color: '#ef4444', Icon: AlertTriangle  },
  sos_stored_locally:     { label: 'SOS Stored Offline',            color: '#8b5cf6', Icon: Archive        },
  sos_acknowledged:       { label: 'SOS Acknowledged',              color: '#22c55e', Icon: CheckCircle2   },
  sos_relayed:            { label: 'SOS Relayed',                   color: '#00d4ff', Icon: ArrowRightLeft },
  ack_sent:               { label: 'ACK Sent',                      color: '#22c55e', Icon: CheckCircle2   },
  ack_received:           { label: 'SOS Received by Nearby Device', color: '#22c55e', Icon: CheckCircle2   },
  ack_unmatched:          { label: 'ACK Arrived (unmatched)',        color: '#f59e0b', Icon: AlertTriangle  },
  duplicate_detected:     { label: 'Duplicate Suppressed',          color: '#6b7280', Icon: XCircle        },
  transmission_failed:    { label: 'Transmission Failed',           color: '#ef4444', Icon: XCircle        },
  retry_attempted:        { label: 'Retry Attempted',               color: '#f59e0b', Icon: RefreshCw      },
  sync_completed:         { label: 'Offline Queue Synced',          color: '#22c55e', Icon: Archive        },
  scan_started:           { label: 'BLE Scan Started',              color: '#00d4ff', Icon: Radio          },
  scan_failed:            { label: 'BLE Scan Failed',               color: '#ef4444', Icon: ZapOff         },
  scanner_null:           { label: 'Scanner Null (retrying)',        color: '#f59e0b', Icon: ZapOff         },
  beacon_decoded:         { label: 'Beacon Decoded',                color: '#00d4ff', Icon: Radio          },
  gatt_packet_received:      { label: 'GATT Packet Received',       color: '#3b82f6', Icon: Wifi           },
  gatt_packet_parse_failed:  { label: 'GATT Parse Failed',          color: '#ef4444', Icon: AlertTriangle  },
  broadcast_dispatched:      { label: 'Broadcast Dispatched',       color: '#22c55e', Icon: Radio          },
  broadcast_error:           { label: 'Broadcast Error',            color: '#ef4444', Icon: ZapOff         },
  beacon_too_short:          { label: 'Beacon Too Short',           color: '#f59e0b', Icon: AlertTriangle  },
  beacon_decode_failed:      { label: 'Beacon Decode Failed',       color: '#ef4444', Icon: AlertTriangle  },
  packet_delivered_to_service:{ label: 'Packet → Service',         color: '#3b82f6', Icon: Wifi           },
  fragment_write_started:    { label: 'Fragment Write Started',     color: '#a78bfa', Icon: Wifi           },
  fragment_assembled:        { label: 'Fragment Assembled',         color: '#22c55e', Icon: Wifi           },
  payload_exceeds_mtu:       { label: 'Payload Exceeds MTU',        color: '#f59e0b', Icon: AlertTriangle  },
}

const FILTER_MAP = {
  sos:   ['sos_received', 'sos_transmitted', 'sos_relayed', 'sos_broadcast', 'sos_stored_locally', 'duplicate_detected', 'beacon_decoded', 'gatt_packet_received', 'gatt_packet_parse_failed', 'broadcast_dispatched', 'packet_delivered_to_service', 'fragment_write_started', 'fragment_assembled'],
  ack:   ['ack_sent', 'ack_received', 'ack_unmatched', 'sos_acknowledged'],
  peer:  ['peer_discovered', 'connection_established', 'peer_disconnected'],
  error: ['transmission_failed', 'broadcast_failed', 'scan_failed', 'scanner_null', 'broadcast_error', 'beacon_too_short', 'beacon_decode_failed', 'payload_exceeds_mtu'],
}

function ago(ms) {
  if (!ms) return 'Never'
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 5)   return 'just now'
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function peerAlias(id) {
  if (!id) return 'Unknown'
  const clean = id.replace(/:/g, '')
  return clean.slice(0, 4).toUpperCase() + '…' + clean.slice(-2).toUpperCase()
}

// ── Stats Strip ───────────────────────────────────────────────────────────────

function StatsStrip({ stats, receivedSOS, eventLog, sosQueue, ackState }) {
  const relayCount  = eventLog.filter(e => e.type === 'sos_relayed').length
  const ackDevCount = ackState?.ackDevices?.length ?? 0
  const tiles = [
    { label: 'Peers Found',  value: stats.peersNearby,  icon: Users,          color: '#00d4ff' },
    { label: 'SOS Received', value: receivedSOS.length, icon: AlertTriangle,  color: '#ef4444' },
    { label: 'ACK Devices',  value: ackDevCount,         icon: CheckCircle2,   color: '#22c55e' },
    { label: 'Relays Sent',  value: relayCount,          icon: ArrowRightLeft, color: '#00d4ff' },
    { label: 'Pending Msgs', value: sosQueue.length,     icon: Archive,        color: '#f59e0b' },
  ]
  return (
    <div className="grid grid-cols-5 gap-1.5 px-4 pt-3 pb-2 shrink-0">
      {tiles.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="glass rounded-xl py-2 px-1.5 text-center">
          <Icon size={13} style={{ color }} className="mx-auto mb-1" />
          <p className="text-base font-black" style={{ color }}>{value}</p>
          <p className="text-[8px] text-slate-500 uppercase leading-tight mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Connections Tab ───────────────────────────────────────────────────────────

function ConnectionsTab({ peers, stats, eventLog }) {
  const connectedAddrs = new Set(
    eventLog
      .filter(e => e.type === 'connection_established' && e.data?.peerId)
      .map(e => e.data.peerId)
  )

  if (peers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Radio size={40} className="text-slate-600" />
        </motion.div>
        <p className="text-xs text-slate-500 text-center px-8">
          Scanning for nearby SurvAIve PH devices…
        </p>
        <p className="text-[10px] text-slate-600 text-center">
          Transport: {stats.transport ?? '—'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold px-1">
        {peers.length} Device{peers.length !== 1 ? 's' : ''} in Range
      </p>
      <AnimatePresence>
        {peers.map((peer, i) => {
          const isConnected = connectedAddrs.has(peer.id) &&
            (Date.now() - (peer.lastSeen ?? 0)) < 30000
          const statusColor = isConnected ? '#22c55e' : '#f59e0b'
          const statusLabel = isConnected ? 'Connected' : 'Discovered'
          return (
            <motion.div
              key={peer.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass rounded-xl p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-bold text-white flex-1">{peerAlias(peer.id)}</p>
                <div className="flex gap-0.5 items-end h-3.5 mr-1">
                  {[1, 2, 3, 4].map(b => (
                    <div key={b}
                      className="w-1 rounded-sm"
                      style={{
                        height: `${b * 25}%`,
                        background: b <= (peer.signal ?? 2) ? '#22c55e' : 'rgba(255,255,255,0.15)',
                      }}
                    />
                  ))}
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                  style={{ background: statusColor + '22', color: statusColor }}>
                  {statusLabel}
                </span>
              </div>

              <div className="space-y-1">
                <PeerRow label="Device ID"  value={peer.id.slice(-12)} mono />
                <PeerRow label="Transport"  value={peer.transport ?? 'BLE'} extra="BLE Active Scan" />
                <PeerRow label="Last Seen"  value={ago(peer.lastSeen)} />
                <div className="flex items-center gap-2 pt-0.5">
                  <p className="text-[10px] text-slate-500 w-20 shrink-0">Capabilities</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                    (peer.relayEnabled ?? peer.isRelaying)
                      ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff]'
                      : 'border border-[rgba(255,255,255,0.1)] text-slate-600'
                  }`}>
                    {(peer.relayEnabled ?? peer.isRelaying) ? 'Relay ON' : 'Relay OFF'}
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function PeerRow({ label, value, extra, mono }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] text-slate-500 w-20 shrink-0">{label}</p>
      <p className={`text-[10px] text-slate-300 flex-1 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      {extra && <p className="text-[9px] text-slate-600 shrink-0">{extra}</p>}
    </div>
  )
}

// ── SOS Queue Tab ─────────────────────────────────────────────────────────────

function SOSQueueTab({ ackState, sosQueue, eventLog, sosBroadcastLog }) {
  const hasOutgoing = !!ackState.packetId
  const hasQueue    = sosQueue.length > 0

  if (!hasOutgoing && !hasQueue) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <CheckCircle2 size={36} className="text-[#22c55e]" />
        <p className="text-xs text-slate-400 font-semibold">No pending SOS — mesh is clear</p>
        <p className="text-[10px] text-slate-600">Your SOS broadcasts will appear here</p>
      </div>
    )
  }

  const ackInfo = ACK_LEVEL_LABELS[ackState.ackLevel] ?? ACK_LEVEL_LABELS[1]
  const broadcastTime = sosBroadcastLog.at(-1)?.time ?? null

  return (
    <div className="space-y-3">
      {/* Section A — Outgoing SOS broadcast */}
      {hasOutgoing && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold px-1">
            Your Outgoing SOS
          </p>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-3 border"
            style={{ borderColor: ackInfo.color + '40' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-black text-white flex-1">
                {ackState.sosDisplayId ?? 'SOS-' + (ackState.packetId ?? '').slice(-6)}
              </p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: ackInfo.color + '22', color: ackInfo.color }}>
                {ackInfo.label}
              </span>
            </div>

            {/* 2-col grid */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
              <QueueCell label="Created"     value={broadcastTime ? new Date(broadcastTime).toLocaleTimeString() : '—'} />
              <QueueCell label="ACK Devices"
                value={(ackState.ackDevices?.length ?? 0) > 0 ? String(ackState.ackDevices.length) : '—'} />
              <QueueCell label="Max Hops"
                value={ackState.ackMaxHops > 0 ? String(ackState.ackMaxHops) : '—'} />
              <QueueCell label="ACK Level"
                value={(ackState.ackLevel ?? 1) > 1
                  ? (ACK_LEVEL_LABELS[ackState.ackLevel]?.label ?? `Level ${ackState.ackLevel}`)
                  : '—'} />
            </div>

            {/* Delivery state — driven by broadcastSubState in the store (set by meshSync.js) */}
            {(() => {
              const sub = ackState?.broadcastSubState
              const errCode = ackState?.broadcastErrorCode
              const hasAck = (ackState.ackDevices?.length ?? 0) > 0
              const s = sub === 'transmitted'
                ? hasAck
                  ? { Icon: CheckCircle2, text: 'Acknowledged by Peer ✓', color: '#22c55e', spin: false }
                  : { Icon: RefreshCw,    text: 'Sent — Awaiting ACK…',   color: '#00d4ff', spin: true  }
                : sub === 'connecting'
                  ? { Icon: RefreshCw,   text: 'Connecting to Peer…',  color: '#00d4ff', spin: true  }
                  : sub === 'failed'
                    ? { Icon: XCircle,     text: `Broadcast Failed${errCode != null ? ` (err ${errCode})` : ''}`, color: '#ef4444', spin: false }
                    : (sub === 'advertising' || sub === 'awaiting_peers')
                      ? { Icon: CheckCircle2, text: 'Advertising Active',  color: '#22c55e', spin: false }
                      : { Icon: RefreshCw,    text: 'Awaiting Peers',       color: '#f59e0b', spin: true  }
              return (
                <div className="border-t border-[rgba(255,255,255,0.06)] pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold"
                    style={{ color: s.color }}>
                    <s.Icon size={11} className={s.spin ? 'animate-spin' : ''}
                      style={s.spin ? { animationDuration: '2s' } : {}} />
                    {s.text}
                  </div>
                </div>
              )
            })()}

            {/* ACK device list */}
            {(ackState.ackDevices?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-1">
                {ackState.ackDevices.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                    <p className="text-[10px] text-[#22c55e] flex-1">
                      Device {i + 1}{d.receiverRole === 'responder' && ' · Responder ✓'}
                    </p>
                    <p className="text-[9px] text-slate-500">{d.hopCount} hop{d.hopCount !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Section B — Offline queue items */}
      {hasQueue && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold px-1">
            Offline Queue ({sosQueue.length})
          </p>
          {sosQueue.map((item, i) => {
            const shortId = (item.meshPacketId ?? String(item.localId ?? i)).slice(-6)
            const isAcked = eventLog.some(e =>
              e.type === 'ack_received' &&
              item.meshPacketId &&
              (e.data?.sos_id === item.meshPacketId || e.data?.packetId?.endsWith(item.meshPacketId.slice(-8)))
            )
            const nextRetry = (item.retryCount ?? 0) < 5 ? '~3 s' : 'Max retries reached'
            const hopLabel  = item.hopCount != null ? String(5 - item.hopCount) : '—'
            return (
              <motion.div
                key={item.localId ?? i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass rounded-xl p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-black text-white flex-1">SOS-{shortId}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    item.synced
                      ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]'
                      : 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                  }`}>
                    {item.synced ? 'Synced' : 'Pending'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
                  <QueueCell label="Incident"   value={(item.status ?? 'SOS').toUpperCase()} />
                  <QueueCell label="Created"    value={new Date(item.createdAt).toLocaleTimeString()} />
                  <QueueCell label="Retries"    value={String(item.retryCount ?? 0)} />
                  <QueueCell label="Hops Used"  value={hopLabel} />
                </div>
                <div className="flex items-center gap-2 border-t border-[rgba(255,255,255,0.06)] pt-2">
                  <p className="text-[10px] text-slate-500 flex-1">
                    Last: <span className="text-slate-300">{ago(item.lastAttemptAt)}</span>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Next: <span className="text-slate-300">{nextRetry}</span>
                  </p>
                </div>
                <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-semibold ${
                  isAcked ? 'text-[#22c55e]' : 'text-[#f59e0b]'
                }`}>
                  {isAcked
                    ? <><CheckCircle2 size={11} /> Acknowledged ✓</>
                    : <><RefreshCw size={11} className="animate-spin" style={{ animationDuration: '3s' }} /> Awaiting ACK</>}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function QueueCell({ label, value }) {
  return (
    <div>
      <p className="text-[9px] text-slate-600 uppercase">{label}</p>
      <p className="text-[11px] text-slate-300 font-semibold truncate">{value}</p>
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab({ eventLog }) {
  const [filter, setFilter] = useState('all')
  const filterKeys = ['all', 'sos', 'ack', 'peer', 'error']
  const filtered = filter === 'all'
    ? eventLog
    : eventLog.filter(e => (FILTER_MAP[filter] ?? []).includes(e.type))

  return (
    <div className="space-y-3">
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
            const d = e.data ?? {}
            const sosId    = (d.packetId ?? d.sos_id ?? d.incomingSosId ?? '').slice(-8) || '—'
            const peerId   = d.peerId ?? d.originDeviceId ?? ''
            const peerLabel = peerId ? peerId.slice(-6) : '—'
            const evLabel  = e.type === 'beacon_decoded' && d.packetType === 'ack'
              ? meta.label + ' (ACK)'
              : e.type === 'ack_unmatched' && d.reason
                ? `${meta.label} · ${d.reason}`
                : meta.label
            return (
              <div key={e.id}
                className="flex items-center gap-2.5 py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                <span className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}88` }} />
                <p className="text-[11px] font-semibold text-white flex-1 truncate">{evLabel}</p>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-slate-500 font-mono">{sosId}</p>
                  <p className="text-[9px] text-slate-600 font-mono">{peerLabel}</p>
                </div>
                <p className="text-[9px] text-slate-600 shrink-0 w-12 text-right">{ago(e.time)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function MeshStatus() {
  const [isLight]   = useState(() => getVictimTheme() === 'light')
  const [activeTab, setActiveTab] = useState('connections')
  const [peers,   setPeers]   = useState([])
  const [stats,   setStats]   = useState({ peersNearby: 0, transport: 'starting', relayEnabled: false })
  const [ackState,    setAckState]    = useState(getActiveSOS)
  const [receivedSOS, setReceivedSOS] = useState(getReceivedSOS)
  const [eventLog,    setEventLog]    = useState(getMeshEventLog)
  const [sosQueue, setSosQueue] = useState([])

  // Live activity subscription
  useEffect(() => onActivityChange(() => {
    setAckState(getActiveSOS())
    setReceivedSOS(getReceivedSOS())
    setEventLog(getMeshEventLog())
    loadSosQueue()
  }), [])

  // Poll mesh stats + peers every 5 s
  const loadStats = useCallback(async () => {
    try { const s = await mesh.getStats(); setStats(s) } catch {}
    try { setPeers(await mesh.getPeers()) } catch {}
  }, [])

  useEffect(() => {
    loadStats()
    const t = setInterval(loadStats, 5000)
    return () => clearInterval(t)
  }, [loadStats])

  // Poll IndexedDB SOS queue on mount and tab focus
  const loadSosQueue = useCallback(async () => {
    try { setSosQueue(await db.getPendingSOS()) } catch {}
  }, [])

  useEffect(() => { loadSosQueue() }, [loadSosQueue, activeTab])

  const sosBroadcastLog = eventLog.filter(e => e.type === 'sos_broadcast')
  const displaySOS = ackState.packetId
    ? ackState
    : sosBroadcastLog.length > 0
      ? {
          packetId: sosBroadcastLog.at(-1)?.data?.packetId,
          ackLevel: 1, ackDevices: [], ackMaxHops: 0,
          sosDisplayId: sosBroadcastLog.at(-1)?.data?.sosDisplayId,
        }
      : null

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Offline Mesh" subtitle="Peer-to-peer emergency relay" onBack />

      {!(window.Capacitor?.isNativePlatform?.() ?? false) && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 8, padding: '10px 14px', margin: '8px 16px',
          fontSize: '0.75rem', color: '#ef4444', lineHeight: 1.4,
        }}>
          <strong>BLE mesh unavailable in browser.</strong> Install the Android APK to test
          offline SOS delivery — the web fallback uses HTTP only and cannot simulate BLE GATT.
        </div>
      )}

      {/* Stats strip */}
      <StatsStrip
        stats={stats}
        receivedSOS={receivedSOS}
        eventLog={eventLog}
        sosQueue={sosQueue}
        ackState={ackState}
      />

      {/* Tab bar — 3 equal tabs at top, cyan accent */}
      <div className="flex shrink-0 border-b border-[rgba(255,255,255,0.08)] px-2 gap-1 pb-0">
        {TABS.map(({ key, label, Icon }) => {
          const count = key === 'connections' ? peers.length
                      : key === 'sos_queue'   ? sosQueue.length
                      : null
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold
                uppercase tracking-wider transition-all rounded-t-lg ${
                isActive
                  ? 'bg-[rgba(0,212,255,0.12)] text-[#00d4ff] border-b-2 border-[#00d4ff]'
                  : 'text-slate-500 border-b-2 border-transparent hover:text-slate-300'
              }`}
            >
              <Icon size={11} />
              {label}
              {count !== null && count > 0 && (
                <span className={`text-[9px] font-black px-1 rounded-full ${
                  isActive ? 'bg-[rgba(0,212,255,0.25)] text-[#00d4ff]' : 'bg-[rgba(255,255,255,0.1)] text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        {activeTab === 'connections' && (
          <ConnectionsTab peers={peers} stats={stats} eventLog={eventLog} />
        )}
        {activeTab === 'sos_queue' && (
          <SOSQueueTab
            ackState={ackState}
            sosQueue={sosQueue}
            eventLog={eventLog}
            sosBroadcastLog={sosBroadcastLog}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityTab eventLog={eventLog} />
        )}
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
