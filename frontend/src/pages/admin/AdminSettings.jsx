import { useState } from 'react'
import {
  User, Lock, Bell, Volume2, Eye, Sun, Zap, VolumeX,
  ChevronDown, CheckCircle, AlertCircle, Loader, HelpCircle,
} from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { useAlertStore } from '../../store/alertStore'
import { useAuthStore } from '../../store/auth'
import { getAdminTheme } from '../../lib/victimTheme'
import { localFetch, logActivity } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { getNetworkOnline } from '../../lib/capacitor'

// ── Reusable sub-components ───────────────────────────────────────────────────

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

function ToggleRow({ icon: Icon, label, description, enabled, onToggle, color = '#ef4444' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          {description && <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 ${
          enabled
            ? 'bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.4)] text-[#ef4444]'
            : 'text-slate-500 border-[rgba(255,255,255,0.12)] hover:text-slate-300'
        }`}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminSettings() {
  const { user, role, updateUser } = useAuthStore()

  // ── Alert store ──
  const {
    soundEnabled,        toggleSound,
    visualEnabled,       toggleVisual,
    notificationEnabled, toggleNotification,
    volume,              setVolume,
  } = useAlertStore()

  const handleTest = () => window.__triggerTestAlert?.()
  const handleMute = () => window.__muteCurrentAlert?.()

  // ── Theme ──
  const [theme, setThemeState] = useState(() => getAdminTheme())
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    window.__setAdminTheme?.(next)
  }

  // ── Name form ──
  const [name,       setName]       = useState(user?.name ?? '')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg,    setNameMsg]    = useState(null)

  async function handleNameSave(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === user?.name) return
    setNameSaving(true)
    setNameMsg(null)
    try {
      if (getNetworkOnline()) {
        const ROLE_TABLE = { admin: 'admins', responder: 'responders', response_agency: 'response_agencies' }
        const { error: pe } = await supabase.from('profiles').update({ name: trimmed }).eq('id', user.id)
        if (pe) throw new Error(pe.message ?? 'Failed to update name.')
        const tbl = ROLE_TABLE[role]
        if (tbl) void supabase.from(tbl).update({ name: trimmed }).eq('id', user.id)
        localFetch('profile', { method: 'PUT', body: JSON.stringify({ name: trimmed }) }).catch(() => {})
      } else {
        await localFetch('profile', { method: 'PUT', body: JSON.stringify({ name: trimmed }) })
      }
      updateUser({ name: trimmed })
      logActivity('PUT', 'profiles', 'profiles', user?.id, { field_changed: 'display_name', new_name: trimmed })
      setNameMsg({ ok: true, text: 'Name updated successfully.' })
    } catch (err) {
      setNameMsg({ ok: false, text: err?.message ?? 'Failed to update name.' })
    } finally {
      setNameSaving(false)
    }
  }

  // ── Password form ──
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving,  setPwSaving]  = useState(false)
  const [pwMsg,     setPwMsg]     = useState(null)

  async function handlePasswordSave(e) {
    e.preventDefault()
    if (!currentPw || !newPw) return
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: 'Passwords do not match.' })
      return
    }
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' })
      return
    }
    setPwSaving(true)
    setPwMsg(null)
    try {
      try {
        await localFetch('profile', {
          method: 'PUT',
          body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
        })
        if (getNetworkOnline()) {
          const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }))
          if (session) supabase.auth.updateUser({ password: newPw }).catch(() => {})
        }
      } catch (localErr) {
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

  // ── Role label ──
  const roleLabel = role === 'response_agency'
    ? `Response Agency${user?.agency_type ? ` · ${user.agency_type.toUpperCase()}` : ''}`
    : 'Admin'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-3">

      {/* ── Profile Card ─────────────────────────────────────────────────── */}
      <GlassCard>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)]">
            <span className="text-lg font-black text-[#ef4444]">
              {(user?.name ?? 'A')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{user?.name ?? '—'}</p>
            <p className="text-[10px] font-semibold text-[#ef4444] uppercase tracking-wider mt-0.5">
              {roleLabel}
            </p>
            {(user?.municipality || user?.province) && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {[user.municipality, user.province].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[#22c55e]">
            Active
          </span>
        </div>
      </GlassCard>

      {/* ── Account & Security ───────────────────────────────────────────── */}
      <CardAccordion title="Account & Security" icon={User} iconColor="text-[#00d4ff]" defaultOpen>

        <RowAccordion title="Display Name" icon={User} iconColor="text-[#00d4ff]" defaultOpen>
          <form onSubmit={handleNameSave} className="space-y-3 mt-1">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">Full Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter your display name" maxLength={200}
                className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)] transition-colors"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              {nameMsg ? (
                <div className={`flex items-center gap-1.5 text-xs ${nameMsg.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {nameMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {nameMsg.text}
                </div>
              ) : <span />}
              <button type="submit"
                disabled={nameSaving || !name.trim() || name.trim() === user?.name}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#00d4ff] to-[#0ea5e9] text-white hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {nameSaving && <Loader size={11} className="animate-spin" />}
                Save Name
              </button>
            </div>
          </form>
        </RowAccordion>

        <RowAccordion title="Change Password" icon={Lock}>
          <form onSubmit={handlePasswordSave} className="space-y-3 mt-1">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">Current Password</label>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                placeholder="Enter current password" autoComplete="current-password"
                className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(239,68,68,0.4)] transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">New Password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="At least 8 characters" autoComplete="new-password"
                className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(239,68,68,0.4)] transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password" autoComplete="new-password"
                className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(239,68,68,0.4)] transition-colors" />
            </div>
            <div className="flex items-center justify-between gap-3">
              {pwMsg ? (
                <div className={`flex items-center gap-1.5 text-xs ${pwMsg.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {pwMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {pwMsg.text}
                </div>
              ) : <span />}
              <button type="submit"
                disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pwSaving && <Loader size={11} className="animate-spin" />}
                Change Password
              </button>
            </div>
          </form>
        </RowAccordion>

      </CardAccordion>

      {/* ── Emergency Alerts ─────────────────────────────────────────────── */}
      <CardAccordion title="Emergency Alerts" icon={Bell} iconColor="text-[#ef4444]" defaultOpen>

        <ToggleRow icon={Volume2} label="Emergency Sound"
          description="Play an audio alarm when a new SOS is received"
          enabled={soundEnabled} onToggle={toggleSound} />
        <ToggleRow icon={Eye} label="Visual SOS Alert"
          description="Red screen pulse overlay when a new SOS arrives"
          enabled={visualEnabled} onToggle={toggleVisual} />
        <ToggleRow icon={Bell} label="Notification Alert"
          description="Show a notification card in the top-right corner"
          enabled={notificationEnabled} onToggle={toggleNotification} />

        <RowAccordion title="Alert Volume" icon={Volume2}
          iconColor={soundEnabled ? 'text-[#ef4444]' : 'text-slate-600'}>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Volume</span>
              <span className="text-xs font-bold text-slate-400">{Math.round(volume * 100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={volume}
              disabled={!soundEnabled}
              onChange={e => setVolume(+e.target.value)}
              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer transition-opacity ${soundEnabled ? 'opacity-100' : 'opacity-30 cursor-not-allowed'}`}
              style={{ background: `linear-gradient(to right, #ef4444 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)` }}
            />
            {!soundEnabled && (
              <p className="text-[10px] text-slate-600">Enable Emergency Sound to adjust volume</p>
            )}
          </div>
        </RowAccordion>

        <RowAccordion title="Alert Controls" icon={Zap} iconColor="text-[#ef4444]">
          <div className="mt-2 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-white">Test Emergency Alert</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Simulate the full visual and audio alert without creating an SOS record</p>
              </div>
              <button onClick={handleTest}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white hover:opacity-90 transition-all">
                Test
              </button>
            </div>
            <div className="h-px bg-[rgba(255,255,255,0.05)]" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-white">Mute Current Alert</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Stop active audio and visual pulse immediately</p>
              </div>
              <button onClick={handleMute}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-[rgba(255,255,255,0.1)] hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all">
                <VolumeX size={13} className="inline mr-1" />
                Mute
              </button>
            </div>
          </div>
        </RowAccordion>

      </CardAccordion>

      {/* ── Appearance ───────────────────────────────────────────────────── */}
      <CardAccordion title="Appearance" icon={Sun} iconColor="text-[#f59e0b]">
        <ToggleRow icon={Sun} label="Light Mode"
          description="Switch to a brighter, easier-to-read interface"
          enabled={theme === 'light'} onToggle={toggleTheme} color="#f59e0b" />
      </CardAccordion>

      {/* ── Support & Information ────────────────────────────────────────── */}
      <CardAccordion title="Support & Information" icon={HelpCircle} iconColor="text-[#f59e0b]">
        <RowAccordion title="About SurvAIve PH" icon={HelpCircle} iconColor="text-[#f59e0b]">
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              SurvAIve PH is an AI-powered emergency response system built for the Philippines. It
              coordinates rescue operations across Admin, Response Agency, and Responder roles.
            </p>
            <p className="text-[11px] text-slate-500">
              Alert settings are saved locally per device. The SOS alert system is active on all
              admin pages while you are logged in.
            </p>
          </div>
        </RowAccordion>
      </CardAccordion>

      <p className="text-[10px] text-slate-600 text-center pb-2">SurvAIve PH — Emergency Response System</p>

    </div>
  )
}
