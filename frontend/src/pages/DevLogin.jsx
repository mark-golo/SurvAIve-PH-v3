import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'

const ROLES = [
  { role: 'victim',     label: 'Victim (Profiled)', path: '/home',       color: '#00d4ff',  icon: '🆘' },
  { role: 'victim',     label: 'Guest Victim',      path: '/home',       color: '#f59e0b',  icon: '👤', guest: true },
  { role: 'responder',  label: 'Field Responder',   path: '/responder',  color: '#22c55e',  icon: '🚑', contact: '09180000001' },
  { role: 'admin',      label: 'DRRM Admin',        path: '/admin',      color: '#8b5cf6',  icon: '🏛️', contact: '09170000002' },
  { role: 'superadmin', label: 'DOST Super Admin',  path: '/superadmin', color: '#f97316',  icon: '🔭', contact: '09170000001' },
]

export function DevLogin() {
  const navigate = useNavigate()
  const { login, setGuest } = useAuthStore()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')

  const enter = async (r) => {
    if (r.guest) {
      setGuest({ role: 'victim', name: 'Anonymous Guest', mode: 'guest', barangay: 'Del Carmen Poblacion', municipality: 'Del Carmen' })
      navigate(r.path)
      return
    }
    if (r.contact) {
      setLoading(r.label)
      setError('')
      try {
        const res = await api.post('/auth/login', { contact_number: r.contact, password: 'password' })
        login(res.token, res.user)
        navigate(r.path)
        return
      } catch (e) {
        setError(e?.error ?? 'Login failed. Check Supabase credentials.')
      } finally {
        setLoading(null)
      }
    }
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black text-white text-center mb-2">
          Surv<span className="text-[#00d4ff]">AI</span>ve PH
        </h1>
        <p className="text-xs text-slate-500 text-center mb-6">Development Role Selector</p>

        {error && (
          <p className="text-[#ef4444] text-xs text-center mb-4 bg-[rgba(239,68,68,0.1)]
                        border border-[rgba(239,68,68,0.2)] rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {ROLES.map((r, i) => (
            <button key={i} onClick={() => enter(r)} disabled={!!loading}
              className="w-full glass rounded-2xl p-4 flex items-center gap-4 cursor-pointer
                         hover:border-white/20 transition-all text-left border border-[rgba(255,255,255,0.08)]
                         disabled:opacity-50 disabled:cursor-wait">
              <span className="text-2xl">{loading === r.label ? '⏳' : r.icon}</span>
              <div>
                <p className="font-bold text-sm text-white">{r.label}</p>
                <p className="text-xs" style={{ color: r.color }}>
                  {loading === r.label ? 'Signing in…' : `→ ${r.path}`}
                </p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] text-slate-600 mt-6">
          Requires Supabase project with seeded auth users
        </p>
      </div>
    </div>
  )
}
