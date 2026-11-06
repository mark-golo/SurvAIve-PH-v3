import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { deviceSettings } from '../../lib/deviceSettings'
import { Bell, Shield, Battery, LogOut, Phone, User, Radio, ChevronRight, Home, Map, Settings, MessageSquare, Sun } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme, saveVictimTheme } from '../../lib/victimTheme'
import { AccountSettings } from '../../components/AccountSettings'

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
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${on ? 'bg-[#00d4ff]' : 'bg-slate-700'}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${on ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

export function VictimSettings() {
  const navigate = useNavigate()
  const { user, isGuest, logout } = useAuthStore()

  const { meshRelay: initRelay, batterySaver: initBattery } = deviceSettings.getSettings()
  const [batterySaver, setBatterySaver] = useState(initBattery)
  const [meshRelay, setMeshRelay]       = useState(initRelay)

  useEffect(() => { deviceSettings.init() }, [])

  // Theme preference — persisted in localStorage, applied to the wrapper div
  const [theme, setThemeState] = useState(() => getVictimTheme())
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    saveVictimTheme(next)
  }

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${theme === 'light' ? ' light-theme' : ''}`}>
      <TopBar title="Settings" onBack />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-nav">
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

        {/* Network settings */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Network &amp; Power</p>
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            <Toggle
              on={meshRelay}
              onToggle={() => {
                const next = !meshRelay
                setMeshRelay(next)
                deviceSettings.setMeshRelay(next)
              }}
              label="Mesh Relay Mode"
              sub="Forward messages from nearby devices (uses more battery)"
            />
            <Toggle
              on={batterySaver}
              onToggle={() => {
                const next = !batterySaver
                setBatterySaver(next)
                deviceSettings.setBatterySaver(next)
              }}
              label="Battery Saver Mode"
              sub="Reduces background scanning, prolongs battery life"
            />
          </div>
        </GlassCard>

        {/* Appearance */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <Sun size={16} className="text-[#f59e0b]" />
            <p className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wider">Appearance</p>
          </div>
          <Toggle
            on={theme === 'light'}
            onToggle={toggleTheme}
            label="Light Mode"
            sub="Switch to a brighter, easier-to-read interface"
          />
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

        {/* Account Settings */}
        <AccountSettings />

        {/* Logout */}
        <NeonButton variant="ghost" onClick={handleLogout} className="w-full">
          {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
        </NeonButton>

        <p className="text-center text-[10px] text-slate-600">SurvAIve PH</p>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
