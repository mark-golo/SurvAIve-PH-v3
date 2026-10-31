import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight, WifiOff, Map, Radio, Settings, Home, MessageSquare, RefreshCw } from 'lucide-react'
import { MobileNavBar, TopBar } from '../../components/ui/NavBar'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import api from '../../lib/api'

const NAV = [
  { icon: Home,          label: 'Home',    path: '/home'     },
  { icon: MessageSquare, label: 'SOS',     path: '/sos'      },
  { icon: Map,           label: 'Map',     path: '/map'      },
  { icon: Radio,         label: 'Mesh',    path: '/mesh'     },
  { icon: Settings,      label: 'Settings',path: '/settings' },
]

const RESCUE_STATUS_LABELS = {
  pending:       { label: 'Awaiting Response', color: 'text-amber-400',  bg: 'bg-amber-900/40' },
  en_route:      { label: 'En Route',          color: 'text-blue-400',   bg: 'bg-blue-900/40'  },
  on_scene:      { label: 'On Scene',          color: 'text-violet-400', bg: 'bg-violet-900/40'},
  rescued:       { label: 'Rescued',           color: 'text-green-400',  bg: 'bg-green-900/40' },
  cannot_reach:  { label: 'Cannot Reach',      color: 'text-red-400',    bg: 'bg-red-900/40'   },
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

export function IncidentHistory() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [isOnline]= useState(getNetworkOnline)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

  function load() {
    setLoading(true)
    api.get('/sos/mine').then(data => {
      setReports(Array.isArray(data) ? data : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { if (isOnline) { load() } else { setLoading(false) } }, [isOnline])

  const filtered = useMemo(() => {
    switch (tab) {
      case 'active':    return reports.filter(r => !['rescued','cannot_reach'].includes(r.rescue_status) && !r.dismissed)
      case 'completed': return reports.filter(r => r.rescue_status === 'rescued' || r.dismissed)
      case 'awaiting':  return reports.filter(r => r.rescue_status === 'pending')
      default:          return reports
    }
  }, [reports, tab])

  const tabs = [
    { key: 'all',       label: 'All' },
    { key: 'active',    label: 'Active' },
    { key: 'awaiting',  label: 'Awaiting' },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Incident History" onBack />

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
            <p className="text-sm">Incident history requires an internet connection.</p>
          </div>
        ) : loading ? (
          <div className="space-y-2 mt-2">
            {[1,2,3].map(i => (
              <div key={i} className="glass rounded-2xl p-4 h-24 animate-pulse bg-[rgba(255,255,255,0.03)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
            <Clock size={28} />
            <p className="text-sm text-center">
              {tab === 'all' ? 'No SOS reports found.' : `No ${tab} incidents.`}
            </p>
          </div>
        ) : (
          filtered.map(r => {
            const st    = RESCUE_STATUS_LABELS[r.rescue_status] ?? { label: r.rescue_status, color: 'text-slate-400', bg: 'bg-slate-700' }
            const pLbl  = priorityLabel(r.ai_priority_score ?? 50)
            const feedbackEligible = r.rescue_status === 'rescued'
            return (
              <button key={r.id} onClick={() => navigate(`/sos/${r.id}`)}
                className="w-full glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]
                           hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] transition-all text-left">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono text-slate-500">#{r.id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_LABELS[pLbl]}`}>{pLbl}</span>
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
                    {feedbackEligible && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 font-semibold">
                        Rate Response
                      </span>
                    )}
                  </div>
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
