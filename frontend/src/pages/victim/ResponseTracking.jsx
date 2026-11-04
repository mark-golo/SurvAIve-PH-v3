import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Clock, WifiOff, RefreshCw, Star, AlertOctagon, ChevronLeft } from 'lucide-react'
import { TopBar } from '../../components/ui/NavBar'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import api from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'

const RESCUE_STATUS_META = {
  pending:      { label: 'Awaiting Acknowledgment', color: '#94a3b8' },
  acknowledged: { label: 'Acknowledged',             color: '#f59e0b' },
  en_route:     { label: 'In Progress',              color: '#60a5fa' },
  on_scene:     { label: 'In Progress',              color: '#a78bfa' },
  cannot_reach: { label: 'In Progress',              color: '#f59e0b' },
  rescued:      { label: 'Completed',                color: '#22c55e' },
}

const PRIORITY_LABEL = s => s >= 80 ? 'CRITICAL' : s >= 60 ? 'HIGH' : s >= 40 ? 'MODERATE' : 'LOW'
const PRIORITY_COLOR = s => s >= 80 ? 'text-red-400' : s >= 60 ? 'text-orange-400' : s >= 40 ? 'text-amber-400' : 'text-slate-400'

function fmtTime(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ResponseTracking() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [isOnline]= useState(getNetworkOnline)
  const [report,    setReport]  = useState(null)
  const [events,    setEvents]  = useState([])
  const [loading,   setLoading] = useState(true)
  const [lastSync,  setLastSync]= useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const initializedRef = useRef(false)

  async function load() {
    setLoading(true)
    try {
      // Try Supabase/PHP first
      const all = await api.get('/sos/mine')
      let r = Array.isArray(all) ? all.find(x => String(x.id) === String(id)) : null

      // Mine list didn't include this record (guest victims have no victimId so the list
      // is empty; registered victims may also miss it on Vercel). Fetch directly by id —
      // api.get('/sos/:id') queries Supabase SELECT * with normalizeSos, deriving
      // 'acknowledged' from confirmed_by_name without needing victim auth.
      if (!r && isOnline) {
        try { r = await api.get(`/sos/${id}`) } catch { /* id not found in Supabase */ }
      }

      // Fallback to IndexedDB when API didn't return the record
      if (!r) {
        try {
          const local = await db.getAllSOS()
          const match = local.find(x => String(x.id) === String(id))
          if (match) r = { ...match, rescue_status: match.rescue_status ?? 'pending' }
        } catch {}
      }

      setReport(r ?? null)
      if (!initializedRef.current) {
        if (r?.rescue_status === 'rescued') setCollapsed(true)
        initializedRef.current = true
      }

      // Fetch status events from Supabase
      if (r) {
        const { data } = await supabase
          .from('sos_status_events')
          .select('id,event_type,old_status,new_status,message,created_at,actor_role,actor_name_snapshot')
          .eq('sos_id', id)
          .order('created_at', { ascending: true })
        setEvents(data ?? [])
      }
      setLastSync(new Date())
    } catch (err) {
      console.error('[ResponseTracking] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isOnline) { load() } else { setLoading(false) } }, [isOnline, id, reloadKey])

  // Auto-refresh when responder updates this SOS's rescue_status via Realtime
  useEffect(() => {
    if (!isOnline) return
    const ch = supabase.channel(`rt-sos-${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_reports',
          filter: `id=eq.${id}` },
        () => { setReloadKey(k => k + 1) }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, isOnline])

  // Polling fallback — catches status updates when Realtime is unavailable
  useEffect(() => {
    if (!isOnline) return
    const poll = setInterval(() => setReloadKey(k => k + 1), 10_000)
    return () => clearInterval(poll)
  }, [isOnline, id])

  // Build timeline steps — merge system events with derived steps
  function buildTimeline(r, evts) {
    const statusAt = (targetStatus) => {
      const ev = evts.find(e => e.new_status === targetStatus)
      return ev?.created_at ?? null
    }
    return [
      { label: 'SOS Submitted',           done: true,                                  ts: r?.created_at },
      { label: 'Report Received by System',done: !!r?.id,                               ts: r?.created_at },
      { label: 'Agency Acknowledged',      done: !['pending'].includes(r?.rescue_status) || evts.some(e => e.event_type?.includes('acknowledge')), ts: statusAt('acknowledged') },
      { label: 'Responder Assigned',       done: !!r?.assigned_responder_id,            ts: statusAt('assigned') },
      { label: 'Responder En Route',       done: ['en_route','on_scene','rescued','cannot_reach'].includes(r?.rescue_status), ts: statusAt('en_route') },
      { label: 'Responder On Scene',       done: ['on_scene','rescued','cannot_reach'].includes(r?.rescue_status), ts: statusAt('on_scene') },
      { label: 'Rescue / Assistance Completed', done: r?.rescue_status === 'rescued',  ts: r?.confirmed_at ?? statusAt('rescued') },
    ]
  }

  if (!isOnline) {
    return (
      <div className={`h-screen flex flex-col bg-mesh${isLight ? ' light-theme' : ''}`}>
        <TopBar title="Response Tracking" onBack />
        <div className="flex flex-col items-center gap-3 mt-16 text-slate-500 p-4">
          <WifiOff size={28} />
          <p className="text-sm text-center">Response tracking requires an internet connection.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Response Tracking" onBack />

      <main className="flex-1 overflow-y-auto p-4 pb-8 space-y-4">

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
          </div>
        ) : !report ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
            <AlertOctagon size={28} />
            <p className="text-sm">SOS report not found or not accessible.</p>
            <button onClick={() => navigate('/sos/history')} className="text-xs text-[#00d4ff] underline">
              View My Reports
            </button>
          </div>
        ) : (
          <>
            {/* Summary card — always visible; chevron toggles timeline */}
            <div className="glass rounded-2xl p-4 space-y-3 border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">SOS #{report.id}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_COLOR(report.ai_priority_score ?? 50)} bg-[rgba(255,255,255,0.05)]`}>
                    {PRIORITY_LABEL(report.ai_priority_score ?? 50)} · Score {report.ai_priority_score ?? '—'}
                  </span>
                  <button
                    onClick={() => setCollapsed(c => !c)}
                    className="text-slate-500 hover:text-[#00d4ff] transition-colors"
                    aria-label={collapsed ? 'Show timeline' : 'Hide timeline'}>
                    <ChevronLeft size={14} className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : 'rotate-90'}`} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Status: </span><span className="text-white capitalize">{report.status}</span></div>
                <div><span className="text-slate-500">People: </span><span className="text-white">{report.people_count}</span></div>
                <div><span className="text-slate-500">Barangay: </span><span className="text-white">{report.barangay ?? '—'}</span></div>
                <div><span className="text-slate-500">Submitted: </span><span className="text-white">{fmtTime(report.created_at)}</span></div>
              </div>
              {(() => {
                const meta = RESCUE_STATUS_META[report.rescue_status] ?? { label: report.rescue_status, color: '#94a3b8' }
                return (
                  <div className="rounded-xl p-2 text-center border" style={{ borderColor: meta.color + '44', background: meta.color + '18' }}>
                    <p className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</p>
                  </div>
                )
              })()}
            </div>

            {/* Timeline — shown when expanded */}
            {!collapsed && (
              <div className="glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Response Timeline</p>
                  <button onClick={load} className="text-slate-500 hover:text-[#00d4ff] transition-colors">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
                <div className="space-y-3">
                  {buildTimeline(report, events).map(({ label, done, ts }, i) => (
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
              </div>
            )}

            {/* CTA — shown when expanded AND rescued */}
            {!collapsed && report.rescue_status === 'rescued' && (
              <div className="glass rounded-2xl p-3 border border-green-500/30 bg-green-900/10">
                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Tell Us About Your Experience</span>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">Share your experience to improve emergency response</p>
                <div className="flex gap-2 mt-2.5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/sos/${report.id}/feedback`)}
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

            {/* Last sync footer */}
            {lastSync && (
              <p className="text-[10px] text-slate-600 text-center">
                Last synced: {fmtTime(lastSync.toISOString())}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
