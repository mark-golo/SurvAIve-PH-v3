import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getResponderTheme } from '../../lib/victimTheme'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Wifi, Battery, AlertTriangle, Home, List, Map, Settings, Activity, CheckCircle2, XCircle, ArrowRightLeft, RefreshCw, Archive, ZapOff } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { mesh } from '../../lib/mesh'
import { getReceivedSOS, getMeshEventLog, onActivityChange } from '../../lib/meshActivityStore'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Relay',    path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

const EVENT_META = {
  sos_broadcast:          { label: 'SOS Broadcast Sent',          color: '#f59e0b', Icon: Radio         },
  broadcast_started:      { label: 'BLE Advertising Started',     color: '#22c55e', Icon: Radio         },
  broadcast_failed:       { label: 'BLE Advertising Failed',      color: '#ef4444', Icon: ZapOff        },
  peer_discovered:        { label: 'Peer Discovered',             color: '#00d4ff', Icon: Wifi          },
  connection_established: { label: 'GATT Connection Established', color: '#22c55e', Icon: Wifi          },
  peer_disconnected:      { label: 'Peer Disconnected',           color: '#8b5cf6', Icon: Wifi          },
  sos_transmitted:        { label: 'SOS Transmitted',             color: '#22c55e', Icon: CheckCircle2  },
  sos_received:           { label: 'SOS Received via Mesh',       color: '#ef4444', Icon: AlertTriangle },
  sos_stored_locally:     { label: 'SOS Stored Offline',          color: '#8b5cf6', Icon: Archive       },
  sos_acknowledged:       { label: 'SOS Acknowledged',            color: '#22c55e', Icon: CheckCircle2  },
  sos_relayed:            { label: 'SOS Relayed',                 color: '#00d4ff', Icon: ArrowRightLeft},
  ack_sent:               { label: 'ACK Sent',                    color: '#22c55e', Icon: CheckCircle2  },
  ack_received:           { label: 'ACK Received',                color: '#22c55e', Icon: CheckCircle2  },
  duplicate_detected:     { label: 'Duplicate Suppressed',        color: '#6b7280', Icon: XCircle       },
  transmission_failed:    { label: 'Transmission Failed',         color: '#ef4444', Icon: XCircle       },
  retry_attempted:        { label: 'Retry Attempted',             color: '#f59e0b', Icon: RefreshCw     },
  sync_completed:         { label: 'Offline Queue Synced',        color: '#22c55e', Icon: Archive       },
  scan_started:           { label: 'BLE Scan Started',            color: '#00d4ff', Icon: Radio         },
  scan_failed:            { label: 'BLE Scan Failed',             color: '#ef4444', Icon: ZapOff        },
  scanner_null:           { label: 'Scanner Null (retrying)',      color: '#f59e0b', Icon: ZapOff        },
  beacon_decoded:         { label: 'Beacon Decoded',              color: '#00d4ff', Icon: Radio         },
}

function getEventSubtext(e) {
  const d = e.data ?? {}
  const parts = []
  if (d.packetId)       parts.push(d.packetId.slice(-8))
  if (d.peerId)         parts.push('Peer: ' + d.peerId.slice(-8))
  if (d.originDeviceId) parts.push('Origin: ' + d.originDeviceId.slice(-8))
  if (d.hopCount != null) parts.push(d.hopCount + ' hop' + (String(d.hopCount) !== '1' ? 's' : ''))
  if (d.barangay)       parts.push(d.barangay)
  if (d.errorCode != null) parts.push('Error: ' + d.errorCode)
  if (d.count != null)  parts.push(d.count + ' packets')
  if (d.status)         parts.push(d.status)
  return parts.join(' · ')
}

