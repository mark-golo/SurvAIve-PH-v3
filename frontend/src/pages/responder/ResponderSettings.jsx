import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, MapPin, Radio, List, Map, Settings, Home,
  Server, Check, Sun, Bell, Volume2, Eye, Zap, VolumeX,
  Shield, Lock, Loader, CheckCircle, AlertCircle, ChevronDown,
  Info, HelpCircle, FileText,
} from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { setXamppHost, localFetch } from '../../lib/api'
import { getNetworkOnline } from '../../lib/capacitor'
import { getResponderTheme, saveResponderTheme } from '../../lib/victimTheme'
import { useAlertStore } from '../../store/alertStore'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Mesh',     path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

// ── Reusable sub-components ───────────────────────────────────────────────────

// Glass-card accordion for top-level sections
function CardAccordion({ title, icon: Icon, iconColor = 'text-[#00d4ff]', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[rgba(255,255,255,0.025)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={15} className={iconColor} />}
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-[rgba(255,255,255,0.08)] px-4 pb-4 pt-3 space-y-1">
          {children}
        </div>
      )}
    </div>
  )
}

// Row accordion for nested items inside a CardAccordion
function RowAccordion({ title, icon: Icon, iconColor = 'text-slate-400', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:opacity-75 transition-opacity"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={13} className={iconColor} />}
          <span className="text-sm text-slate-200 font-semibold">{title}</span>
        </div>
        <ChevronDown
          size={13}
          className={`text-slate-500 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="pb-2 pl-5 pt-2 border-t border-[rgba(255,255,255,0.05)]">
          {children}
        </div>
      )}
    </div>
  )
}

// Read-only info row for Responder Information
function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-0 gap-4">
      <div className="flex items-center gap-1.5 shrink-0">
        {Icon && <Icon size={10} className="text-slate-500" />}
        <span className="text-xs text-slate-500 w-28">{label}</span>
      </div>
      <span className="text-xs text-slate-200 text-right break-words max-w-[55%]">{value || '—'}</span>
    </div>
  )
}

// Alert toggle row (responder-only)
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

// ── Main page component ───────────────────────────────────────────────────────

export function ResponderSettings() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  // Responder profile from Supabase
  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)

  // Alert store
  const {
    soundEnabled,        toggleSound,
    visualEnabled,       toggleVisual,
    notificationEnabled, toggleNotification,
    volume,              setVolume,
  } = useAlertStore()

  // Theme
  const [theme, setThemeState] = useState(() => getResponderTheme())
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    saveResponderTheme(next)
  }

  // XAMPP host
  const [xamppHost,  setXamppHostState] = useState('192.168.43.1')
  const [xamppSaved, setXamppSaved]     = useState(false)

  // Change Password state
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving,  setPwSaving]  = useState(false)
  const [pwMsg,     setPwMsg]     = useState(null)

  // Load XAMPP host
  useEffect(() => {
    async function loadXamppHost() {
      try {
        const { Preferences } = await import('@capacitor/preferences')
        const { value } = await Preferences.get({ key: 'survAIve-xampp-host' })
        if (value) setXamppHostState(value)
      } catch {}
    }
    loadXamppHost()
  }, [])

  // Load responder profile from Supabase
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

  async function handleSaveXamppHost() {
    const trimmed = xamppHost.trim()
    if (!trimmed) return
    setXamppHost(trimmed)
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key: 'survAIve-xampp-host', value: trimmed })
    } catch {}
    setXamppSaved(true)
    setTimeout(() => setXamppSaved(false), 2000)
  }

  async function handlePasswordSave(e) {
    e.preventDefault()
    if (!currentPw || !newPw) return
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return }
    if (newPw.length < 8)    { setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return }
    setPwSaving(true); setPwMsg(null)
    try {
      try {
        await localFetch('profile', {
          method: 'PUT',
          body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
        })
        // Sync to Supabase Auth for online staff
        if (getNetworkOnline()) {
          const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }))
          if (session) supabase.auth.updateUser({ password: newPw }).catch(() => {})
        }
      } catch (localErr) {
        // XAMPP unreachable + online → Supabase Auth fallback
        if ((!localErr.status || localErr.status === 401) && getNetworkOnline()) {
          const { error: updErr } = await supabase.auth.updateUser({ password: newPw })
          if (updErr) throw new Error(updErr.message ?? 'Failed to change password.')
        } else {
          throw localErr
        }
      }
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwMsg({ ok: true, text: 'Password changed successfully.' })
    } catch (err) {
      setPwMsg({ ok: false, text: err?.message ?? 'Failed to change password.' })
    } finally {
      setPwSaving(false)
    }
  }

  const name   = profile?.name  || user?.name || 'Responder'
  const status = profile?.status ?? 'active'

  if (loading) return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${theme === 'light' ? ' light-theme' : ''}`}>
      <TopBar title="Settings" onBack />
      <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">Loading…</div>
      <MobileNavBar items={NAV} />
    </div>
  )

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${theme === 'light' ? ' light-theme' : ''}`}>
      <TopBar title="Settings" onBack />

      <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-nav">

        {/* ── 1. Account card — always visible ────────────────────────── */}
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(0,212,255,0.2)] to-[rgba(139,92,246,0.2)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center shrink-0">
              <User size={22} className="text-[#00d4ff]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{name}</p>
              <p className="text-xs text-slate-500">
                Field Responder ·{' '}
                <span className={status === 'active' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                  {status}
                </span>
              </p>
            </div>
          </div>
        </GlassCard>

        {/* ── 2. Responder Information ─────────────────────────────────── */}
        <CardAccordion title="Responder Information" icon={User} iconColor="text-[#22c55e]">
          <InfoRow label="Contact Number" value={profile?.contact_number} />
          <InfoRow label="Team ID"        value={profile?.team_id} />
          <InfoRow label="Unit Name"      value={profile?.unit_name} />
          <InfoRow label="Assigned Zone"  value={profile?.assigned_zone} icon={MapPin} />
          <InfoRow label="Barangay"       value={profile?.assigned_barangay ?? profile?.barangay} />
          <InfoRow label="Municipality"   value={profile?.municipality} />
          <InfoRow label="Province"       value={profile?.province} />
        </CardAccordion>

        {/* ── 3. Account & Preferences ─────────────────────────────────── */}
        <CardAccordion title="Account & Preferences" icon={Shield} iconColor="text-[#8b5cf6]">

          {/* Security & Privacy */}
          <RowAccordion title="Security & Privacy" icon={Lock} iconColor="text-slate-400">

            {/* Change Password */}
            <RowAccordion title="Change Password" icon={Lock} iconColor="text-slate-500">
              <form onSubmit={handlePasswordSave} className="space-y-3 mt-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)] transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  {pwMsg ? (
                    <div className={`flex items-center gap-1.5 text-xs ${pwMsg.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {pwMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                      {pwMsg.text}
                    </div>
                  ) : <span />}
                  <button
                    type="submit"
                    disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[rgba(0,212,255,0.12)] border border-[rgba(0,212,255,0.3)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.2)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {pwSaving && <Loader size={11} className="animate-spin" />}
                    Change Password
                  </button>
                </div>
              </form>
            </RowAccordion>

            {/* Local Server */}
            <RowAccordion title="Local Server" icon={Server} iconColor="text-slate-500">
              <p className="text-xs text-slate-400 leading-relaxed mb-3 mt-2">
                IP address of the admin device running XAMPP. Used to submit SOS reports and
                sync data when there is no internet. Default is the Android hotspot gateway (192.168.43.1).
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={xamppHost}
                  onChange={e => setXamppHostState(e.target.value)}
                  placeholder="192.168.43.1"
                  className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(0,212,255,0.2)] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors"
                />
                <button
                  onClick={handleSaveXamppHost}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    xamppSaved
                      ? 'bg-[rgba(34,197,94,0.2)] text-[#22c55e] border border-[rgba(34,197,94,0.3)]'
                      : 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.25)]'
                  }`}
                >
                  {xamppSaved ? <><Check size={12} /> Saved</> : 'Save'}
                </button>
              </div>
            </RowAccordion>

          </RowAccordion>

          {/* Notifications & Preferences */}
          <RowAccordion title="Notifications & Preferences" icon={Bell} iconColor="text-slate-400">

            {/* Appearance */}
            <RowAccordion title="Appearance" icon={Sun} iconColor="text-[#f59e0b]">
              <div className="flex items-center justify-between py-2 mt-1">
                <div>
                  <p className="text-sm text-white font-medium">Light Mode</p>
                  <p className="text-xs text-slate-500 mt-0.5">Switch to a brighter, easier-to-read interface</p>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${theme === 'light' ? 'bg-[#00d4ff]' : 'bg-slate-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${theme === 'light' ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </RowAccordion>

            {/* Emergency Alerts */}
            <RowAccordion title="Emergency Alerts" icon={Bell} iconColor="text-[#ef4444]">
              <div className="mt-2 space-y-0">
                {/* Toggles */}
                <AlertToggleRow icon={Volume2} label="Alert Sound"   desc="Play audio alarm when new SOS arrives"           enabled={soundEnabled}        onToggle={toggleSound} />
                <AlertToggleRow icon={Eye}     label="Visual Pulse"  desc="Red screen flash when new SOS arrives"           enabled={visualEnabled}       onToggle={toggleVisual} />
                <AlertToggleRow icon={Bell}    label="Notification"  desc="Show notification card for incoming SOS alerts"  enabled={notificationEnabled} onToggle={toggleNotification} />

                {/* Volume slider */}
                <div className="pt-3 pb-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Volume2 size={13} className={soundEnabled ? 'text-[#ef4444]' : 'text-slate-600'} />
                    <p className="text-xs font-semibold text-white">Alert Volume</p>
                    <span className="ml-auto text-xs font-bold text-slate-400">{Math.round(volume * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.05} value={volume}
                    disabled={!soundEnabled}
                    onChange={e => setVolume(+e.target.value)}
                    className={`w-full h-1.5 rounded-full appearance-none cursor-pointer transition-opacity ${soundEnabled ? 'opacity-100' : 'opacity-30 cursor-not-allowed'}`}
                    style={{ background: `linear-gradient(to right, #ef4444 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)` }}
                  />
                </div>

                {/* Test / Mute */}
                <div className="pt-3 border-t border-[rgba(255,255,255,0.05)] space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)] flex items-center justify-center shrink-0">
                        <Zap size={13} className="text-[#ef4444]" />
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
                        <VolumeX size={13} className="text-slate-400" />
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
                </div>
              </div>
            </RowAccordion>

          </RowAccordion>

        </CardAccordion>

        {/* ── 4. Support & Information ─────────────────────────────────── */}
        <CardAccordion title="Support & Information" icon={Info} iconColor="text-[#f59e0b]">

          <RowAccordion title="Help & Support" icon={HelpCircle} iconColor="text-slate-400">
            <div className="space-y-2 mt-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                For assistance, contact your DRRM Coordinator or the Municipal DRRMO.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Monitor the <span className="text-[#ef4444] font-semibold">Queue</span> for incoming SOS reports assigned to your unit.
              </p>
            </div>
          </RowAccordion>

          <RowAccordion title="Terms & Privacy Policy" icon={FileText} iconColor="text-slate-400">
            <div className="space-y-2 mt-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                All SOS and dispatch data is handled in accordance with NDRRMC protocols. Victim information accessed through this system is strictly for emergency response purposes.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unauthorized disclosure of victim data is prohibited under applicable data privacy regulations.
              </p>
            </div>
          </RowAccordion>

          <RowAccordion title="About SurvAIve PH" icon={Info} iconColor="text-slate-400">
            <div className="space-y-2 mt-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-white font-semibold">SurvAIve PH</span> is an AI-powered mesh-network emergency response system built for the Philippines.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Features include real-time SOS dispatch, responder queue management, offline mesh communication, and smart evacuation center coordination.
              </p>
              <p className="text-xs text-slate-500">Version 3.0 · 2024</p>
            </div>
          </RowAccordion>

        </CardAccordion>

        {/* ── Sign Out ─────────────────────────────────────────────────── */}
        <NeonButton variant="ghost" onClick={() => { logout(); navigate('/') }} className="w-full">
          Sign Out
        </NeonButton>

        <p className="text-center text-[10px] text-slate-600">SurvAIve PH</p>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
