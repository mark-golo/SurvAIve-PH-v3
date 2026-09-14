import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ZAxis,
  LineChart, Line,
} from 'recharts'
import {
  Layers, RefreshCw, Printer, Search, ChevronUp, ChevronDown,
  AlertTriangle, CheckCircle, Clock, Users, Activity,
  TrendingUp, TrendingDown, Shield, HelpCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

/* ─── helpers ─── */
const todayStr = () => new Date().toISOString().slice(0, 10)
const daysAgo  = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

function rateColor(rate) {
  if (rate >= 80) return { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e' }
  if (rate >= 60) return { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' }
  return              { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' }
}

function hrsColor(hrs) {
  if (hrs <= 24) return '#22c55e'
  if (hrs <= 48) return '#f59e0b'
  return '#ef4444'
}

function priorityLabel(score) {
  if (score >= 15) return 'CRITICAL'
  if (score >= 8)  return 'HIGH'
  if (score >= 3)  return 'MODERATE'
  return 'LOW'
}

function priorityColor(p) {
  return { CRITICAL:'#ef4444', HIGH:'#f97316', MODERATE:'#f59e0b', LOW:'#22c55e' }[p] ?? '#64748b'
}

function priorityReason(p) {
  return {
    CRITICAL: 'High critical cases + low resolution rate',
    HIGH:     'Significant pending cases + unresolved reports',
    MODERATE: 'Moderate risk — needs ongoing monitoring',
    LOW:      'Performing within acceptable range',
  }[p]
}

/* ─── print ─── */
function printReport(muni, fromDate, toDate, summary, brgyRows, insights) {
  const w = window.open('', '_blank')
  if (!w) return
  const rateStyle = r => r >= 80 ? 'color:#16a34a' : r >= 60 ? 'color:#d97706' : 'color:#dc2626'
  const rowsHtml = brgyRows.map((r, i) => `
    <tr style="background:${i%2===0?'#f9fafb':'#fff'}">
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:600">${r.name}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center">${r.affected}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;color:#16a34a">${r.safe}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;color:#dc2626">${r.notSafe}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;${r.critical>0?'color:#dc2626;font-weight:700':'color:#374151'}">${r.critical}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center">${r.assistance}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center">${r.resolved}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center">${r.pending}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center">${r.avgHours}h</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;${rateStyle(r.resolutionRate)};font-weight:600">${r.resolutionRate}%</td>
    </tr>`).join('')

  w.document.write(`<!DOCTYPE html><html><head>
    <title>Barangays Comparison Report</title>
    <style>
      body{font-family:Arial,sans-serif;margin:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      .sub{font-size:12px;color:#555;margin-bottom:16px}
      .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px}
      .card{border:1px solid #e5e7eb;border-radius:6px;padding:10px;text-align:center}
      .card-val{font-size:22px;font-weight:700;margin:4px 0}
      .card-lbl{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.05em}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-top:12px}
      th{background:#0284c7;color:#fff;padding:7px 8px;text-align:left;border:1px solid #0369a1}
      .insight{background:#f3f4f6;border-left:4px solid #0284c7;padding:10px 14px;margin-top:16px;border-radius:4px;font-size:12px;line-height:1.8}
      @media print{body{margin:12px}}
    </style>
  </head><body>
    <h1>BARANGAYS COMPARISON REPORT</h1>
    <div class="sub">Municipality of ${muni} &nbsp;|&nbsp; Period: ${fromDate} to ${toDate} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</div>
    <div class="cards">
      <div class="card"><div class="card-val">${summary.affected}</div><div class="card-lbl">Affected Users</div></div>
      <div class="card"><div class="card-val">${summary.total}</div><div class="card-lbl">Total Reports</div></div>
      <div class="card"><div class="card-val" style="color:#dc2626">${summary.critical}</div><div class="card-lbl">Critical Cases</div></div>
      <div class="card"><div class="card-val" style="color:#16a34a">${summary.safe}</div><div class="card-lbl">Safe</div></div>
      <div class="card"><div class="card-val" style="color:#dc2626">${summary.notSafe}</div><div class="card-lbl">Not Safe</div></div>
      <div class="card"><div class="card-val">${summary.assistance}</div><div class="card-lbl">Assistance Requests</div></div>
      <div class="card"><div class="card-val" style="color:#16a34a">${summary.resolved}</div><div class="card-lbl">Resolved</div></div>
      <div class="card"><div class="card-val" style="color:#d97706">${summary.pending}</div><div class="card-lbl">Pending</div></div>
      <div class="card"><div class="card-val">${summary.avgHrsActive}h</div><div class="card-lbl">Avg Hrs Active</div></div>
      <div class="card"><div class="card-val" style="${rateStyle(summary.resolutionRate)}">${summary.resolutionRate}%</div><div class="card-lbl">Resolution Rate</div></div>
    </div>
    <table>
      <thead><tr>
        <th>Barangay</th><th>Affected</th><th>Safe</th><th>Not Safe</th><th>Critical</th>
        <th>Assistance</th><th>Resolved</th><th>Pending</th><th>Avg Hrs</th><th>Resolution Rate</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="insight"><strong>Key Insights</strong><br>${insights.replace(/\n/g,'<br>')}</div>
    <p style="margin-top:20px;font-size:10px;color:#999">This report is automatically generated by SurvAIve PH v3. Data reflects SOS reports within the selected period.</p>
  </body></html>`)
  w.document.close()
  w.onload = () => w.print()
}

/* ─── component ─── */
export function BarangaysComparison() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality ?? ''

  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [preset, setPreset]       = useState('today')
  const [fromDate, setFromDate]   = useState(todayStr())
  const [toDate, setToDate]       = useState(todayStr())
  const [generatedAt, setGenAt]   = useState(null)
  const [sortKey, setSortKey]     = useState('critical')
  const [sortDir, setSortDir]     = useState('desc')
  const [search, setSearch]       = useState('')
  const [chartMode, setChartMode] = useState('affected')

  /* ─── preset handler ─── */
  function applyPreset(p) {
    setPreset(p)
    const t = todayStr()
    if (p === 'today')  { setFromDate(t);         setToDate(t) }
    if (p === '7d')     { setFromDate(daysAgo(7)); setToDate(t) }
    if (p === '30d')    { setFromDate(daysAgo(30));setToDate(t) }
    // 'custom' — let user pick via inputs
  }

  /* ─── generate ─── */
  const generate = useCallback(async () => {
    if (!muni) return
    setLoading(true)
    try {
      const { data: sosList = [] } = await supabase
        .from('sos_reports')
        .select('id,barangay,rescue_status,ai_priority_score,people_count,special_conditions,created_at')
        .eq('municipality', muni)
        .gte('created_at', fromDate + 'T00:00:00')
        .lte('created_at', toDate   + 'T23:59:59')
        .order('created_at', { ascending: false })

      // aggregate per barangay
      const brgyStats = {}
      sosList.forEach(r => {
        const b = r.barangay ?? 'Unknown'
        if (!brgyStats[b]) brgyStats[b] = {
          total:0, affected:0, critical:0, safe:0, notSafe:0,
          assistance:0, resolved:0, pending:0, cannotReach:0, hoursSum:0,
        }
        const s = brgyStats[b]
        s.total++
        s.affected += r.people_count ?? 1
        if ((r.ai_priority_score ?? 0) >= 80) s.critical++
        if (r.rescue_status === 'rescued') { s.safe++; s.resolved++ }
        else s.notSafe++
        if (r.rescue_status === 'cannot_reach') s.cannotReach++
        if (['pending','en_route','on_scene'].includes(r.rescue_status)) s.pending++
        if ((r.special_conditions ?? '').trim()) s.assistance++
        s.hoursSum += (Date.now() - new Date(r.created_at).getTime()) / 3_600_000
      })

      const brgyRows = Object.entries(brgyStats).map(([name, s]) => ({
        name, ...s,
        avgHours: s.total ? +((s.hoursSum / s.total).toFixed(1)) : 0,
        resolutionRate: s.total ? Math.round(s.resolved / s.total * 100) : 0,
      }))

      setData({ sosList, brgyRows })
      setGenAt(new Date())
    } catch (e) {
      console.error('BarangaysComparison generate error', e)
    } finally {
      setLoading(false)
    }
  }, [muni, fromDate, toDate])

  /* ─── auto-load today on mount ─── */
  useEffect(() => { generate() }, [generate])

  /* ─── derived ─── */
  const { brgyRows = [], summary, ranked, insights } = useMemo(() => {
    if (!data) return {}
    const rows = data.brgyRows

    // municipal totals
    const totAffected  = rows.reduce((a,r) => a + r.affected, 0)
    const totTotal     = rows.reduce((a,r) => a + r.total, 0)
    const totCritical  = rows.reduce((a,r) => a + r.critical, 0)
    const totSafe      = rows.reduce((a,r) => a + r.safe, 0)
    const totNotSafe   = rows.reduce((a,r) => a + r.notSafe, 0)
    const totAssist    = rows.reduce((a,r) => a + r.assistance, 0)
    const totResolved  = rows.reduce((a,r) => a + r.resolved, 0)
    const totPending   = rows.reduce((a,r) => a + r.pending, 0)
    const avgHrsActive = rows.length ? +(rows.reduce((a,r) => a + r.avgHours, 0) / rows.length).toFixed(1) : 0
    const resolutionRate = totTotal ? Math.round(totResolved / totTotal * 100) : 0

    const summary = { affected:totAffected, total:totTotal, critical:totCritical,
      safe:totSafe, notSafe:totNotSafe, assistance:totAssist,
      resolved:totResolved, pending:totPending, avgHrsActive, resolutionRate }

    // priority ranking
    const scored = rows.map(r => {
      const score = r.critical * 3 + r.notSafe * 2 + r.cannotReach * 2 + r.pending
                  + (r.resolutionRate < 60 ? 20 : r.resolutionRate < 80 ? 10 : 0)
      return { ...r, score }
    }).sort((a,b) => b.score - a.score)

    const n = scored.length
    const ranked = scored.map((r, i) => {
      const pct = n > 1 ? i / (n - 1) : 0
      const label = pct <= 0.25 ? 'CRITICAL' : pct <= 0.5 ? 'HIGH' : pct <= 0.75 ? 'MODERATE' : 'LOW'
      return { ...r, priorityLabel: label }
    })

    // key insights
    const byCritical = [...rows].sort((a,b) => b.critical - a.critical)
    const byRate     = [...rows].sort((a,b) => a.resolutionRate - b.resolutionRate)
    const byTotal    = [...rows].sort((a,b) => b.total - a.total)
    const cannotReachCount = rows.filter(r => r.cannotReach > 0).length

    const lines = []
    if (byCritical[0]?.critical > 0)
      lines.push(`• ${byCritical[0].name} has the highest critical cases (${byCritical[0].critical}) and requires immediate municipal attention.`)
    if (byRate[0])
      lines.push(`• ${byRate[0].name} has the lowest resolution rate (${byRate[0].resolutionRate}%) — ${byRate[0].notSafe} cases remain unresolved.`)
    if (byTotal[0])
      lines.push(`• ${byTotal[0].name} carries the highest report volume with ${byTotal[0].total} total SOS reports.`)
    lines.push(`• Municipality-wide: ${totAffected.toLocaleString()} affected persons across ${totTotal} reports. Overall resolution rate: ${resolutionRate}%.`)
    if (cannotReachCount > 0)
      lines.push(`• ${cannotReachCount} barangay${cannotReachCount===1?'':'s'} have cannot-reach cases — victims may be inaccessible and need urgent escalation.`)
    if (totPending > 0)
      lines.push(`• ${totPending} cases municipality-wide remain pending rescue response.`)

    const insights = lines.join('\n')

    return { brgyRows: rows, summary, ranked, insights }
  }, [data])

  /* ─── filtered + sorted table ─── */
  const tableRows = useMemo(() => {
    let rows = [...(brgyRows ?? [])]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.name.toLowerCase().includes(q))
    }
    rows.sort((a,b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1)
    })
    return rows
  }, [brgyRows, search, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ k }) {
    if (sortKey !== k) return <ChevronUp size={10} className="text-slate-600" />
    return sortDir === 'asc'
      ? <ChevronUp size={10} className="text-[#00d4ff]" />
      : <ChevronDown size={10} className="text-[#00d4ff]" />
  }

  const hasData = !!data && !loading

  /* ─── chart data ─── */
  const chartAData = useMemo(() => {
    const keyMap = { affected:'affected', total:'total', critical:'critical', assistance:'assistance' }
    const key = keyMap[chartMode] ?? 'affected'
    return [...(brgyRows ?? [])].sort((a,b) => b[key]-a[key]).slice(0,12).map(r => ({
      name: r.name, value: r[key],
    }))
  }, [brgyRows, chartMode])

  const chartBData = useMemo(() =>
    (brgyRows ?? []).slice(0,12).map(r => ({
      name: r.name, Safe: r.safe, 'Not Safe': r.notSafe, Critical: r.critical,
    })), [brgyRows])

  const chartCData = useMemo(() =>
    (brgyRows ?? []).map(r => ({
      x: r.avgHours, y: r.resolutionRate, z: Math.max(6, Math.min(30, r.total * 3)),
      name: r.name, total: r.total,
    })), [brgyRows])

  // SOS Trend chart — hourly for Today, daily for multi-day ranges
  const trendChartData = useMemo(() => {
    const sosList = data?.sosList ?? []
    if (preset === 'today') {
      return Array.from({ length: 5 }, (_, i) => {
        const now  = new Date()
        const hour = ((now.getHours() - 4 + i) + 24) % 24
        const label = `${String(hour).padStart(2, '0')}:00`
        const total = sosList.filter(r =>
          r.created_at && new Date(r.created_at).getHours() === hour
        ).length
        return { label, total }
      })
    }
    // Multi-day: one point per calendar day across fromDate → toDate
    const result = []
    const cur = new Date(fromDate + 'T00:00:00')
    const end = new Date(toDate   + 'T23:59:59')
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10)
      const label   = cur.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
      const total   = sosList.filter(r =>
        r.created_at && r.created_at.slice(0, 10) === dateStr
      ).length
      result.push({ label, total })
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }, [data, preset, fromDate, toDate])

  /* ─── summary card ─── */
  function SumCard({ icon: Icon, label, value, color, sub }) {
    return (
      <div className="glass rounded-xl p-4 border border-[rgba(255,255,255,0.06)] flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} style={{ color }} />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
        </div>
        <span className="text-2xl font-black" style={{ color }}>{value}</span>
        {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
      </div>
    )
  }

  /* ─── col header ─── */
  function Th({ label, k }) {
    return (
      <th onClick={() => toggleSort(k)}
        className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-[#00d4ff] select-none whitespace-nowrap">
        <span className="flex items-center gap-1">{label}<SortIcon k={k} /></span>
      </th>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ─── header card ─── */}
      <div className="glass rounded-2xl p-5 border border-[rgba(0,212,255,0.15)]">
        <div className="flex items-start justify-between flex-wrap gap-3">
          {/* title - left */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(0,212,255,0.15)] flex items-center justify-center shrink-0">
              <Layers size={18} className="text-[#00d4ff]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">BARANGAYS COMPARISON REPORT</h2>
              <p className="text-[11px] text-slate-500">Municipality of {muni || '—'} &nbsp;·&nbsp; Decision-Oriented Operational Overview</p>
              {generatedAt && (
                <p className="text-[10px] text-[#00d4ff] mt-0.5">
                  Generated {generatedAt.toLocaleString()} &nbsp;·&nbsp; {data?.sosList?.length ?? 0} records loaded
                </p>
              )}
            </div>
          </div>

          {/* controls - right */}
          <div className="flex flex-wrap items-center gap-2">
            {/* presets */}
            <div className="flex gap-1">
              {[['today','Today'],['7d','Last 7 Days'],['30d','Last 30 Days'],['custom','Custom']].map(([p,lbl]) => (
                <button key={p} onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    preset===p
                      ? 'bg-[rgba(239,68,68,0.2)] text-[#ef4444] border border-[rgba(239,68,68,0.3)]'
                      : 'text-slate-400 border border-[rgba(255,255,255,0.08)] hover:text-white'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* date inputs for custom */}
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                  className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[11px] text-white" />
                <span className="text-slate-500 text-xs">to</span>
                <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
                  className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[11px] text-white" />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={generate} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all
                  bg-gradient-to-r from-[#ef4444] to-[#f97316] hover:opacity-90 disabled:opacity-50">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Generating…' : 'Generate Report'}
              </button>
              {hasData && (
                <button onClick={() => printReport(muni, fromDate, toDate, summary, tableRows, insights)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#ef4444]
                    border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.08)] transition-all">
                  <Printer size={13} /> Print / Export
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── empty / loading ─── */}
      {!data && !loading && (
        <div className="text-center py-20 text-slate-500">
          <Layers size={40} className="mx-auto mb-3 text-[#00d4ff] opacity-40" />
          <p className="font-semibold">No municipality assigned to your account</p>
          <p className="text-sm mt-1 text-slate-600">Contact your system administrator to assign a municipality</p>
        </div>
      )}
      {loading && (
        <div className="text-center py-20 text-[#00d4ff] animate-pulse">
          <RefreshCw size={32} className="mx-auto mb-3 animate-spin" />
          <p className="font-semibold">Aggregating municipal data…</p>
        </div>
      )}

      {hasData && (<>

        {/* ─── I. Municipal Summary Cards ─── */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            I &nbsp;·&nbsp; Municipal Summary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SumCard icon={Users}        label="Affected Users"       value={summary.affected.toLocaleString()}  color="#00d4ff" />
            <SumCard icon={Activity}     label="Total Reports"        value={summary.total}                       color="#8b5cf6" />
            <SumCard icon={AlertTriangle}label="Critical Cases"       value={summary.critical}                    color="#ef4444" />
            <SumCard icon={CheckCircle}  label="Safe"                 value={summary.safe}                        color="#22c55e" />
            <SumCard icon={Shield}       label="Not Safe"             value={summary.notSafe}                     color="#f97316" />
            <SumCard icon={HelpCircle}   label="Assistance Requests"  value={summary.assistance}                  color="#f59e0b" />
            <SumCard icon={CheckCircle}  label="Resolved"             value={summary.resolved}                    color="#22c55e" />
            <SumCard icon={Clock}        label="Pending"              value={summary.pending}                     color="#f59e0b" />
            <SumCard icon={Clock}        label="Avg Hrs Active"       value={`${summary.avgHrsActive}h`}          color={hrsColor(summary.avgHrsActive)} sub="Time reports have been open" />
            <SumCard icon={TrendingUp}   label="Resolution Rate"      value={`${summary.resolutionRate}%`}
              color={rateColor(summary.resolutionRate).text}
              sub={summary.resolutionRate>=80?'On Track':summary.resolutionRate>=60?'Needs Improvement':'Critical Attention'} />
          </div>
        </div>

        {/* ─── II. Barangay Comparison Table ─── */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            II &nbsp;·&nbsp; Barangay Comparison Table
          </p>
          <div className="glass rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
            {/* search */}
            <div className="p-3 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              <Search size={13} className="text-slate-500 shrink-0" />
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search barangay…"
                className="bg-transparent text-sm text-white placeholder-slate-600 flex-1 outline-none" />
              <span className="text-[10px] text-slate-600">{tableRows.length} barangays</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-[rgba(255,255,255,0.06)]">
                  <tr>
                    <Th label="Barangay"     k="name" />
                    <Th label="Affected"     k="affected" />
                    <Th label="Safe"         k="safe" />
                    <Th label="Not Safe"     k="notSafe" />
                    <Th label="Critical"     k="critical" />
                    <Th label="Assistance"   k="assistance" />
                    <Th label="Resolved"     k="resolved" />
                    <Th label="Pending"      k="pending" />
                    <Th label="Avg Hrs"      k="avgHours" />
                    <Th label="Resolution %" k="resolutionRate" />
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-600 text-sm">No barangays found</td></tr>
                  )}
                  {tableRows.map((r, i) => {
                    const rc = rateColor(r.resolutionRate)
                    const hc = hrsColor(r.avgHours)
                    return (
                      <tr key={r.name} className={`border-b border-[rgba(255,255,255,0.04)] ${i%2===0?'':'bg-[rgba(255,255,255,0.015)]'} hover:bg-[rgba(0,212,255,0.06)] transition-colors`}>
                        <td className="px-3 py-2.5 text-sm font-semibold text-white">{r.name}</td>
                        <td className="px-3 py-2.5 text-sm text-center text-slate-300">{r.affected}</td>
                        <td className="px-3 py-2.5 text-sm text-center text-[#22c55e] font-medium">{r.safe}</td>
                        <td className="px-3 py-2.5 text-sm text-center text-[#f97316] font-medium">{r.notSafe}</td>
                        <td className={`px-3 py-2.5 text-sm text-center font-bold ${r.critical>0?'text-[#ef4444]':'text-slate-500'}`}>{r.critical}</td>
                        <td className="px-3 py-2.5 text-sm text-center text-slate-300">{r.assistance}</td>
                        <td className="px-3 py-2.5 text-sm text-center text-[#22c55e]">{r.resolved}</td>
                        <td className={`px-3 py-2.5 text-sm text-center font-medium ${r.pending>0?'text-[#f59e0b]':'text-slate-500'}`}>{r.pending}</td>
                        <td className="px-3 py-2.5 text-sm text-center font-medium" style={{ color: hc }}>{r.avgHours}h</td>
                        <td className="px-3 py-2.5 text-sm text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                            style={{ background: rc.bg, color: rc.text }}>
                            {r.resolutionRate}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── III. Charts ─── */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            III &nbsp;·&nbsp; Visual Analytics
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Chart A — Horizontal Bar (togglable) */}
            <div className="glass rounded-xl p-4 border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <span className="text-[11px] font-semibold text-slate-300">A — Barangay Ranking</span>
                <div className="flex gap-1">
                  {[['affected','Affected'],['total','Reports'],['critical','Critical'],['assistance','Assistance']].map(([k,lbl])=>(
                    <button key={k} onClick={()=>setChartMode(k)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                        chartMode===k
                          ? 'bg-[rgba(239,68,68,0.2)] text-[#ef4444] border border-[rgba(239,68,68,0.3)]'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}>{lbl}</button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartAData} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" tick={{ fill:'#64748b', fontSize:10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} width={55} />
                  <Tooltip contentStyle={{ background:'#1e1e2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }} />
                  <Bar dataKey="value" fill="#00d4ff" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart B — Stacked Bar */}
            <div className="glass rounded-xl p-4 border border-[rgba(255,255,255,0.06)]">
              <p className="text-[11px] font-semibold text-slate-300 mb-3">B — Status Distribution per Barangay</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartBData} margin={{ left: 0, bottom: 30 }}>
                  <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:9 }} angle={-35} textAnchor="end" height={50} />
                  <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
                  <Tooltip contentStyle={{ background:'#1e1e2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                  <Bar dataKey="Safe"     stackId="a" fill="#22c55e" />
                  <Bar dataKey="Not Safe" stackId="a" fill="#ef4444" />
                  <Bar dataKey="Critical" stackId="a" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart C — SOS Trend (hourly or daily) */}
            <div className="glass rounded-xl p-4 border border-[rgba(255,255,255,0.06)] lg:col-span-2">
              <p className="text-[11px] font-semibold text-slate-300 mb-3">
                C — SOS Trend {preset === 'today' ? 'Today (By Hour)' : '(By Day)'}
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendChartData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background:'#1e1e2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }}
                    labelStyle={{ color:'#94a3b8' }}
                    itemStyle={{ color:'#ef4444' }}
                  />
                  <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:'10px' }}>{v}</span>} />
                  <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} dot={false} name="Total SOS" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart D — Scatter (Response Time vs Resolution Rate) */}
            <div className="glass rounded-xl p-4 border border-[rgba(255,255,255,0.06)] lg:col-span-2">
              <p className="text-[11px] font-semibold text-slate-300 mb-3">D — Response Time vs Resolution Rate (bubble size = total reports)</p>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                  <XAxis dataKey="x" name="Avg Hrs" tick={{ fill:'#64748b', fontSize:10 }} label={{ value:'Avg Hrs Active', position:'insideBottom', offset:-4, fill:'#64748b', fontSize:10 }} />
                  <YAxis dataKey="y" name="Resolution %" tick={{ fill:'#64748b', fontSize:10 }} label={{ value:'Resolution %', angle:-90, position:'insideLeft', fill:'#64748b', fontSize:10 }} />
                  <ZAxis dataKey="z" range={[40, 400]} />
                  <Tooltip
                    cursor={{ strokeDasharray:'3 3' }}
                    contentStyle={{ background:'#1e1e2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }}
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-[#1e1e2e] border border-[rgba(255,255,255,0.1)] rounded-lg p-2 text-[11px]">
                          <p className="font-bold text-white">{d.name}</p>
                          <p className="text-slate-400">Avg Hrs: {d.x}h &nbsp;·&nbsp; Resolution: {d.y}%</p>
                          <p className="text-slate-500">Total: {d.total} reports</p>
                        </div>
                      )
                    }}
                  />
                  <Scatter data={chartCData} fill="#00d4ff" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

          </div>
        </div>

        {/* ─── IV. Priority Ranking ─── */}
        {ranked && ranked.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              IV &nbsp;·&nbsp; Barangay Priority Ranking
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ranked.map((r, i) => (
                <div key={r.name} className="glass rounded-xl p-4 border border-[rgba(255,255,255,0.06)]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-slate-600 font-mono">#{i+1}</span>
                    <span className="text-sm font-bold text-white truncate flex-1">{r.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                      style={{ background: `${priorityColor(r.priorityLabel)}22`, color: priorityColor(r.priorityLabel) }}>
                      {r.priorityLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-2">{priorityReason(r.priorityLabel)}</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-sm font-bold text-[#ef4444]">{r.critical}</p>
                      <p className="text-[9px] text-slate-600">Critical</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#f59e0b]">{r.pending}</p>
                      <p className="text-[9px] text-slate-600">Pending</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: rateColor(r.resolutionRate).text }}>{r.resolutionRate}%</p>
                      <p className="text-[9px] text-slate-600">Resolved</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── V. Key Insights ─── */}
        {insights && (
          <div className="glass rounded-xl p-5 border border-[rgba(0,212,255,0.12)]">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              V &nbsp;·&nbsp; Key Insights
            </p>
            <div className="space-y-1.5">
              {insights.split('\n').filter(Boolean).map((line, i) => (
                <p key={i} className="text-sm text-slate-300 leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
        )}

      </>)}
    </div>
  )
}