export function MeshRelay() {
  const navigate = useNavigate()
  const [isLight]   = useState(() => getResponderTheme() === 'light')
  const [activeTab, setActiveTab] = useState('relay')
  const [relayOn, setRelayOn]   = useState(true)
  const [peers, setPeers]       = useState([])
  const [stats, setStats]       = useState({ peersNearby: 0, transport: '—', relayEnabled: false })

  const [receivedSOS, setReceivedSOS] = useState(getReceivedSOS)
  const [eventLog, setEventLog]       = useState(getMeshEventLog)
  const acksSent = receivedSOS.length

  useEffect(() => onActivityChange(() => {
    setReceivedSOS(getReceivedSOS())
    setEventLog(getMeshEventLog())
  }), [])

  useEffect(() => {
    const loadStats = async () => {
      const s = await mesh.getStats()
      setStats(s)
      mesh.getPeers().then(p => setPeers(p))
    }
    loadStats()
    const interval = setInterval(loadStats, 3000)
    return () => clearInterval(interval)
  }, [])

  const ackSentLog = eventLog.filter(e => e.type === 'ack_sent')
  const hasActivity = receivedSOS.length > 0 || eventLog.length > 0

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Mesh Relay Node" subtitle="Responder relay status" onBack />

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-[rgba(255,255,255,0.08)]">
        {[{ key: 'relay', label: 'Relay', icon: Radio }, { key: 'activity', label: 'Activity', icon: Activity }]
          .map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold
                uppercase tracking-wider transition-all border-b-2 ${
                activeTab === key
                  ? 'text-[#22c55e] border-[#22c55e]'
                  : 'text-slate-500 border-transparent hover:text-slate-300'}`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">

        {/* ── RELAY TAB ──────────────────────────────────────────────────────────── */}
        {activeTab === 'relay' && (
          <>
            {/* Node visualization */}
            <GlassCard className="text-center py-6">
              <div className="relative inline-flex items-center justify-center">
                {relayOn && [1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full border border-[rgba(34,197,94,0.3)]"
                    style={{ width: `${60 + i * 36}px`, height: `${60 + i * 36}px` }}
                    animate={{ opacity: [0.6, 0.1, 0.6], scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
                  />
                ))}
                <div className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                  relayOn
                    ? 'bg-[rgba(34,197,94,0.2)] border-2 border-[rgba(34,197,94,0.5)] shadow-[0_0_30px_rgba(34,197,94,0.4)]'
                    : 'bg-[rgba(107,114,128,0.2)] border-2 border-[rgba(107,114,128,0.3)]'
                }`}>
                  <Radio size={28} className={relayOn ? 'text-[#22c55e]' : 'text-slate-500'} />
                </div>
              </div>

              <div className="mt-6">
                <p className={`text-lg font-bold ${relayOn ? 'text-[#22c55e]' : 'text-slate-400'}`}>
                  {relayOn ? 'Active Relay Mode' : 'Relay Off'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {relayOn ? 'Forwarding emergency messages from nearby devices' : 'Not relaying mesh traffic'}
                </p>
              </div>

              <div className="mt-4">
                <NeonButton
                  variant={relayOn ? 'ghost' : 'green'}
                  onClick={async () => {
                    const next = !relayOn
                    setRelayOn(next)
                    await mesh.setRelay(next)
                  }}
                  size="sm"
                >
                  {relayOn ? 'Disable Relay' : 'Enable Relay'}
                </NeonButton>
              </div>
            </GlassCard>

            {/* Stats — 4 tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-[#22c55e]">{stats.peersNearby}</p>
                <p className="text-[10px] text-slate-500 uppercase mt-0.5">Peers Nearby</p>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-[#00d4ff]">{stats.transport ?? '—'}</p>
                <p className="text-[10px] text-slate-500 uppercase mt-0.5">Transport</p>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-[#8b5cf6]">{stats.relayEnabled ? 'On' : 'Off'}</p>
                <p className="text-[10px] text-slate-500 uppercase mt-0.5">Relay Active</p>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-[#ef4444]">{acksSent}</p>
                <p className="text-[10px] text-slate-500 uppercase mt-0.5">ACKs Sent</p>
              </div>
            </div>

            {/* Received SOS via Mesh */}
            {receivedSOS.length > 0 && (
              <GlassCard>
                <p className="text-xs font-semibold text-[#ef4444] uppercase tracking-wider mb-3">
                  Received SOS via Mesh
                </p>
                <div className="space-y-0">
                  <AnimatePresence>
                    {receivedSOS.map((entry, i) => (
                      <motion.div
                        key={entry.rawPacket?.id ?? i}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-start gap-3 py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0"
                      >
                        <AlertTriangle size={14} className="text-[#ef4444] shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">
                            {(entry.data.status ?? 'SOS').toUpperCase()} · {entry.data.barangay ?? 'Unknown location'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {entry.data.people_count ? `${entry.data.people_count} person(s) · ` : ''}
                            {5 - (entry.rawPacket.hopCount ?? 5)} hop(s) · {new Date(entry.time).toLocaleTimeString()}
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

            {/* Peer list */}
            <GlassCard>
              <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Connected Peers</p>
              {peers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No peers in range</p>
              ) : (
                <div className="space-y-0">
                  {peers.map(peer => {
                    const s = Math.floor((Date.now() - peer.lastSeen) / 1000)
                    const ago = s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`
                    return (
                    <div key={peer.id} className="flex items-center gap-3 py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                      <Wifi size={14} className="text-[#00d4ff] shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-white">{peer.id}</p>
                        <p className="text-[10px] text-slate-500">{peer.isRelaying ? 'relaying SOS · ' : ''}{ago}</p>
                      </div>
                      <div className="flex gap-0.5 items-end h-4">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`w-1.5 rounded-sm ${i <= peer.signal ? 'bg-[#22c55e]' : 'bg-slate-700'}`}
                            style={{ height: `${i * 25}%` }} />
                        ))}
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </GlassCard>

            {/* Battery warning */}
            {relayOn && (
              <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.3)] flex items-start gap-2">
                <Battery size={14} className="text-[#f59e0b] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400">
                  Active relay mode increases battery consumption. Consider charging your device or enabling Battery Saver mode.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── ACTIVITY TAB ───────────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <>
            {!hasActivity ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 gap-3"
              >
                <Radio size={36} className="text-slate-700" />
                <p className="text-sm text-slate-500 font-medium">No mesh activity yet</p>
                <p className="text-xs text-slate-600 text-center px-8">
                  SOS signals detected via mesh and ACKs sent will appear here
                </p>
              </motion.div>
            ) : (
              <>
                {/* Section 1 — CRITICAL SOS alert cards */}
                {receivedSOS.length > 0 && (
                  <div>
                    <p className="text-[10px] text-[#ef4444] font-black uppercase tracking-widest mb-2">
                      Received SOS via Mesh
                    </p>
                    <div className="space-y-3">
                      <AnimatePresence>
                        {receivedSOS.map((entry, i) => {
                          const victimId = entry.rawPacket?.originDeviceId ?? null
                          const hops = 5 - (entry.rawPacket?.hopCount ?? 5)
                          // Level badge: responder page = Level 4; show relay depth from hop count
                          const levelLabel = hops >= 2
                            ? `SOS RELAYED — ${hops} HOP${hops !== 1 ? 'S' : ''}`
                            : 'SOS RECEIVED BY NEARBY DEVICE'
                          const levelColor = hops >= 2 ? '#00d4ff' : '#22c55e'
                          return (
                            <motion.div
                              key={entry.rawPacket?.id ?? i}
                              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="glass rounded-2xl p-4 border-2 border-[rgba(239,68,68,0.5)] shadow-[0_0_16px_rgba(239,68,68,0.2)]"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle size={15} className="text-[#ef4444] animate-pulse shrink-0" />
                                  <p className="text-xs font-black text-[#ef4444]">CRITICAL SOS</p>
                                </div>
                                <p className="text-[10px] text-slate-500 shrink-0">
                                  {new Date(entry.time).toLocaleTimeString()}
                                </p>
                              </div>
                              {victimId && (
                                <p className="text-xs font-bold text-white mb-0.5">
                                  Victim: {'VIC-' + victimId.slice(-5).toUpperCase()}
                                </p>
                              )}
                              <p className="text-xs text-slate-300 mb-0.5">
                                📍 {entry.data.barangay ?? 'Unknown'}
                                {entry.data.municipality ? ` · ${entry.data.municipality}` : ''}
                              </p>
                              <p className="text-[11px] text-slate-400 mb-2">
                                {(entry.data.status ?? 'sos').toUpperCase()}
                                {entry.data.people_count ? ` · ${entry.data.people_count} person(s)` : ''}
                              </p>
                              {/* Mesh propagation level badge */}
                              <div className="flex flex-col gap-1 mb-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0"
                                       style={{ background: levelColor }} />
                                  <p className="text-[10px] font-bold tracking-wider"
                                     style={{ color: levelColor }}>
                                    {levelLabel}
                                  </p>
                                </div>
                                {hops >= 2 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#22c55e]" />
                                    <p className="text-[10px] font-bold tracking-wider text-[#22c55e]">
                                      RELAYED SOS RECEIVED
                                    </p>
                                  </div>
                                )}
                              </div>
                              <NeonButton
                                size="sm"
                                variant="red"
                                onClick={() => navigate('/responder/queue')}
                                className="w-full"
                              >
                                VIEW INCIDENT
                              </NeonButton>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Section 2 — ACKs Sent log */}
                {ackSentLog.length > 0 && (
                  <div>
                    <p className="text-[10px] text-[#22c55e] font-black uppercase tracking-widest mb-2">ACKs Sent</p>
                    <div className="space-y-1.5">
                      <AnimatePresence>
                        {ackSentLog.map((entry) => (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            className="glass rounded-xl p-3 flex items-center gap-3"
                          >
                            <div className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white">ACK Sent</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                SOS {entry.data.sos_id?.slice(-8) ?? '—'}
                                {entry.data.barangay ? ` · ${entry.data.barangay}` : ''}
                              </p>
                            </div>
                            <p className="text-[10px] text-slate-600 shrink-0">
                              {new Date(entry.time).toLocaleTimeString()}
                            </p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Section 3 — All Mesh Events */}
                {eventLog.length > 0 && (
                  <div>
                    <p className="text-[10px] text-[#8b5cf6] font-black uppercase tracking-widest mb-2">All Mesh Events</p>
                    <div className="space-y-1.5">
                      <AnimatePresence>
                        {[...eventLog].reverse().map((entry) => {
                          const meta = EVENT_META[entry.type] ?? { label: entry.type, color: '#6b7280', Icon: Activity }
                          const IconComp = meta.Icon
                          const sub = getEventSubtext(entry)
                          return (
                            <motion.div
                              key={entry.id}
                              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                              className="glass rounded-xl p-3 flex items-center gap-3"
                            >
                              <IconComp size={13} style={{ color: meta.color }} className="shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white">{meta.label}</p>
                                {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
                              </div>
                              <p className="text-[10px] text-slate-600 shrink-0">
                                {new Date(entry.time).toLocaleTimeString()}
                              </p>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
