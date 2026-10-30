import { useState } from 'react'
import { User, Lock, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { localFetch, logActivity } from '../lib/api'
import { supabase } from '../lib/supabase'
import { getNetworkOnline } from '../lib/capacitor'
import { useAuthStore } from '../store/auth'
import { GlassCard } from './ui/GlassCard'

// ── AccountSettings ────────────────────────────────────────────────────────────
// Embedded in each role's Settings page. Allows the logged-in user to update
// their display name and change their password (or PIN for victims).
// All updates go through the PHP /profile endpoint (MySQL), so they work
// offline. For online staff, password changes are also synced to Supabase Auth.

export function AccountSettings() {
  const { user, role, updateUser } = useAuthStore()
  const isVictim = role === 'victim'
  const credLabel = isVictim ? 'PIN' : 'Password'

  // ── Name form state ──
  const [name, setName]           = useState(user?.name ?? '')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg]     = useState(null) // { ok: bool, text: string }

  // ── Password form state ──
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [pwSaving, setPwSaving]     = useState(false)
  const [pwMsg, setPwMsg]           = useState(null)

  // ── Save display name ──
  async function handleNameSave(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === user?.name) return
    setNameSaving(true)
    setNameMsg(null)
    try {
      if (getNetworkOnline()) {
        const ROLE_TABLE = { admin: 'admins', responder: 'responders', response_agency: 'response_agencies', victim: 'victims' }
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

  // ── Change password / PIN ──
  async function handlePasswordSave(e) {
    e.preventDefault()
    if (!currentPw || !newPw) return

    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: `${credLabel}s do not match.` })
      return
    }
    const minLen = isVictim ? 4 : 8
    if (newPw.length < minLen) {
      setPwMsg({ ok: false, text: `${credLabel} must be at least ${minLen} characters.` })
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
        // XAMPP succeeded: sync to Supabase Auth for online staff
        if (!isVictim && getNetworkOnline()) {
          const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }))
          if (session) supabase.auth.updateUser({ password: newPw }).catch(() => {})
        }
      } catch (localErr) {
        // Network error (XAMPP unreachable) + online + not victim → Supabase Auth fallback
        if (!localErr.status && !isVictim && getNetworkOnline()) {
          const { error: updErr } = await supabase.auth.updateUser({ password: newPw })
          if (updErr) throw new Error(updErr.message ?? 'Failed to change password.')
        } else {
          throw localErr
        }
      }

      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwMsg({ ok: true, text: `${credLabel} changed successfully.` })
    } catch (err) {
      setPwMsg({ ok: false, text: err?.message ?? `Failed to change ${credLabel.toLowerCase()}.` })
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <User size={16} className="text-[#ef4444]" />
        <h2 className="text-sm font-black text-white uppercase tracking-wider">Account Settings</h2>
      </div>

      {/* ── Display Name ─────────────────────────────────────────────────── */}
      <GlassCard>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Display Name</p>
        <form onSubmit={handleNameSave} className="space-y-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(239,68,68,0.4)] transition-colors"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            {nameMsg ? (
              <div className={`flex items-center gap-1.5 text-xs ${nameMsg.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {nameMsg.ok
                  ? <CheckCircle size={13} />
                  : <AlertCircle size={13} />}
                {nameMsg.text}
              </div>
            ) : <span />}
            <button
              type="submit"
              disabled={nameSaving || !name.trim() || name.trim() === user?.name}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {nameSaving && <Loader size={11} className="animate-spin" />}
              Save Name
            </button>
          </div>
        </form>
      </GlassCard>

      {/* ── Change Password / PIN ─────────────────────────────────────────── */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={13} className="text-slate-400" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Change {credLabel}</p>
        </div>
        <form onSubmit={handlePasswordSave} className="space-y-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5">Current {credLabel}</label>
            <input
              type="password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              placeholder={`Enter current ${credLabel.toLowerCase()}`}
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(239,68,68,0.4)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5">New {credLabel}</label>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder={isVictim ? 'At least 4 digits' : 'At least 8 characters'}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(239,68,68,0.4)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5">Confirm New {credLabel}</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder={`Re-enter new ${credLabel.toLowerCase()}`}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(239,68,68,0.4)] transition-colors"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            {pwMsg ? (
              <div className={`flex items-center gap-1.5 text-xs ${pwMsg.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {pwMsg.ok
                  ? <CheckCircle size={13} />
                  : <AlertCircle size={13} />}
                {pwMsg.text}
              </div>
            ) : <span />}
            <button
              type="submit"
              disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pwSaving && <Loader size={11} className="animate-spin" />}
              Change {credLabel}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
