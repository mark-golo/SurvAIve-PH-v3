import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setXamppHost, localFetch } from '../../lib/api'
import { QRCodeSVG } from 'qrcode.react'
import {
  User, Shield, Settings, Home, Map, MessageSquare, Radio,
  Server, Check, Sun, QrCode, ChevronDown, Lock, Loader,
  CheckCircle, AlertCircle, Bell, Info, HelpCircle, FileText,
} from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme, saveVictimTheme } from '../../lib/victimTheme'

const NAV = [
  { icon: Home,          label: 'Home',     path: '/home' },
  { icon: MessageSquare, label: 'SOS',      path: '/sos' },
  { icon: Map,           label: 'Map',      path: '/map' },
  { icon: Radio,         label: 'Mesh',     path: '/mesh' },
  { icon: Settings,      label: 'Settings', path: '/settings' },
]

// ── Reusable sub-components ───────────────────────────────────────────────────

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

// Read-only field row for Personal Information
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-0 gap-4">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-xs text-slate-200 text-right break-words max-w-[55%]">{value || '—'}</span>
    </div>
  )
}

// ── Main page component ───────────────────────────────────────────────────────

export function VictimSettings() {
  const navigate = useNavigate()
  const { user, isGuest, logout } = useAuthStore()

  // QR state
  const [showQR,     setShowQR]     = useState(false)
  const [qrExpanded, setQrExpanded] = useState(false)

  // XAMPP host
  const [xamppHost,  setXamppHostState] = useState('192.168.43.1')
  const [xamppSaved, setXamppSaved]     = useState(false)

  useEffect(() => {
    async function loadXamppHost() {
      if (!window.Capacitor?.isNativePlatform?.()) return
      try {
        const { Preferences } = await import('@capacitor/preferences')
        const { value } = await Preferences.get({ key: 'survAIve-xampp-host' })
        if (value) setXamppHostState(value)
      } catch {}
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
    } catch {}
    setXamppSaved(true)
    setTimeout(() => setXamppSaved(false), 2000)
  }

  // Theme
  const [theme, setThemeState] = useState(() => getVictimTheme())
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    saveVictimTheme(next)
  }

  // Change PIN (victim equivalent of change password)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin,     setNewPin]     = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinSaving,  setPinSaving]  = useState(false)
  const [pinMsg,     setPinMsg]     = useState(null)

  async function handlePinSave(e) {
    e.preventDefault()
    if (!currentPin || !newPin) return
    if (newPin !== confirmPin) { setPinMsg({ ok: false, text: 'PINs do not match.' }); return }
    if (newPin.length < 4)     { setPinMsg({ ok: false, text: 'PIN must be at least 4 digits.' }); return }
    setPinSaving(true); setPinMsg(null)
    try {
      await localFetch('profile', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPin, new_password: newPin }),
      })
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
      setPinMsg({ ok: true, text: 'PIN changed successfully.' })
    } catch (err) {
      setPinMsg({ ok: false, text: err?.message ?? 'Failed to change PIN.' })
    } finally {
      setPinSaving(false)
    }
  }

  const handleLogout = () => { logout(); navigate('/') }

  // QR value — victim_id (stable) first, UUID fallback; never embed null/undefined
  const qrId    = user?.victim_id ?? user?.id
  const qrValue = qrId
    ? `SURVPH:EVACUEE:${qrId}:${encodeURIComponent(user?.name ?? '')}`
    : null

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
              <p className="font-bold text-white text-sm truncate">{user?.name ?? 'Anonymous Guest'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.municipality ?? user?.barangay ?? 'No location set'}</p>
            </div>
            <StatusBadge status={isGuest ? 'GUEST' : 'VERIFIED'} />
          </div>
          {isGuest && (
            <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
              <button onClick={() => navigate('/login')} className="text-xs text-[#00d4ff] hover:text-white transition-colors">
                → Create a verified profile for priority rescue
              </button>
            </div>
          )}
        </GlassCard>

        {/* ── 2. My QR Code — verified users only ─────────────────────── */}
        {!isGuest && (
          <CardAccordion title="My QR Code" icon={QrCode} iconColor="text-[#00d4ff]">
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Your personal QR code is used to record your arrival and departure at evacuation centers.
            </p>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-white font-medium">Show QR Code</p>
              <button
                onClick={() => setShowQR(v => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showQR ? 'bg-[#00d4ff]' : 'bg-slate-700'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showQR ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {showQR && (
              <div className="flex flex-col items-center gap-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                {qrValue ? (
                  <>
                    <div
                      className="p-3 bg-white rounded-xl cursor-zoom-in select-none"
                      onDoubleClick={() => setQrExpanded(true)}
                      title="Double-click to expand"
                    >
                      <QRCodeSVG value={qrValue} size={180} level="M" includeMargin={false} />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center">Show this QR to center personnel for check-in/check-out</p>
                    <p className="text-[10px] text-slate-500 text-center font-medium">ID: {user?.victim_id ?? user?.id}</p>
                    <p className="text-[10px] text-slate-600 text-center">Double-tap to expand</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2">QR unavailable — please re-verify your account</p>
                )}
              </div>
            )}
          </CardAccordion>
        )}

        {/* ── 3. Personal Information ──────────────────────────────────── */}
        <CardAccordion title="Personal Information" icon={User} iconColor="text-[#22c55e]">
          <InfoRow label="Victim ID"            value={user?.victim_id} />
          <InfoRow label="Full Name"            value={user?.name} />
          <InfoRow label="Contact Number"       value={user?.contact_number} />
          <InfoRow label="Purok / Zone"         value={user?.sitio} />
          <InfoRow label="Barangay"             value={user?.barangay} />
          <InfoRow label="Municipality"         value={user?.municipality} />
          <InfoRow label="Emergency Contact"    value={user?.emergency_contact_name} />
          <InfoRow label="Emergency No."        value={user?.emergency_contact_number} />
          <InfoRow label="Relationship"         value={user?.emergency_contact_relationship} />
        </CardAccordion>

        {/* ── 4. Account & Preferences ─────────────────────────────────── */}
        <CardAccordion title="Account & Preferences" icon={Shield} iconColor="text-[#8b5cf6]">

          {/* Security & Privacy */}
          <RowAccordion title="Security & Privacy" icon={Lock} iconColor="text-slate-400">

            {/* Change PIN */}
            <RowAccordion title="Change PIN" icon={Lock} iconColor="text-slate-500">
              <form onSubmit={handlePinSave} className="space-y-3 mt-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5">Current PIN</label>
                  <input
                    type="password"
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value)}
                    placeholder="Enter current PIN"
                    autoComplete="current-password"
                    className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5">New PIN</label>
                  <input
                    type="password"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value)}
                    placeholder="At least 4 digits"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5">Confirm New PIN</label>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value)}
                    placeholder="Re-enter new PIN"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)] transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  {pinMsg ? (
                    <div className={`flex items-center gap-1.5 text-xs ${pinMsg.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {pinMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                      {pinMsg.text}
                    </div>
                  ) : <span />}
                  <button
                    type="submit"
                    disabled={pinSaving || !currentPin || !newPin || !confirmPin}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[rgba(0,212,255,0.12)] border border-[rgba(0,212,255,0.3)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.2)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {pinSaving && <Loader size={11} className="animate-spin" />}
                    Change PIN
                  </button>
                </div>
              </form>
            </RowAccordion>

            {/* Local Server */}
            <RowAccordion title="Local Server" icon={Server} iconColor="text-slate-500">
              <p className="text-xs text-slate-400 leading-relaxed mb-3 mt-2">
                When offline, SOS messages are sent to the admin's local XAMPP server over Wi-Fi.
                Enter the IP address of the admin device's hotspot (default: 192.168.43.1).
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
            <RowAccordion title="Appearance" icon={Sun} iconColor="text-[#f59e0b]">
              <Toggle
                on={theme === 'light'}
                onToggle={toggleTheme}
                label="Light Mode"
                sub="Switch to a brighter, easier-to-read interface"
              />
            </RowAccordion>
          </RowAccordion>

        </CardAccordion>

        {/* ── 5. Support & Information ─────────────────────────────────── */}
        <CardAccordion title="Support & Information" icon={Info} iconColor="text-[#f59e0b]">

          <RowAccordion title="Help & Support" icon={HelpCircle} iconColor="text-slate-400">
            <div className="space-y-2 mt-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                For assistance, contact your local Barangay DRRM Officer or Municipal DRRM Office.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                In case of emergency, tap <span className="text-[#ef4444] font-semibold">SOS</span> on the main navigation to send a distress signal.
              </p>
            </div>
          </RowAccordion>

          <RowAccordion title="Terms & Privacy Policy" icon={FileText} iconColor="text-slate-400">
            <div className="space-y-2 mt-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                All SOS data is stored locally until synced. Your profile is only shared with DRRM officers in your municipality during emergencies.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                No data is sold or shared with third parties. Data is used exclusively for disaster response coordination.
              </p>
            </div>
          </RowAccordion>

          <RowAccordion title="About SurvAIve PH" icon={Info} iconColor="text-slate-400">
            <div className="space-y-2 mt-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-white font-semibold">SurvAIve PH</span> is an AI-powered mesh-network emergency response system built for the Philippines.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Features include real-time SOS reporting, offline mesh communication, smart evacuation center recommendations, and QR-based occupancy tracking.
              </p>
              <p className="text-xs text-slate-500">Version 3.0 · 2024</p>
            </div>
          </RowAccordion>

        </CardAccordion>

        {/* ── Sign Out ─────────────────────────────────────────────────── */}
        <NeonButton variant="ghost" onClick={handleLogout} className="w-full">
          {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
        </NeonButton>

        <p className="text-center text-[10px] text-slate-600">SurvAIve PH</p>
      </main>

      <MobileNavBar items={NAV} />

      {/* Full-screen QR overlay — outside main so overflow:hidden doesn't clip it */}
      {qrExpanded && qrValue && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          onDoubleClick={() => setQrExpanded(false)}
        >
          <div className="flex flex-col items-center gap-5 select-none">
            <div className="flex items-center gap-2 mb-1">
              <QrCode size={16} className="text-[#00d4ff]" />
              <p className="text-sm font-semibold text-white/80">My QR Code</p>
            </div>
            <div className="p-5 bg-white rounded-2xl shadow-[0_0_40px_rgba(0,212,255,0.3)]">
              <QRCodeSVG value={qrValue} size={260} level="M" includeMargin={false} />
            </div>
            <p className="text-sm font-semibold text-white/80">{user?.name}</p>
            <p className="text-xs text-white/40">Victim ID: {user?.victim_id ?? user?.id}</p>
            <p className="text-xs text-white/50 text-center px-6 leading-relaxed">
              Show this QR to center personnel for check-in/check-out
            </p>
            <p className="text-[11px] text-white/30">Double-tap to close</p>
          </div>
        </div>
      )}
    </div>
  )
}
