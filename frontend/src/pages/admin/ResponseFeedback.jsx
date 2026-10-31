import { useState, useEffect, useCallback, useMemo } from 'react'
import { Star, WifiOff, RefreshCw, SlidersHorizontal, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getNetworkOnline } from '../../lib/capacitor'
import { useAuthStore } from '../../store/auth'
import { logActivity } from '../../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StarDisplay({ rating }) {
  if (!rating) return <span className="text-slate-500">—</span>
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star
          key={n} size={12}
          className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
        />
      ))}
      <span className="ml-1 text-xs text-slate-400">{rating}/5</span>
    </span>
  )
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-[#00d4ff]' }) {
  return (
    <div className="glass rounded-2xl p-4 space-y-1">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
        <Icon size={14} />
        {label}
      </div>
      <p className={`text-2xl font-black ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const daysAgo  = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const MOD_STATUS = {
  visible: { label: 'Visible',  bg: 'bg-green-900/40',  text: 'text-green-400' },
  flagged: { label: 'Flagged',  bg: 'bg-amber-900/40',  text: 'text-amber-400' },
  hidden:  { label: 'Hidden',   bg: 'bg-slate-700',     text: 'text-slate-400' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResponseFeedback() {
  const { scope } = useAuthStore()
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('all')   // all | responder | agency
  const [preset,    setPreset]    = useState('30d')
  const [fromDate,  setFromDate]  = useState(() => daysAgo(30))
  const [toDate,    setToDate]    = useState(todayStr)
  const [search,    setSearch]    = useState('')
  const [minRating, setMinRating] = useState('')
  const [isOnline]                = useState(getNetworkOnline)
  const [modLoading, setModLoading] = useState(null)

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
        .from('response_feedback')
        .select(`
          id, sos_id, target_type, target_id, rating, comments,
          display_anonymously, moderation_status, created_at,
          sos:sos_reports ( id, barangay, municipality, created_at, rescue_status ),
          victim:profiles!victim_id ( id, name )
        `)
        .order('created_at', { ascending: false })
        .limit(300)

      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDate)   q = q.lte('created_at', toDate + 'T23:59:59')
      if (minRating) q = q.gte('rating', Number(minRating))
      if (tab !== 'all') q = q.eq('target_type', tab === 'responder' ? 'responder' : 'agency')

      const { data, error } = await q
      if (error) throw error
      setRows(data ?? [])
    } catch (err) {
      console.error('[ResponseFeedback] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, tab, minRating, scope?.municipality])

  useEffect(() => { if (isOnline) load() }, [load, isOnline])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      String(r.sos_id).includes(q) ||
      (r.sos?.barangay ?? '').toLowerCase().includes(q) ||
      (r.victim?.name ?? '').toLowerCase().includes(q) ||
      (r.comments ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  // ── Stats (derived from all rows regardless of search filter) ───────────────
  const stats = useMemo(() => {
    const respRows = rows.filter(r => r.target_type === 'responder')
    const agcRows  = rows.filter(r => r.target_type === 'agency')
    const avgR = respRows.length ? (respRows.reduce((s, r) => s + r.rating, 0) / respRows.length).toFixed(1) : null
    const avgA = agcRows.length  ? (agcRows.reduce((s,  r) => s + r.rating, 0) / agcRows.length).toFixed(1) : null
    const satisfied = rows.filter(r => r.rating >= 4).length
    const satRate = rows.length ? Math.round(satisfied / rows.length * 100) : null
    return { total: rows.length, avgR, avgA, satRate }
  }, [rows])

  // ── Moderation ───────────────────────────────────────────────────────────────
  async function moderate(id, newStatus) {
    setModLoading(id)
    try {
      const { error } = await supabase
        .from('response_feedback')
        .update({ moderation_status: newStatus, moderated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      setRows(prev => prev.map(r => r.id === id ? { ...r, moderation_status: newStatus } : r))
      logActivity('PUT', 'response_feedback', 'response_feedback', id, { moderation_status: newStatus })
    } catch (err) {
      console.error('[ResponseFeedback] moderate failed:', err)
    } finally {
      setModLoading(null)
    }
  }

  // ── Offline guard ─────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-3 mt-16 text-slate-500">
        <WifiOff size={32} />
        <p className="text-sm">Response Feedback is only available when online.</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={MessageSquare} label="Total Feedback"       value={stats.total}  sub="all submitted ratings" />
        <StatCard icon={Star}          label="Avg Responder Rating"  value={stats.avgR ? `${stats.avgR} ★` : '—'} sub="responder ratings" color="text-amber-400" />
        <StatCard icon={Star}          label="Avg Agency Rating"     value={stats.avgA ? `${stats.avgA} ★` : '—'} sub="agency ratings"    color="text-amber-400" />
        <StatCard icon={Star}          label="Satisfaction Rate"     value={stats.satRate != null ? `${stats.satRate}%` : '—'} sub="ratings ≥ 4 stars" color="text-green-400" />
      </div>

      {/* Controls */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <SlidersHorizontal size={13} />
          Filters
        </div>

        {/* Tab row */}
        <div className="flex gap-2">
          {['all','responder','agency'].map(t => (
            <button key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === t
                  ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)]'
                  : 'text-slate-400 hover:text-white border border-transparent hover:bg-[rgba(255,255,255,0.05)]'
              }`}>
              {t === 'all' ? 'All' : t === 'responder' ? 'Responder Feedback' : 'Agency Feedback'}
            </button>
          ))}
        </div>

        {/* Date preset row */}
        <div className="flex gap-2 flex-wrap">
          {[['today','Today'],['7d','Last 7 days'],['30d','Last 30 days']].map(([p, l]) => (
            <button key={p}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                preset === p
                  ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)]'
                  : 'text-slate-400 border border-[rgba(255,255,255,0.08)] hover:text-white'
              }`}>
              {l}
            </button>
          ))}
          <input type="date" value={fromDate} onChange={e => { setPreset('custom'); setFromDate(e.target.value) }}
            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1 text-xs text-slate-300" />
          <span className="text-slate-500 text-xs self-center">–</span>
          <input type="date" value={toDate} onChange={e => { setPreset('custom'); setToDate(e.target.value) }}
            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1 text-xs text-slate-300" />
        </div>

        {/* Search + rating filter */}
        <div className="flex gap-2 flex-wrap">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search SOS ID, barangay, victim, comment…"
            className="flex-1 min-w-[160px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600"
          />
          <select value={minRating} onChange={e => setMinRating(e.target.value)}
            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-2 text-xs text-slate-300">
            <option value="">All ratings</option>
            {[5,4,3,2,1].map(n => <option key={n} value={n}>{n}★ & above</option>)}
          </select>
          <button onClick={load}
            className="px-3 py-2 rounded-lg text-xs text-[#00d4ff] border border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.1)] flex items-center gap-1.5 transition-all">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading feedback…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No feedback records found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)] text-slate-500 uppercase tracking-wider text-[10px]">
                  {['SOS Ref','Incident Date','Victim','Type','Rating','Comments','Moderation','Submitted'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const mod = MOD_STATUS[row.moderation_status] ?? MOD_STATUS.visible
                  return (
                    <tr key={row.id}
                      className={`border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors ${
                        i % 2 === 0 ? '' : 'bg-[rgba(255,255,255,0.01)]'
                      }`}>
                      <td className="px-4 py-3 text-slate-300 font-mono">#{row.sos_id}</td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(row.sos?.created_at)}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.display_anonymously ? (
                          <span className="text-slate-500 italic">Anonymous</span>
                        ) : (
                          row.victim?.name ?? '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          row.target_type === 'responder'
                            ? 'bg-blue-900/40 text-blue-400'
                            : 'bg-violet-900/40 text-violet-400'
                        }`}>
                          {row.target_type === 'responder' ? 'Responder' : 'Agency'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StarDisplay rating={row.rating} /></td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate" title={row.comments ?? ''}>
                        {row.comments ?? <span className="text-slate-600 italic">No comment</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${mod.bg} ${mod.text}`}>
                            {mod.label}
                          </span>
                          <select
                            value={row.moderation_status}
                            disabled={modLoading === row.id}
                            onChange={e => moderate(row.id, e.target.value)}
                            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded text-[10px] text-slate-400 px-1 py-0.5">
                            <option value="visible">Visible</option>
                            <option value="flagged">Flag</option>
                            <option value="hidden">Hide</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-600 text-center pb-2">
        {filtered.length} record{filtered.length !== 1 ? 's' : ''} shown
        {rows.length !== filtered.length ? ` (${rows.length} total)` : ''}
      </p>
    </div>
  )
}
