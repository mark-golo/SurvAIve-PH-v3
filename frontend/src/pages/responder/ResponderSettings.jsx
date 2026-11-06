import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, MapPin, Radio, List, Map, Settings, Home, Server, Check, Sun, Bell, Volume2, Eye, Zap, VolumeX } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { setXamppHost } from '../../lib/api'
import { getResponderTheme, saveResponderTheme } from '../../lib/victimTheme'
import { AccountSettings } from '../../components/AccountSettings'
import { useAlertStore } from '../../store/alertStore'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Mesh',     path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

export function ResponderSettings() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme, setThemeState] = useState(() => getResponderTheme())

  const {
    soundEnabled,        toggleSound,
    visualEnabled,       toggleVisual,
    notificationEnabled, toggleNotification,
    volume,              setVolume,
  } = useAlertStore()
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    saveResponderTheme(next)
  }

  // XAMPP / local server IP — persisted via Capacitor Preferences
  const [xamppHost,  setXamppHostState] = useState('192.168.43.1')
  const [xamppSaved, setXamppSaved]     = useState(false)

  // Load persisted XAMPP host on mount
  useEffect(() => {
    async function loadXamppHost() {
      try {
        const { Preferences } = await import('@capacitor/preferences')
        const { value } = await Preferences.get({ key: 'survAIve-xampp-host' })
        if (value) setXamppHostState(value)
      } catch { /* web build */ }
    }
    loadXamppHost()
  }, [])

  async function handleSaveXamppHost() {
    const trimmed = xamppHost.trim()
    if (!trimmed) return
    setXamppHost(trimmed)
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key: 'survAIve-xampp-host', value: trimmed })
    } catch { /* web build */ }
    setXamppSaved(true)
    setTimeout(() => setXamppSaved(false), 2000)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) { setLoading(false); return }
      supabase
        .from('responders')
        .select('*')
        .eq('contact_number', contact)
        .single()
        .then(({ data }) => { if (data) setProfile(data) })
        .finally(() => setLoading(false))
    })
  }, [])

  const name = profile?.name || user?.name || 'Responder'
  const status = profile?.status ?? 'active'

  if (loading) return (
    <div className={`min-h-screen bg-mesh flex flex-col pb-nav${theme === 'light' ? ' light-theme' : ''}`}>
      <TopBar title="Responder Settings" onBack />
      <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">Loading…</div>
      <MobileNavBar items={NAV} />
    </div>
  )

  return (
    <div className={`min-h-screen bg-mesh flex flex-col pb-nav${theme === 'light' ? ' light-theme' : ''}`}>
      <TopBar title="Responder Settings" onBack />

      <main className="flex-1 p-4 space-y-4">
        {/* Profile */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(0,212,255,0.2)] to-[rgba(139,92,246,0.2)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
              <User size={22} className="text-[#00d4ff]" />
            </div>
            <div>
              <p className="font-bold text-white">{name}</p>
              <p className="text-xs text-slate-500">
                Field Responder ·{' '}
                <span className={status === 'active' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                  {status}
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-0 pt-3 border-t border-[rgba(255,255,255,0.06)]">
            <InfoRow label="Contact"       value={profile?.contact_number} />
            <InfoRow label="Team ID"       value={profile?.team_id} />
            <InfoRow label="Unit Name"     value={profile?.unit_name} />
            <InfoRow label="Assigned Zone" value={profile?.assigned_zone} icon={MapPin} />
            <InfoRow label="Barangay"      value={profile?.assigned_barangay ?? profile?.barangay} />
            <InfoRow label="Municipality"  value={profile?.municipality} />
            <InfoRow label="Province"      value={profile?.province} />
          </div>
        </GlassCard>

        {/* XAMPP / Local server config */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <Server size={16} className="text-[#00d4ff]" />
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">Local Server (XAMPP)</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            IP address of the admin device running XAMPP. Used to submit SOS reports and
            sync data when there is no internet. Default is the Android hotspot gateway (192.168.43.1).
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={xamppHost}
              onChange={(e) => setXamppHostState(e.target.value)}
              placeholder="192.168.43.1"
              className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(0,212,255,0.2)] rounded-lg
                         px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none
                         focus:border-[rgba(0,212,255,0.5)] transition-colors"
            />
            <button
              onClick={handleSaveXamppHost}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5
                ${xamppSaved
                  ? 'bg-[rgba(34,197,94,0.2)] text-[#22c55e] border border-[rgba(34,197,94,0.3)]'
                  : 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.25)]'
                }`}
            >
              {xamppSaved ? <><Check size={12} /> Saved</> : 'Save'}
            </button>
          </div>
        </GlassCard>

        {/* Emergency Alert Settings */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-[#ef4444]" />
            <p className="text-xs font-black text-white uppercase tracking-wider">Emergency Alert Settings</p>
          </div>
          <GlassCard>
            <AlertToggleRow icon={Volume2} label="Alert Sound"   desc="Play audio alarm when new SOS arrives"           enabled={soundEnabled}        onToggle={toggleSound} />
            <AlertToggleRow icon={Eye}     label="Visual Pulse"  desc="Red screen flash when new SOS arrives"           enabled={visualEnabled}       onToggle={toggleVisual} />
            <AlertToggleRow icon={Bell}    label="Notification"  desc="Show notification card for incoming SOS alerts"  enabled={notificationEnabled} onToggle={toggleNotification} />
          </GlassCard>

          {/* Volume */}
          <GlassCard className="mt-3">
            <div className="flex items-center gap-3 mb-3">
              <Volume2 size={14} className={soundEnabled ? 'text-[#ef4444]' : 'text-slate-600'} />
              <p className="text-xs font-semibold text-white">Alert Volume</p>
              <span className="ml-auto text-xs font-bold text-slate-400">{Math.round(volume * 100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={volume}
              disabled={!soundEnabled}
              onChange={e => setVolume(+e.target.value)}
              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer transition-opacity ${soundEnabled ? 'opacity-100' : 'opacity-30 cursor-not-allowed'}`}
              style={{ background: `linear-gradient(to right, #ef4444 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)` }}
            />
          </GlassCard>

          {/* Test / Mute */}
          <GlassCard className="mt-3">
            <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-[rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)] flex items-center justify-center shrink-0">
                  <Zap size={14} className="text-[#ef4444]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Test Alert</p>
                  <p className="text-[10px] text-slate-500">Simulate the full visual and audio alert</p>
                </div>
              </div>
              <button onClick={() => window.__triggerTestAlert?.()}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white hover:opacity-90 transition-all">
                Test
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[rgba(107,114,128,0.12)] border border-[rgba(107,114,128,0.2)] flex items-center justify-center shrink-0">
                  <VolumeX size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Mute Alert</p>
                  <p className="text-[10px] text-slate-500">Stop active audio and visual pulse</p>
                </div>
              </div>
              <button onClick={() => window.__muteCurrentAlert?.()}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-[rgba(255,255,255,0.1)] hover:text-white transition-all">
                Mute
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Appearance */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <Sun size={16} className="text-[#f59e0b]" />
            <p className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wider">Appearance</p>
          </div>
          <ToggleRow
            on={theme === 'light'}
            onToggle={toggleTheme}
            label="Light Mode"
            sub="Switch to a brighter, easier-to-read interface"
          />
        </GlassCard>

        {/* Account Settings */}
        <AccountSettings />

        <NeonButton variant="ghost" onClick={() => { logout(); navigate('/') }} className="w-full">
          Sign Out
        </NeonButton>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={11} className="text-slate-500" />}
        <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xs text-white font-medium">{value || '—'}</p>
    </div>
  )
}

function AlertToggleRow({ icon: Icon, label, desc, enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <Icon size={15} className="text-[#ef4444]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          {desc && <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      <button onClick={onToggle}
        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 ${
          enabled
            ? 'bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.4)] text-[#ef4444]'
            : 'text-slate-500 border-[rgba(255,255,255,0.12)] hover:text-slate-300'
        }`}>
        {enabled ? 'ON' : 'OFF'}
      </button>
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
