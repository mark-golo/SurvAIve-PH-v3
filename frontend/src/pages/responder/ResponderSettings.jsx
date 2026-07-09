import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, User, MapPin, Radio, List, Map, Settings, RefreshCw } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput } from '../../components/ui/GlassInput'
import { useAuthStore } from '../../store/auth'

const NAV = [
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Relay',    path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

const SYNC_HISTORY = [
  { time: '14:32', count: 5, type: 'SOS Reports' },
  { time: '14:15', count: 2, type: 'Status Updates' },
  { time: '13:58', count: 8, type: 'SOS Reports' },
]

export function ResponderSettings() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [teamId, setTeamId] = useState('TEAM-A')
  const [zone, setZone] = useState('Zone 1 – North Sector')
  const [autoRelay, setAutoRelay] = useState(true)
  const [offlineForce, setOfflineForce] = useState(false)

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar title="Responder Settings" onBack />

      <main className="flex-1 p-4 space-y-4">
        {/* Profile */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(0,212,255,0.2)] to-[rgba(139,92,246,0.2)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
              <User size={22} className="text-[#00d4ff]" />
            </div>
            <div>
              <p className="font-bold text-white">{user?.name ?? 'Responder'}</p>
              <p className="text-xs text-slate-500">Field Responder · Active</p>
            </div>
          </div>
          <div className="space-y-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
            <GlassInput label="Team ID" value={teamId} onChange={e => setTeamId(e.target.value)} />
            <GlassInput label="Assigned Zone" value={zone} onChange={e => setZone(e.target.value)} icon={MapPin} />
          </div>
        </GlassCard>

        {/* Network */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Network Settings</p>
          <div className="space-y-3">
            <ToggleRow label="Auto-Relay Mode" sub="Background mesh forwarding" on={autoRelay} onToggle={() => setAutoRelay(v => !v)} />
            <ToggleRow label="Force Offline Mode" sub="Disable all network requests" on={offlineForce} onToggle={() => setOfflineForce(v => !v)} />
          </div>
        </GlassCard>

        {/* Sync history */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">Sync History</p>
            <RefreshCw size={13} className="text-slate-500" />
          </div>
          <div className="space-y-2">
            {SYNC_HISTORY.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <p className="text-xs text-white">{s.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{s.count} records</p>
                  <p className="text-[10px] text-slate-600">{s.time}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <NeonButton variant="ghost" onClick={() => { logout(); navigate('/') }} className="w-full">
          <LogOut size={14} className="mr-2" />
          Sign Out
        </NeonButton>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}

function ToggleRow({ label, sub, on, onToggle }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
      </div>
      <button onClick={onToggle} className={`w-11 h-6 rounded-full transition-all relative ${on ? 'bg-[#00d4ff]' : 'bg-slate-700'}`}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? '22px' : '2px' }} />
      </button>
    </div>
  )
}
