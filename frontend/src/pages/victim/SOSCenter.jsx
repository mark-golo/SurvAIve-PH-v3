import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertOctagon, Clock, Activity, CheckCircle, ChevronRight, WifiOff, Map, Radio, Settings, Home, MessageSquare } from 'lucide-react'
import { MobileNavBar } from '../../components/ui/NavBar'
import { TopBar } from '../../components/ui/NavBar'
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

export function SOSCenter() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [isOnline]= useState(getNetworkOnline)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOnline) { setLoading(false); return }
    api.get('/sos/mine').then(data => {
      setReports(Array.isArray(data) ? data : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [isOnline])

  const active    = reports.filter(r => !['rescued','cannot_reach'].includes(r.rescue_status) && !r.dismissed)
  const awaiting  = reports.filter(r => r.rescue_status === 'pending')
  const inprog    = reports.filter(r => ['en_route','on_scene'].includes(r.rescue_status))
  const completed = reports.filter(r => r.rescue_status === 'rescued' || r.dismissed)

  function goToTracking() {
    const first = active[0]
    if (first) navigate(`/sos/${first.id}`)
    else navigate('/sos/history')
  }

  const stats = [
    { label: 'Active',           value: active.length,    icon: AlertOctagon, color: 'text-red-400',   bg: 'from-red-900/30 to-red-800/20' },
    { label: 'Awaiting Response',value: awaiting.length,  icon: Clock,        color: 'text-amber-400', bg: 'from-amber-900/30 to-amber-800/20' },
    { label: 'In Progress',      value: inprog.length,    icon: Activity,     color: 'text-blue-400',  bg: 'from-blue-900/30 to-blue-800/20' },
    { label: 'Completed',        value: completed.length, icon: CheckCircle,  color: 'text-green-400', bg: 'from-green-900/30 to-green-800/20' },
  ]

  const mgmt = [
    { label: 'Response Tracking', sub: 'Track your active SOS incident', icon: Activity, onClick: goToTracking },
    { label: 'Incident History',  sub: 'View all your SOS records',      icon: Clock,    onClick: () => navigate('/sos/history') },
    { label: 'Post-Rescue Feedback', sub: 'Rate completed responses',    icon: CheckCircle, onClick: () => navigate('/sos/history') },
  ]

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="SOS Center" subtitle={user?.name ?? 'Emergency Services'} />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-nav">

        {/* Emergency SOS button */}
        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/sos/new')}
          className="w-full py-5 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 border border-red-500/40
                     shadow-[0_0_32px_rgba(239,68,68,0.3)] flex items-center justify-center gap-3 active:opacity-90">
          <AlertOctagon size={24} className="text-white" />
          <span className="text-white text-lg font-black tracking-wide">Send Emergency SOS</span>
        </motion.button>

        {/* Overview tiles */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Emergency Overview</p>
          {!isOnline ? (
            <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-amber-500/20">
              <WifiOff size={18} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400">Offline — overview unavailable. Connect to see your SOS history.</p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="glass rounded-2xl p-4 h-20 animate-pulse bg-[rgba(255,255,255,0.03)]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {stats.map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={`glass rounded-2xl p-4 bg-gradient-to-br ${bg} border border-[rgba(255,255,255,0.06)]`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} className={color} />
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>
                  </div>
                  <p className={`text-3xl font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SOS Management cards */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">SOS Management</p>
          <div className="space-y-2">
            {mgmt.map(({ label, sub, icon: Icon, onClick }) => (
              <button key={label} onClick={onClick}
                className="w-full glass rounded-2xl p-4 flex items-center gap-4 border border-[rgba(255,255,255,0.06)]
                           hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] transition-all text-left">
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)]
                                flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-[#00d4ff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                </div>
                <ChevronRight size={16} className="text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>

      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
