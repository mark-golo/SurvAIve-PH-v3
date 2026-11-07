import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setXamppHost } from '../../lib/api'
import { QRCodeSVG } from 'qrcode.react'
import { Bell, Shield, LogOut, Phone, User, Radio, ChevronRight, Home, Map, Settings, MessageSquare, Server, Check, Sun, QrCode } from 'lucide-react'
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
  const [showQR, setShowQR]       = useState(false)
  const [qrExpanded, setQrExpanded] = useState(false)

  // XAMPP / local server IP — saved via Capacitor Preferences for native builds
  const [xamppHost,     setXamppHostState] = useState('192.168.43.1')
  const [xamppSaved,    setXamppSaved]     = useState(false)

  // Load persisted XAMPP host on mount (native only)
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
    // Update the runtime cache in api.js immediately
    setXamppHost(trimmed)
    // Persist for next launch (native only)
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key: 'survAIve-xampp-host', value: trimmed })
    } catch { /* web build */ }
    setXamppSaved(true)
    setTimeout(() => setXamppSaved(false), 2000)
  }

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

        {/* QR Code — verified users only */}
        {!isGuest && (
          <GlassCard>
            <div className="flex items-center gap-3 mb-3">
              <QrCode size={16} className="text-[#00d4ff]" />
              <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">My Evacuation QR Code</p>
            </div>
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
            {showQR && (() => {
              // Use victim_id (always set) as the stable identifier; fall back to UUID only
              // if victim_id is unavailable. Never embed null/undefined literally in the QR.
              const qrId = user?.victim_id ?? user?.id
              const qrValue = qrId
                ? `SURVPH:EVACUEE:${qrId}:${encodeURIComponent(user?.name ?? '')}`
                : null
              return (
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
              )
            })()}

            {/* Full-screen QR overlay */}
            {qrExpanded && (() => {
              const qrId = user?.victim_id ?? user?.id
              const qrValue = qrId
                ? `SURVPH:EVACUEE:${qrId}:${encodeURIComponent(user?.name ?? '')}`
                : null
              return qrValue ? (
                <div
                  className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
                  onDoubleClick={() => setQrExpanded(false)}
                >
                  <div className="flex flex-col items-center gap-5 select-none">
                    <div className="flex items-center gap-2 mb-1">
                      <QrCode size={16} className="text-[#00d4ff]" />
                      <p className="text-sm font-semibold text-white/80">My Evacuation QR Code</p>
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
              ) : null
            })()}
          </GlassCard>
        )}

        {/* XAMPP / Local server config */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <Server size={16} className="text-[#00d4ff]" />
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">Local Server (XAMPP)</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            When offline, SOS messages are sent to the admin's local XAMPP server over Wi-Fi.
            Enter the IP address of the admin device's hotspot (default: 192.168.43.1).
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
