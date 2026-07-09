import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Shield, Battery, LogOut, Phone, User, Radio, ChevronRight, Home, Map, Settings, MessageSquare } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuthStore } from '../../store/auth'

const NAV = [
  { icon: Home, label: 'Home', path: '/home' },
  { icon: MessageSquare, label: 'SOS', path: '/sos' },
  { icon: Map, label: 'Map', path: '/map' },
  { icon: Radio, label: 'Mesh', path: '/mesh' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

function Toggle({ on, onToggle, label, sub }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={onToggle}
        className={`w-11 h-6 rounded-full transition-all duration-200 relative ${on ? 'bg-[#00d4ff]' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-5.5' : 'left-0.5'}`}
          style={{ left: on ? '22px' : '2px' }} />
      </button>
    </div>
  )
}

export function VictimSettings() {
  const navigate = useNavigate()
  const { user, isGuest, logout } = useAuthStore()
  const [shakeAlert, setShakeAlert] = useState(true)
  const [volumeAlert, setVolumeAlert] = useState(false)
  const [batterySaver, setBatterySaver] = useState(false)
  const [meshRelay, setMeshRelay] = useState(true)

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar title="Settings" onBack />

      <main className="flex-1 p-4 space-y-4">
        {/* Account info */}
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(0,212,255,0.2)] to-[rgba(139,92,246,0.2)]
                            border border-[rgba(0,212,255,0.2)] flex items-center justify-center shrink-0">
              <User size={22} className="text-[#00d4ff]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{user?.name ?? 'Anonymous Guest'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.barangay ?? 'No location set'}</p>
            </div>
            <StatusBadge status={isGuest ? 'GUEST' : 'VERIFIED'} />
          </div>
          {!isGuest && (
            <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)] space-y-1">
              <p className="text-xs text-slate-500">Emergency Contact: <span className="text-slate-300">{user?.emergency_contact_name ?? '—'}</span></p>
              <p className="text-xs text-slate-500">Contact: <span className="text-slate-300">{user?.contact_number ?? '—'}</span></p>
            </div>
          )}
          {isGuest && (
            <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
              <button onClick={() => navigate('/login')}
                className="text-xs text-[#00d4ff] hover:text-white transition-colors">
                → Create a verified profile for priority rescue
              </button>
            </div>
          )}
        </GlassCard>

        {/* Auto-SOS triggers */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Auto-SOS Triggers</p>
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            <Toggle
              on={shakeAlert} onToggle={() => setShakeAlert(v => !v)}
              label="Shake to SOS"
              sub="Shake device 3× within 5 seconds to trigger SOS"
            />
            <Toggle
              on={volumeAlert} onToggle={() => setVolumeAlert(v => !v)}
              label="Volume Button SOS"
              sub="Hold volume down 5 seconds to send SOS"
            />
          </div>
        </GlassCard>

        {/* Network settings */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Network &amp; Power</p>
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            <Toggle
              on={meshRelay} onToggle={() => setMeshRelay(v => !v)}
              label="Mesh Relay Mode"
              sub="Forward messages from nearby devices (uses more battery)"
            />
            <Toggle
              on={batterySaver} onToggle={() => setBatterySaver(v => !v)}
              label="Battery Saver Mode"
              sub="Reduces background scanning, prolongs battery life"
            />
          </div>
        </GlassCard>

        {/* Data privacy */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <Shield size={16} className="text-[#8b5cf6]" />
            <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider">Privacy &amp; Data</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All SOS data is stored locally until synced. Your profile is only shared with DRRM officers in your municipality during emergencies.
            No data is sold or shared with third parties.
          </p>
        </GlassCard>

        {/* Logout */}
        <NeonButton variant="ghost" onClick={handleLogout} className="w-full">
          <LogOut size={14} className="mr-2" />
          {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
        </NeonButton>

        <p className="text-center text-[10px] text-slate-600">SurvAIve PH v3.0 · Offline-First Emergency System</p>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
