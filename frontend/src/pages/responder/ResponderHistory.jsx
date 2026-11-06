import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight, WifiOff, Home, List, Map, Radio, Settings, RefreshCw } from 'lucide-react'
import { MobileNavBar, TopBar } from '../../components/ui/NavBar'
import { getResponderTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import { supabase } from '../../lib/supabase'
import { fmtSosId } from '../../lib/format'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Mesh',     path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

const RESCUE_STATUS_LABELS = {
  pending:       { label: 'Awaiting Acknowledgment', color: 'text-slate-400',  bg: 'bg-slate-700'     },
  acknowledged:  { label: 'Acknowledged',            color: 'text-amber-400',  bg: 'bg-amber-900/40'  },
  en_route:      { label: 'In Progress',             color: 'text-blue-400',   bg: 'bg-blue-900/40'   },
  on_scene:      { label: 'In Progress',             color: 'text-violet-400', bg: 'bg-violet-900/40' },
  cannot_reach:  { label: 'In Progress',             color: 'text-amber-400',  bg: 'bg-amber-900/40'  },
  rescued:       { label: 'Completed',               color: 'text-green-400',  bg: 'bg-green-900/40'  },
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

export function ResponderHistory() {
  const navigate   = useNavigate()
  const [isLight]  = useState(() => getResponderTheme() === 'light')
  const [isOnline] = useState(getNetworkOnline)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) { setReports([]); return }

      const { data: responderRow } = await supabase
        .from('responders')
        .select('id')
        .eq('contact_number', contact)
        .single()

      if (!responderRow?.id) { setReports([]); return }

      const { data, error } = await supabase
        .from('sos_reports')
        .select('*')
        .eq('assigned_responder_id', responderRow.id)
        .eq('rescue_status', 'rescued')
        .order('confirmed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error) setReports(Array.isArray(data) ? data : [])
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOnline) load()
    else setLoading(false)
  }, [isOnline, reloadKey])

  useEffect(() => {
    if (!isOnline) return
    const poll = setInterval(() => setReloadKey(k => k + 1), 30_000)
    return () => clearInterval(poll)
  }, [isOnline])

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Incident History" onBack />

      {/* Section switcher */}
      <div className="flex gap-1 px-4 pt-3 pb-1 shrink-0">
        <button
          onClick={() => navigate('/responder/queue')}
          className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all text-slate-400 border border-transparent hover:text-white"
        >
          Response Tracking
        </button>
        <button
          className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)]"
        >
          Incident History
        </button>
        <button onClick={load} className="ml-auto text-slate-500 hover:text-[#00d4ff] transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-nav space-y-2 pt-2">
        {!isOnline ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
            <WifiOff size={28} />
            <p className="text-sm">Incident history requires an internet connection.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#00d4ff] border-t-transparent animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
            <Clock size={28} />
            <p className="text-sm text-center">No completed rescues yet.</p>
          </div>
        ) : (
          reports.map(r => {
            const st   = RESCUE_STATUS_LABELS[r.rescue_status] ?? { label: r.rescue_status, color: 'text-slate-400', bg: 'bg-slate-700' }
            const pLbl = priorityLabel(r.ai_priority_score ?? 50)
            return (
              <button key={r.id}
                onClick={() => navigate(`/responder/rescue/${r.id}`)}
                className="w-full glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]
                           hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] transition-all text-left">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono text-slate-500">{fmtSosId(r.id)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_LABELS[pLbl]}`}>{pLbl}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">
                    {EMERGENCY_LABELS[r.status] ?? r.status ?? 'Emergency'}
                  </span>
                  {r.name && <span className="text-xs text-slate-400">— {r.name}</span>}
                </div>
                {r.barangay && (
                  <p className="text-xs text-slate-500 mb-2">
                    {r.barangay}{r.municipality ? `, ${r.municipality}` : ''}
                  </p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.color}`}>
                    {st.label}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={11} />
                    {fmtDate(r.confirmed_at ?? r.created_at)}
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
