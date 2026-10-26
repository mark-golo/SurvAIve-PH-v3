import { useState, useEffect } from 'react'
import { Search, KeyRound } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassInput } from '../../components/ui/GlassInput'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/api'
import { supabase } from '../../lib/supabase'

const ROLE_COLORS = {
  Admin:     { bg: 'rgba(0,212,255,0.12)',   border: 'rgba(0,212,255,0.3)',   text: '#00d4ff'  },
  Agency:    { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  text: '#8b5cf6'  },
  Responder: { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   text: '#22c55e'  },
}

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] ?? ROLE_COLORS.Responder
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
    >
      {role}
    </span>
  )
}

export function LoginCredentials() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    supabase.auth.getSession()
    Promise.all([
      api.get('/admins').catch(() => []),
      api.get('/agencies').catch(() => []),
      api.get('/responders').catch(() => []),
    ]).then(([admins, agencies, responders]) => {
      setRows([
        ...admins.map(r     => ({ ...r, _role: 'Admin',     _loginId: r.contact_number || r.gmail || '—' })),
        ...agencies.map(r   => ({ ...r, _role: 'Agency',    _loginId: r.contact_number || '—' })),
        ...responders.map(r => ({ ...r, _role: 'Responder', _loginId: r.contact_number || r.gmail || '—' })),
      ])
    }).finally(() => setLoading(false))
  }, [])

  const q = search.toLowerCase()
  const filtered = rows.filter(r =>
    !q ||
    (r.name ?? '').toLowerCase().includes(q) ||
    (r._loginId ?? '').toLowerCase().includes(q)
  )

  return (
    <div className="p-4 space-y-4">
      <GlassCard className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <KeyRound size={16} className="text-[#00d4ff]" />
          <h2 className="text-sm font-bold text-white">All Account Credentials</h2>
          <span className="ml-auto text-xs text-slate-500">{filtered.length} account{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <GlassInput
          placeholder="Search by name or contact number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          icon={Search}
          className="mb-4"
        />

        {loading ? (
          <p className="text-xs text-slate-500 text-center py-8">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No accounts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  <th className="text-left py-2 pr-4 text-slate-500 font-semibold">Name</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-semibold">Role</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-semibold">Contact / Login ID</th>
                  <th className="text-left py-2 text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={`${r._role}-${r.id}`}
                    className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                  >
                    <td className="py-2.5 pr-4 text-white font-medium">{r.name || '—'}</td>
                    <td className="py-2.5 pr-4"><RoleBadge role={r._role} /></td>
                    <td className="py-2.5 pr-4 text-slate-300 font-mono">{r._loginId}</td>
                    <td className="py-2.5">
                      <StatusBadge status={(r.status ?? 'active').toUpperCase()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
