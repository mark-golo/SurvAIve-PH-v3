import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, WifiOff, RefreshCw, AlertOctagon,
  ChevronRight, Map, Radio, Settings, Home, MessageSquare,
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

const EMERGENCY_LABELS = {
  injured: 'Injured', trapped: 'Trapped', safe: 'Safe', missing: 'Missing', unknown: 'Unknown',
}

// ── Component ─────────────────────────────────────────────────────────────
export function ResponseTrackingList() {
  const navigate   = useNavigate()
  const [isLight]  = useState(() => getVictimTheme() === 'light')
  const [isOnline] = useState(getNetworkOnline)

  const [reports,   setReports]  = useState([])
  const [loading,   setLoading]  = useState(true)
  const [reloadKey, setReloadKey]= useState(0)

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

  const displayed = useMemo(
    () => reports.filter(r => r.rescue_status !== 'rescued' && !r.dismissed),
    [reports]
  )

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Response Tracking" onBack />

      <div className="flex justify-end px-4 pt-3 pb-1 shrink-0">
        <button onClick={load} className="text-slate-500 hover:text-[#00d4ff] transition-colors">
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
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#00d4ff] border-t-transparent animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
            <AlertOctagon size={28} />
            <p className="text-sm text-center">No active incidents.</p>
          </div>
        ) : (
          displayed.map(r => {
            const st   = RESCUE_STATUS_LABELS[r.rescue_status] ?? { label: r.rescue_status, color: 'text-slate-400', bg: 'bg-slate-700' }
            const pLbl = priorityLabel(r.ai_priority_score ?? 50)
            return (
              <button key={r.id} onClick={() => navigate(`/sos/${r.id}`, { state: { fromSection: 'Response Tracking' } })}
                className="w-full glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]
                           hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] transition-all text-left">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono text-slate-500">#{r.id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_LABELS[pLbl]}`}>{pLbl}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{EMERGENCY_LABELS[r.status] ?? r.status}</span>
                  {r.barangay && <span className="text-xs text-slate-500">· {r.barangay}</span>}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.color}`}>{st.label}</span>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={11} />
                    {fmtDate(r.created_at)}
                    <ChevronRight size={13} className="text-slate-600 ml-1" />
                  </div>
                </div>
              </button>
            )
          })
        )}
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
