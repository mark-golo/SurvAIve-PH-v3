import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, MapPin, UserCheck, Flag, RefreshCw, ChevronUp, ChevronDown, Trash2, XCircle } from 'lucide-react'

import { StatusBadge } from '../../components/ui/StatusBadge'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput, GlassSelect } from '../../components/ui/GlassInput'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { getBarangays } from '../../lib/philippineLocations'

const RESCUE_LABEL = { pending: 'Pending', en_route: 'En Route', on_scene: 'On Scene', rescued: 'Rescued', cannot_reach: 'Cannot Reach' }

export function VictimTable() {
  const navigate = useNavigate()
  const { scope } = useAuthStore()
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [barangayFilter, setBarangayFilter] = useState('all')
  const [sortBy, setSortBy] = useState('time')
  const [loading, setLoading] = useState(true)
  const [confirmRemoveId, setConfirmRemoveId] = useState(null)  // UI-only remove confirmation

  const muni = scope?.municipality

  // Shared fetch — called on mount, and when a new SOS INSERT arrives via realtime
  const load = useCallback(() => {
    api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
      .then(rows => setData(rows.map(r => ({
        id:             r.id,
        name:           r.name ?? 'Guest',
        status:         r.status,
        barangay:       r.barangay,
        timestamp:      r.time_ago,
        score:          r.ai_priority_score,
        priority:       r.priority,
        verified:       !!r.is_verified,
        rescue:         r.rescue_status,
        sos_mode:       r.sos_mode ?? 'status',
        ai_scene_label: r.ai_scene_label ?? null,
        lat:            r.lat ?? null,
        lng:            r.lng ?? null,
        dismissed:      r.dismissed ?? false,
        minutes_ago:    r.minutes_ago ?? 0,
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [muni])

  // Realtime: patch rescue_status on UPDATE; re-fetch full list on INSERT
  useEffect(() => {
    const ch = supabase.channel('vt-sos-status')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_reports' },
        payload => {
          const r = payload.new
          if (muni && r.municipality !== muni) return
          setData(d => d.map(x => x.id === r.id ? { ...x, rescue: r.rescue_status } : x))
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_reports' },
        payload => {
          const r = payload.new
          if (muni && r.municipality !== muni) return
          load() // re-fetch to get RPC-computed name, priority, minutes_ago, is_verified
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Initial load — and re-load if municipality changes
  useEffect(() => { load() }, [load])

  const PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 }

  const COLUMNS = [
    { label: 'Name',     sortKey: null },
    { label: 'Status',   sortKey: 'priority' },
    { label: 'Barangay', sortKey: 'barangay' },
    { label: 'Time',     sortKey: 'time' },
    { label: 'AI Score', sortKey: 'score' },
    { label: 'Verified', sortKey: null },
    { label: 'Rescue',   sortKey: null },
    { label: 'Actions',  sortKey: null },
  ]

  const displayed = data
    .filter(r => {
      if (barangayFilter !== 'all' && r.barangay !== barangayFilter) return false
      if (search) return r.name.toLowerCase().includes(search.toLowerCase()) || r.barangay.toLowerCase().includes(search.toLowerCase())
      if (filter === 'dismissed') return r.dismissed
      if (filter === 'critical') return !r.dismissed && r.priority === 'CRITICAL'
      if (filter === 'verified') return !r.dismissed && r.verified
      if (filter === 'guest')    return !r.dismissed && !r.verified
      return !r.dismissed   // default: hide dismissed rows from all active views
    })
    .sort((a, b) => {
      if (sortBy === 'score')    return b.score - a.score
      if (sortBy === 'priority') return (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
      if (sortBy === 'barangay') return (a.barangay ?? '').localeCompare(b.barangay ?? '')
      return a.minutes_ago - b.minutes_ago   // 'time' default — latest first
    })

  const markRescued = async (id) => {
    try { await api.put(`/sos/${id}`, { rescue_status: 'rescued' }) } catch {}
    setData(d => d.map(r => r.id === id ? { ...r, rescue: 'rescued' } : r))
  }

  const flagSuspicious = (id) => {
    setData(d => d.map(r => r.id === id ? { ...r, flagged: true, score: Math.max(0, r.score - 20) } : r))
  }

  const dismissSOS = (id) => {
    setData(d => d.map(r => r.id === id ? { ...r, dismissed: true } : r))
    api.put(`/sos/${id}`, { dismissed: true }).catch(() => {})
  }

  // Remove a row from the UI only — no database call; record stays intact for reporting
  const removeFromUI = (id) => {
    setData(d => d.filter(r => r.id !== id))
    setConfirmRemoveId(null)
  }

  // Navigate to Command Center and fly to this victim's pin
  const viewOnMap = (r) => {
    if (!r.lat || !r.lng) return
    sessionStorage.setItem('cc-focus-sos', JSON.stringify({ lat: r.lat, lng: r.lng, id: r.id }))
    navigate('/admin')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading reports…</div>
  )

  return (
    <>
    <div className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <GlassInput
              placeholder="Search name or barangay…"
              icon={Search}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <GlassSelect value={barangayFilter} onChange={e => setBarangayFilter(e.target.value)} className="w-44">
            <option value="all">All Barangays</option>
            {getBarangays(muni).map(b => <option key={b} value={b}>{b}</option>)}
          </GlassSelect>
          <div className="flex gap-2 flex-wrap">
            {['all', 'critical', 'verified', 'guest', 'dismissed'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${
                  filter === f
                    ? 'bg-[rgba(0,212,255,0.15)] border-[rgba(0,212,255,0.5)] text-[#00d4ff]'
                    : 'glass border-[rgba(255,255,255,0.08)] text-slate-400'
                }`}>{f}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  {COLUMNS.map(({ label, sortKey }) => (
                    <th key={label}
                      onClick={() => sortKey && setSortBy(sortKey)}
                      className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap select-none
                        ${sortKey ? 'cursor-pointer hover:text-[#00d4ff] transition-colors' : ''}
                        ${sortBy === sortKey ? 'text-[#00d4ff]' : 'text-slate-500'}`}>
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortKey && sortBy === sortKey && (
                          label === 'Barangay'
                            ? <ChevronUp size={10} />
                            : <ChevronDown size={10} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, i) => (
                  <tr key={r.id}
                    className={`border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${
                      r.flagged ? 'opacity-50' : ''
                    }`}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{r.name}</p>
                      {r.flagged && <span className="text-[10px] text-[#ef4444] block">⚑ Flagged</span>}
                      {r.sos_mode === 'photo' && r.ai_scene_label && (
                        <span className="text-[10px] text-violet-400 block">
                          📷 {r.ai_scene_label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.priority} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.barangay}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.timestamp}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-black ${
                        r.score >= 80 ? 'text-[#ef4444]' : r.score >= 60 ? 'text-[#f97316]' : r.score >= 40 ? 'text-[#f59e0b]' : 'text-[#22c55e]'
                      }`}>{r.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.verified
                        ? <span className="text-[11px] text-[#00d4ff] font-medium">Verified</span>
                        : <span className="text-[11px] text-[#f59e0b] font-medium">Guest</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        r.rescue === 'rescued'  ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)] text-[#22c55e]' :
                        r.rescue === 'en_route' ? 'bg-[rgba(0,212,255,0.1)] border-[rgba(0,212,255,0.3)] text-[#00d4ff]' :
                        'bg-[rgba(107,114,128,0.1)] border-[rgba(107,114,128,0.3)] text-[#9ca3af]'
                      }`}>{RESCUE_LABEL[r.rescue]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => markRescued(r.id)} title="Mark Rescued"
                          className="p-1.5 rounded-lg hover:bg-[rgba(34,197,94,0.2)] text-slate-500 hover:text-[#22c55e] transition-all">
                          <UserCheck size={13} />
                        </button>
                        <button onClick={() => flagSuspicious(r.id)} title="Flag Suspicious"
                          className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.2)] text-slate-500 hover:text-[#ef4444] transition-all">
                          <Flag size={13} />
                        </button>
                        <button
                          onClick={() => viewOnMap(r)}
                          title={r.lat && r.lng ? 'View on Map' : 'No GPS coordinates'}
                          disabled={!r.lat || !r.lng}
                          className={`p-1.5 rounded-lg transition-all ${
                            r.lat && r.lng
                              ? 'hover:bg-[rgba(0,212,255,0.2)] text-slate-500 hover:text-[#00d4ff] cursor-pointer'
                              : 'text-slate-700 cursor-not-allowed opacity-40'
                          }`}>
                          <MapPin size={13} />
                        </button>
                        <button
                          onClick={() => dismissSOS(r.id)}
                          title="Dismiss"
                          className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.15)] text-slate-500 hover:text-[#ef4444] transition-all">
                          <Trash2 size={13} />
                        </button>
                        {/* Remove from UI — only visible in the Dismissed tab */}
                        {filter === 'dismissed' && (
                          <button
                            onClick={() => setConfirmRemoveId(r.id)}
                            title="Remove from view"
                            className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.15)] text-[#ef4444] hover:text-white transition-all">
                            <XCircle size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-600 text-right">{displayed.length} records</p>
      </div>

      {/* ── Remove-from-UI confirmation modal ─────────────────────────────── */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl border border-[rgba(239,68,68,0.3)] p-6 w-80 shadow-2xl">
            <p className="text-sm font-bold text-white mb-1">Remove from view?</p>
            <p className="text-xs text-slate-400 mb-5">
              This will only hide the record from the interface. The SOS data remains in the database for reporting purposes.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => removeFromUI(confirmRemoveId)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white hover:opacity-90 transition-all"
              >
                Yes, Remove
              </button>
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-[rgba(255,255,255,0.1)] hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
