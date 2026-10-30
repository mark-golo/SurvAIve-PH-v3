import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, WifiOff, ScrollText, Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getNetworkOnline } from '../../lib/capacitor'
import { useAuthStore } from '../../store/auth'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  admin:            'Admin',
  superadmin:       'Super Admin',
  responder:        'Responder',
  response_agency:  'Response Agency',
}

function fmtRole(role) {
  return ROLE_LABELS[role] ?? (role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—')
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function fmtRecord(row) {
  if (!row.target_table) return '—'
  const label = row.target_table.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return row.target_id ? `${label} #${row.target_id}` : label
}

function fmtStatus(s) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '?'
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const daysAgo  = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuditLogs() {
  const { scope } = useAuthStore()
  const [logs,      setLogs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [preset,    setPreset]    = useState('today')
  const [fromDate,  setFromDate]  = useState(todayStr)
  const [toDate,    setToDate]    = useState(todayStr)
  const [isOnline]                = useState(getNetworkOnline)

  function applyPreset(p) {
    setPreset(p)
    const t = todayStr()
    if (p === 'today') { setFromDate(t);          setToDate(t) }
    if (p === '7d')    { setFromDate(daysAgo(7));  setToDate(t) }
    if (p === '30d')   { setFromDate(daysAgo(30)); setToDate(t) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDate)   q = q.lte('created_at', toDate + 'T23:59:59')
      if (roleFilter) q = q.eq('actor_role', roleFilter)

      // Scope admin view to own municipality
      if (scope?.municipality) {
        q = q.eq('details->>municipality', scope.municipality)
      }

      const { data, error } = await q
      if (error) throw error
      setLogs(data ?? [])
    } catch (err) {
      console.error('[AuditLogs] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, roleFilter, scope?.municipality])

  useEffect(() => { if (isOnline) load() }, [load, isOnline])

  const filtered = useMemo(() => {
    if (!search) return logs
    const q = search.toLowerCase()
    return logs.filter(r =>
      (r.details?.actor_name ?? '').toLowerCase().includes(q) ||
      (r.action ?? '').toLowerCase().includes(q) ||
      (r.target_table ?? '').toLowerCase().includes(q)
    )
  }, [logs, search])

  // ── Offline guard ─────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-3 mt-16 text-slate-500">
        <WifiOff size={32} />
        <p className="text-sm">Audit Logs are only available when online.</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">

      {/* Controls */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <SlidersHorizontal size={13} />
          <span>Filters</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search user or action…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[rgba(255,255,255,0.2)]"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl glass border border-[rgba(255,255,255,0.08)] text-sm text-slate-200 focus:outline-none focus:border-[rgba(255,255,255,0.2)]"
          >
            <option value=""                  className="bg-[#1e293b] text-white">All Roles</option>
            <option value="admin"             className="bg-[#1e293b] text-white">Admin</option>
            <option value="superadmin"        className="bg-[#1e293b] text-white">Super Admin</option>
            <option value="responder"         className="bg-[#1e293b] text-white">Responder</option>
            <option value="response_agency"   className="bg-[#1e293b] text-white">Response Agency</option>
          </select>

          {/* Date preset pills */}
          <div className="flex gap-1">
            {[['today','Today'],['7d','Last 7 Days'],['30d','Last 30 Days'],['custom','Custom']].map(([p, lbl]) => (
              <button key={p} onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  preset === p
                    ? 'bg-[rgba(239,68,68,0.2)] text-[#ef4444] border border-[rgba(239,68,68,0.3)]'
                    : 'text-slate-400 border border-slate-600 hover:text-white'
                }`}>{lbl}</button>
            ))}
          </div>

          {/* Custom date range — shown only when 'custom' is selected */}
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="glass border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-[rgba(239,68,68,0.4)]" />
              <span className="text-slate-500 text-xs">to</span>
              <input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)}
                className="glass border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-[rgba(239,68,68,0.4)]" />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                {['Date & Time', 'User', 'Role / Agency', 'Action Performed', 'Affected Record', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Loading audit records…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <ScrollText size={24} className="opacity-40" />
                      <span className="text-sm">No audit records found</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  {/* Date & Time */}
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(row.created_at)}</td>

                  {/* User */}
                  <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap">
                    {row.details?.actor_name ?? <span className="text-slate-500 text-xs">Unknown</span>}
                  </td>

                  {/* Role / Agency */}
                  <td className="px-4 py-3">
                    <RoleBadge role={row.actor_role} />
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-sm text-slate-200">{row.action}</td>

                  {/* Affected record */}
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap font-mono">{fmtRecord(row)}</td>

                  {/* Details */}
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <div className="flex flex-col gap-1">
                      {/* Rescue status change */}
                      {row.details?.new_rescue_status && (
                        <span className="text-[10px] text-slate-300 whitespace-nowrap">
                          {row.details.old_rescue_status
                            ? <><span className="text-slate-500">{fmtStatus(row.details.old_rescue_status)}</span>{' → '}<span className="text-[#22c55e] font-semibold">{fmtStatus(row.details.new_rescue_status)}</span></>
                            : <span className="text-[#22c55e] font-semibold">{fmtStatus(row.details.new_rescue_status)}</span>
                          }
                        </span>
                      )}
                      {row.details?.confirmed_by && (
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          By: <span className="text-slate-200 font-medium">{row.details.confirmed_by}</span>
                        </span>
                      )}
                      {/* Duty status toggle */}
                      {row.details?.duty_status && (
                        <span className="text-[10px] text-slate-300 whitespace-nowrap">
                          {row.details.previous_duty_status && <><span className="text-slate-500">{fmtStatus(row.details.previous_duty_status)}</span>{' → '}</>}
                          <span className={row.details.duty_status === 'on_duty' ? 'text-[#22c55e] font-semibold' : 'text-slate-400 font-semibold'}>{fmtStatus(row.details.duty_status)}</span>
                        </span>
                      )}
                      {/* SOS dismissed */}
                      {row.details?.dismissed && (
                        <span className="text-[10px] text-amber-400 font-semibold">Dismissed</span>
                      )}
                      {/* Constituent login toggle */}
                      {row.details?.account_active !== undefined && (
                        <span className={`text-[10px] font-semibold ${row.details.account_active ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          Login {row.details.account_active ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                      {/* Profile name change */}
                      {row.details?.new_name && (
                        <span className="text-[10px] text-slate-300 whitespace-nowrap">
                          Name: <span className="text-white font-medium">{row.details.new_name}</span>
                        </span>
                      )}
                      {/* Staff cloud sync results */}
                      {row.details?.synced_count !== undefined && (
                        <span className="text-[10px] text-slate-300 whitespace-nowrap">
                          Synced: <span className="text-[#22c55e] font-medium">{row.details.synced_count}</span>
                          {' · '}Skipped: <span className="text-slate-400">{row.details.skipped_count ?? 0}</span>
                        </span>
                      )}
                      {/* Municipality badge */}
                      {row.details?.municipality && (
                        <span className="px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-slate-400 self-start">
                          {row.details.municipality}
                        </span>
                      )}
                      {/* Fallback */}
                      {!row.details?.new_rescue_status &&
                       !row.details?.confirmed_by &&
                       !row.details?.duty_status &&
                       !row.details?.dismissed &&
                       row.details?.account_active === undefined &&
                       !row.details?.new_name &&
                       row.details?.synced_count === undefined &&
                       !row.details?.municipality && '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-right">{filtered.length} of {logs.length} records</p>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ROLE_COLORS = {
  admin:           { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  superadmin:      { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  responder:       { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80', border: 'rgba(34,197,94,0.3)'  },
  response_agency: { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
}

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] ?? { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' }
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {fmtRole(role)}
    </span>
  )
}
