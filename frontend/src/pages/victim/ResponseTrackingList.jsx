import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle, Clock, WifiOff, RefreshCw, AlertOctagon,
  ChevronDown, Map, Radio, Settings, Home, MessageSquare,
} from 'lucide-react'
import { MobileNavBar, TopBar } from '../../components/ui/NavBar'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import api from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'

const NAV = [
  { icon: Home,          label: 'Home',    path: '/home'     },
  { icon: MessageSquare, label: 'SOS',     path: '/sos'      },
  { icon: Map,           label: 'Map',     path: '/map'      },
  { icon: Radio,         label: 'Mesh',    path: '/mesh'     },
  { icon: Settings,      label: 'Settings',path: '/settings' },
]

// ── Status / priority helpers ─────────────────────────────────────────────
const RESCUE_STATUS_LABELS = {
  pending:      { label: 'Awaiting Acknowledgment', color: 'text-slate-400',  bg: 'bg-slate-700'     },
  acknowledged: { label: 'Acknowledged',            color: 'text-amber-400',  bg: 'bg-amber-900/40'  },
  en_route:     { label: 'In Progress',             color: 'text-blue-400',   bg: 'bg-blue-900/40'   },
  on_scene:     { label: 'In Progress',             color: 'text-violet-400', bg: 'bg-violet-900/40' },
  cannot_reach: { label: 'In Progress',             color: 'text-amber-400',  bg: 'bg-amber-900/40'  },
  rescued:      { label: 'Completed',               color: 'text-green-400',  bg: 'bg-green-900/40'  },
}

const PRIORITY_LABELS = {
  CRITICAL: 'bg-red-900/40 text-red-400',
  HIGH:     'bg-orange-900/40 text-orange-400',
  MODERATE: 'bg-amber-900/40 text-amber-400',
  LOW:      'bg-slate-700 text-slate-400',
}

