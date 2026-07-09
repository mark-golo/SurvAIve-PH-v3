import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Map, Radio, Settings, MessageSquare, Battery, Satellite, Home } from 'lucide-react'
import { SOSButton } from '../../components/ui/SOSButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { OfflineIndicator } from '../../components/ui/OfflineIndicator'
import { MobileNavBar } from '../../components/ui/NavBar'
import { useAuthStore } from '../../store/auth'
import { mesh } from '../../lib/mesh'
import { useState, useEffect } from 'react'

const STATUS_OPTIONS = [
  { label: 'Injured',  color: '#ef4444', icon: '🤕', value: 'injured' },
  { label: 'Trapped',  color: '#f97316', icon: '🆘', value: 'trapped' },
  { label: 'Safe',     color: '#22c55e', icon: '✅', value: 'safe'    },
]

const NAV = [
  { icon: Home,            label: 'Home',   path: '/home'     },
  { icon: MessageSquare,   label: 'SOS',    path: '/sos'      },
  { icon: Map,             label: 'Map',    path: '/map'      },
  { icon: Radio,           label: 'Mesh',   path: '/mesh'     },
  { icon: Settings,        label: 'Settings',path: '/settings' },
]

export function HomeScreen() {
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const [quickStatus, setQuickStatus] = useState(null)
  const [peers] = useState(mesh.getPeers())

  useEffect(() => {
    document.title = 'SurvAIve PH – Home'
  }, [])

  const handleSOS = () => navigate('/sos')

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      {/* Top bar */}
      <header className="glass border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[rgba(0,212,255,0.3)] to-[rgba(139,92,246,0.3)] flex items-center justify-center">
              <span className="text-[10px] font-black text-[#00d4ff]">SP</span>
            </div>
            <div>
              <p className="text-xs font-bold text-white">{user?.name ?? 'Anonymous'}</p>
              <p className="text-[10px] text-slate-500">{user?.barangay ?? user?.municipality ?? 'Location unknown'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isGuest ? (
              <StatusBadge status="GUEST" />
            ) : (
              <StatusBadge status="VERIFIED" />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-5">
        {/* Status indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          <OfflineIndicator meshConnected={peers.length > 0} peerCount={peers.length} />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-[rgba(255,255,255,0.08)]">
            <Satellite size={12} className="text-[#00d4ff]" />
            <span className="text-[11px] text-[#00d4ff] font-medium">GPS Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-[rgba(255,255,255,0.08)]">
            <Battery size={12} className="text-[#22c55e]" />
            <span className="text-[11px] text-[#22c55e] font-medium">87%</span>
          </div>
        </div>

        {/* SOS Button — center piece */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center py-4"
        >
          <SOSButton onTrigger={handleSOS} />
        </motion.div>

        {/* Quick status */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Quick Status Update</p>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setQuickStatus(s.value)}
                className={`glass rounded-xl py-3 flex flex-col items-center gap-1.5 transition-all border ${
                  quickStatus === s.value
                    ? `border-[${s.color}] bg-[${s.color}15] shadow-[0_0_12px_${s.color}30]`
                    : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]'
                }`}
              >
                <span className="text-xl">{s.icon}</span>
                <span className="text-xs font-medium" style={{ color: quickStatus === s.value ? s.color : '#94a3b8' }}>
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/map')}
            className="glass rounded-2xl p-4 cursor-pointer hover:border-[rgba(0,212,255,0.3)] transition-all border border-[rgba(255,255,255,0.08)]"
          >
            <Map size={20} className="text-[#00d4ff] mb-2" />
            <p className="text-sm font-semibold text-white">Local Map</p>
            <p className="text-xs text-slate-500 mt-0.5">Nearby incidents</p>
          </motion.div>
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/mesh')}
            className="glass rounded-2xl p-4 cursor-pointer hover:border-[rgba(34,197,94,0.3)] transition-all border border-[rgba(255,255,255,0.08)]"
          >
            <Radio size={20} className={peers.length > 0 ? 'text-[#22c55e] animate-pulse mb-2' : 'text-slate-500 mb-2'} />
            <p className="text-sm font-semibold text-white">Mesh Network</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {peers.length > 0 ? `${peers.length} peer(s) found` : 'No peers nearby'}
            </p>
          </motion.div>
        </div>

        {/* Emergency tip */}
        <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.2)]">
          <p className="text-[11px] text-[#f59e0b] font-semibold mb-1">⚡ Emergency Tip</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Stay calm. Move to higher ground if flooding. Keep phone charged.
            This app works without internet via mesh networking.
          </p>
        </div>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