function priorityLabel(score) {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MODERATE'
  return 'LOW'
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const EMERGENCY_LABELS = {
  injured: 'Injured', trapped: 'Trapped', safe: 'Safe', missing: 'Missing', unknown: 'Unknown',
}

// ── Timeline builder ──────────────────────────────────────────────────────
function buildTimeline(r, evts) {
  const statusAt = t => evts.find(e => e.new_status === t)?.created_at ?? null
  return [
    { label: 'SOS Submitted',                done: true,                                                              ts: r?.created_at },
    { label: 'Report Received by System',    done: !!r?.id,                                                           ts: r?.created_at },
    { label: 'Agency Acknowledged',          done: !['pending'].includes(r?.rescue_status) || evts.some(e => e.event_type?.includes('acknowledge')), ts: statusAt('acknowledged') },
    { label: 'Responder Assigned',           done: !!r?.assigned_responder_id,                                        ts: statusAt('assigned') },
    { label: 'Responder En Route',           done: ['en_route','on_scene','rescued','cannot_reach'].includes(r?.rescue_status), ts: statusAt('en_route') },
    { label: 'Responder On Scene',           done: ['on_scene','rescued','cannot_reach'].includes(r?.rescue_status),  ts: statusAt('on_scene') },
    { label: 'Rescue / Assistance Completed',done: r?.rescue_status === 'rescued',                                    ts: r?.confirmed_at ?? statusAt('rescued') },
  ]
}

// ── Component ─────────────────────────────────────────────────────────────
export function ResponseTrackingList() {
  const navigate   = useNavigate()
  const [isLight]  = useState(() => getVictimTheme() === 'light')
  const [isOnline] = useState(getNetworkOnline)

  const [reports,      setReports]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('all')
  const [reloadKey,    setReloadKey]    = useState(0)
  const [expanded,     setExpanded]     = useState(new Set())
  const [timelineData, setTimelineData] = useState({})

  const initializedRef    = useRef(false)
  const fetchedTimelines  = useRef(new Set())

  // ── Timeline fetch (lazy, cached per SOS id) ───────────────────────────
  async function loadTimeline(id) {
    const key = String(id)
    if (fetchedTimelines.current.has(key)) return
    fetchedTimelines.current.add(key)
    setTimelineData(prev => ({ ...prev, [key]: { events: [], loading: true } }))
    try {
      const { data } = await supabase
        .from('sos_status_events')
        .select('id,event_type,old_status,new_status,message,created_at,actor_role,actor_name_snapshot')
        .eq('sos_id', id)
        .order('created_at', { ascending: true })
      setTimelineData(prev => ({ ...prev, [key]: { events: data ?? [], loading: false } }))
    } catch {
      setTimelineData(prev => ({ ...prev, [key]: { events: [], loading: false } }))
      fetchedTimelines.current.delete(key)
    }
  }

  function refreshTimeline(id) {
    fetchedTimelines.current.delete(String(id))
    loadTimeline(id)
  }

  function toggleExpand(id) {
    const key = String(id)
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) }
      else { next.add(key); loadTimeline(id) }
      return next
    })
  }

  // ── List fetch (3-stage, same as IncidentHistory) ─────────────────────
  async function load() {
    setLoading(true)
    try {
      let rows = []

      // Stage A — authenticated victim path
      try {
        const data = await api.get('/sos/mine')
        rows = Array.isArray(data) ? data : []
      } catch {}

      // Stage B — guest: query Supabase by mesh_packet_id from IndexedDB
      if (rows.length === 0 && isOnline) {
        try {
          const local = await db.getAllSOS()
          const meshIds = local.map(r => r.mesh_packet_id ?? r.meshPacketId).filter(Boolean)
          if (meshIds.length > 0) {
            const { data } = await supabase
              .from('sos_reports')
              .select('*')
              .in('mesh_packet_id', meshIds)
              .order('created_at', { ascending: false })
            if (Array.isArray(data) && data.length > 0) {
              rows = data.map(r => ({
                ...r,
                rescue_status: (r.rescue_status === 'pending' && r.confirmed_by_name && !r.confirmed_at)
                  ? 'acknowledged' : r.rescue_status,
              }))
            }
          }
          // Stage C — unsynced local records
          if (rows.length === 0 && local.length > 0) {
            rows = local.map(r => ({
              ...r,
              rescue_status: r.rescue_status ?? 'pending',
              created_at: r.timestamp
                ? new Date(r.timestamp).toISOString()
                : new Date(r.createdAt ?? Date.now()).toISOString(),
            }))
          }
        } catch {}
      }

      setReports(rows)

      // Auto-expand in-progress SOSes on first load
      if (!initializedRef.current && rows.length > 0) {
        const toExpand = rows
          .filter(r => r.rescue_status !== 'rescued')
          .map(r => String(r.id))
        if (toExpand.length) {
          setExpanded(new Set(toExpand))
          toExpand.forEach(id => loadTimeline(id))
        }
        initializedRef.current = true
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isOnline) { load() } else { setLoading(false) } }, [isOnline, reloadKey])

  useEffect(() => {
    if (!isOnline) return
    const poll = setInterval(() => setReloadKey(k => k + 1), 15_000)
    return () => clearInterval(poll)
  }, [isOnline])

  const filtered = useMemo(() => {
    switch (tab) {
      case 'active':    return reports.filter(r => r.rescue_status !== 'rescued' && !r.dismissed)
      case 'completed': return reports.filter(r => r.rescue_status === 'rescued' || r.dismissed)
      case 'awaiting':  return reports.filter(r => ['pending','acknowledged'].includes(r.rescue_status))
      default:          return reports
    }
  }, [reports, tab])

  const tabs = [
    { key: 'all',       label: 'All'          },
    { key: 'active',    label: 'Active'        },
    { key: 'awaiting',  label: 'Acknowledged'  },
    { key: 'completed', label: 'Completed'     },
  ]

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Response Tracking" onBack />

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-1 overflow-x-auto shrink-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              tab === t.key
                ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)]'
                : 'text-slate-400 border border-transparent hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-slate-500 hover:text-[#00d4ff] transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-nav space-y-2 pt-2">
        {!isOnline ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
            <WifiOff size={28} />
            <p className="text-sm">Response tracking requires an internet connection.</p>
          </div>
        ) : loading ? (
          <div className="space-y-2 mt-2">
            {[1,2,3].map(i => (
              <div key={i} className="glass rounded-2xl p-4 h-24 animate-pulse bg-[rgba(255,255,255,0.03)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
            <AlertOctagon size={28} />
            <p className="text-sm text-center">
              {tab === 'all' ? 'No SOS reports found.' : `No ${tab} incidents.`}
            </p>
          </div>
        ) : (
          filtered.map(r => {
            const key   = String(r.id)
            const isExp = expanded.has(key)
            const tl    = timelineData[key]
            const st    = RESCUE_STATUS_LABELS[r.rescue_status] ?? { label: r.rescue_status, color: 'text-slate-400', bg: 'bg-slate-700' }
            const pLbl  = priorityLabel(r.ai_priority_score ?? 50)

            return (
              <div key={r.id} className="space-y-1">

                {/* Summary card */}
                <button
                  onClick={() => toggleExpand(r.id)}
                  className="w-full glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]
                             hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] transition-all text-left">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-slate-500">#{r.id}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_LABELS[pLbl]}`}>
                        {pLbl}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-slate-500 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">
                      {EMERGENCY_LABELS[r.status] ?? r.status}
                    </span>
                    {r.barangay && <span className="text-xs text-slate-500">· {r.barangay}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                      {r.rescue_status === 'rescued' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 font-semibold">
                          Rate Response
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={11} />
                      {fmtDate(r.created_at)}
                    </div>
                  </div>
                </button>

                {/* Expanded: Response Timeline */}
                {isExp && (
                  <div className="glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)] mx-1">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Response Timeline</p>
                      <button
                        onClick={e => { e.stopPropagation(); refreshTimeline(r.id) }}
                        className="text-slate-500 hover:text-[#00d4ff] transition-colors">
                        <RefreshCw size={13} className={tl?.loading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    {tl?.loading ? (
                      <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Loading timeline…</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {buildTimeline(r, tl?.events ?? []).map(({ label, done, ts }, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="flex flex-col items-center mt-0.5">
                              {done ? (
                                <div className="w-5 h-5 rounded-full bg-[rgba(34,197,94,0.2)] border-2 border-green-500 flex items-center justify-center">
                                  <CheckCircle size={12} className="text-green-400" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-700 bg-[rgba(255,255,255,0.03)]" />
                              )}
                              {i < 6 && <div className={`w-0.5 h-5 mt-1 ${done ? 'bg-green-800' : 'bg-slate-800'}`} />}
                            </div>
                            <div className="flex-1 pb-2">
                              <p className={`text-sm font-medium ${done ? 'text-white' : 'text-slate-600'}`}>{label}</p>
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {ts ? fmtTime(ts) : <span className="italic">Pending</span>}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded + rescued: feedback CTA */}
                {isExp && r.rescue_status === 'rescued' && (
                  <div className="glass rounded-2xl p-3 border border-green-500/30 bg-green-900/10 mx-1">
                    <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
                      Tell Us About Your Experience
                    </span>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Share your experience to improve emergency response
                    </p>
                    <div className="flex gap-2 mt-2.5">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(`/sos/${r.id}/feedback`)}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600
                                   border border-amber-400/60 text-black text-xs font-bold
                                   shadow-[0_0_16px_rgba(245,158,11,0.25)]">
                        REVIEW NOW
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/sos/history', { state: { overrideTitle: 'Post-Rescue Feedback' } })}
                        className="flex-1 py-2.5 rounded-xl border border-[rgba(255,255,255,0.12)]
                                   text-slate-300 text-xs font-semibold hover:bg-[rgba(255,255,255,0.05)]">
                        MAYBE LATER
                      </motion.button>
                    </div>
                  </div>
                )}

              </div>
            )
          })
        )}
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
