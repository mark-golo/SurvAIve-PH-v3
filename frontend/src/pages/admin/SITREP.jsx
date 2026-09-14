import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ClipboardList, RefreshCw, Printer, AlertTriangle,
  CheckCircle, Clock, HelpCircle, Activity, Siren,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

// ── Helpers ────────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10)
const daysAgo  = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

// SOS classification predicates
const isSafe       = r => r.status === 'safe' || r.rescue_status === 'rescued'
const isNotSafe    = r => ['trapped', 'injured', 'missing'].includes(r.status) && r.rescue_status !== 'rescued'
const isCritical   = r => (r.ai_priority_score ?? 0) >= 80
const isNoResponse = r => r.rescue_status === 'cannot_reach'
const isPending    = r => ['pending', 'en_route', 'on_scene'].includes(r.rescue_status)
const isResolved   = r => r.rescue_status === 'rescued'

const SEV_COLOR  = { CRITICAL: '#ef4444', ACTIVE: '#f59e0b', STABLE: '#22c55e' }
const SEV_LABEL  = { CRITICAL: 'Critical', ACTIVE: 'Active', STABLE: 'Stable' }

function severity(row) {
  return row.critical > 0 ? 'CRITICAL' : row.notSafe > 0 ? 'ACTIVE' : 'STABLE'
}

// ── Print ──────────────────────────────────────────────────────────────────────
function doPrint({ summary, barangayRows, muni, generatedAt, fromDate, toDate }) {
  const win = window.open('', '_blank')
  const dateRange = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`
  const bTableRows = barangayRows.map(r => `
    <tr>
      <td>${r.b}</td><td>${r.registered}</td><td>${r.safe}</td>
      <td>${r.notSafe}</td><td>${r.noResp}</td><td>${r.critical}</td>
      <td><span style="font-weight:bold;color:${SEV_COLOR[severity(r)]}">${SEV_LABEL[severity(r)]}</span></td>
    </tr>`).join('')
  win.document.write(`<!DOCTYPE html><html><head>
    <title>SITREP — ${muni}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#000;background:#fff;margin:30px;font-size:12px}
      h1{font-size:16px;font-weight:bold;margin-bottom:2px;text-transform:uppercase}
      h2{font-size:12px;color:#444;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.05em}
      .header{text-align:center;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:18px}
      .meta{font-size:11px;color:#555;margin-top:4px}
      .stat-row{display:flex;gap:10px;margin:10px 0;flex-wrap:wrap}
      .stat{border:1px solid #bbb;padding:8px 12px;flex:1;text-align:center;min-width:70px}
      .stat-n{font-size:20px;font-weight:bold}
      .stat-l{font-size:9px;color:#555;text-transform:uppercase;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px}
      th,td{border:1px solid #bbb;padding:4px 7px;text-align:left}
      th{background:#e8e8e8;font-weight:bold;font-size:10px;text-transform:uppercase}
      .section{margin-top:18px;page-break-inside:avoid}
      .badge{display:inline-block;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:bold;color:#fff}
      @media print{button{display:none}.no-print{display:none}}
    </style>
  </head><body>
    <div class="header">
      <h1>Municipality Disaster Situation Report (SITREP)</h1>
      <div class="meta">Municipality of ${muni} &nbsp;|&nbsp; Period: ${dateRange}</div>
      <div class="meta">Generated: ${generatedAt?.toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' }) ?? '—'}</div>
      <div class="meta" style="margin-top:8px;font-weight:bold;font-size:10px;color:#888">SurvAIve PH — DRRM Command System</div>
    </div>

    <h2>I. Summary Statistics</h2>
    <div class="stat-row">
      <div class="stat"><div class="stat-n">${summary.total}</div><div class="stat-l">Total Affected</div></div>
      <div class="stat"><div class="stat-n" style="color:#22c55e">${summary.safe}</div><div class="stat-l">Safe</div></div>
      <div class="stat"><div class="stat-n" style="color:#f97316">${summary.notSafe}</div><div class="stat-l">Not Safe</div></div>
      <div class="stat"><div class="stat-n" style="color:#ef4444">${summary.critical}</div><div class="stat-l">Critical</div></div>
      <div class="stat"><div class="stat-n" style="color:#8b5cf6">${summary.noResp}</div><div class="stat-l">No Response</div></div>
      <div class="stat"><div class="stat-n" style="color:#f59e0b">${summary.pending}</div><div class="stat-l">Pending Assist.</div></div>
      <div class="stat"><div class="stat-n" style="color:#22c55e">${summary.resolved}</div><div class="stat-l">Resolved</div></div>
    </div>

    <div class="section">
      <h2>II. Barangay Breakdown</h2>
      <table>
        <tr><th>Barangay</th><th>Registered</th><th>Safe</th><th>Not Safe</th><th>No Response</th><th>Critical</th><th>Status</th></tr>
        ${bTableRows || '<tr><td colspan="7">No data in selected period</td></tr>'}
      </table>
    </div>

    <div class="section">
      <h2>III. Most Affected Barangays</h2>
      <table>
        <tr><th>#</th><th>Barangay</th><th>Total SOS</th><th>Critical</th><th>Not Safe</th></tr>
        ${barangayRows.slice(0, 5).map((r, i) =>
          `<tr><td>${i + 1}</td><td>${r.b}</td><td>${r.total}</td><td>${r.critical}</td><td>${r.notSafe}</td></tr>`
        ).join('') || '<tr><td colspan="5">—</td></tr>'}
      </table>
    </div>

    <script>window.onload=()=>{window.print()}</script>
  </body></html>`)
  win.document.close()
}

// ── Local UI components ────────────────────────────────────────────────────────
function SumCard({ label, value, color, icon: Icon }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      {Icon && <Icon size={16} className="mx-auto mb-1.5" style={{ color }} />}
      <p className="text-2xl font-black" style={{ color }}>{value ?? '—'}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5 leading-snug">{label}</p>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-5 first:mt-0">
      {children}
    </p>
  )
}

function Tbl({ heads, rows, empty = 'No data' }) {
  if (!rows.length) return <p className="text-xs text-slate-500 py-4 text-center">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10">
            {heads.map(h => (
              <th key={h} className="text-left py-2 px-3 text-slate-400 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              {row.map((cell, j) => <td key={j} className="py-2 px-3 text-slate-200">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function SITREP() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality

  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [fromDate,    setFromDate]    = useState(todayStr)
  const [toDate,      setToDate]      = useState(todayStr)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [preset,      setPreset]      = useState('today')

  function applyPreset(p) {
    setPreset(p)
    const t = todayStr()
    if (p === 'today') { setFromDate(t);          setToDate(t) }
    if (p === '7d')    { setFromDate(daysAgo(7));  setToDate(t) }
    if (p === '30d')   { setFromDate(daysAgo(30)); setToDate(t) }
  }

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const [sosRes, vicRes] = await Promise.all([
        supabase
          .from('sos_reports')
          .select('id, barangay, status, rescue_status, ai_priority_score, people_count, special_conditions, created_at, notes')
          .eq('municipality', muni)
          .gte('created_at', fromDate + 'T00:00:00')
          .lte('created_at', toDate   + 'T23:59:59')
          .order('created_at', { ascending: false }),
        supabase
          .from('victims')
          .select('id, barangay')
          .eq('municipality', muni),
      ])
      const sosList = sosRes.data ?? []
      const victimsByBarangay = {}
      ;(vicRes.data ?? []).forEach(v => {
        const b = v.barangay ?? 'Unknown'
        victimsByBarangay[b] = (victimsByBarangay[b] ?? 0) + 1
      })
      setData({ sosList, victimsByBarangay })
      setGeneratedAt(new Date())
    } catch (e) {
      console.error('SITREP generate error', e)
    } finally {
      setLoading(false)
    }
  }, [muni, fromDate, toDate])

  useEffect(() => { generate() }, [generate])

  // ── Derived data ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!data) return null
    const { sosList } = data
    const count   = (fn)  => sosList.filter(fn).length
    const sumPpl  = (fn)  => sosList.filter(fn).reduce((s, r) => s + (r.people_count ?? 1), 0)
    return {
      total:    sosList.reduce((s, r) => s + (r.people_count ?? 1), 0),
      safe:     sumPpl(isSafe),
      notSafe:  sumPpl(isNotSafe),
      critical: count(isCritical),
      noResp:   count(isNoResponse),
      pending:  count(isPending),
      resolved: count(isResolved),
    }
  }, [data])

  const barangayRows = useMemo(() => {
    if (!data) return []
    const { sosList, victimsByBarangay } = data
    const map = {}
    sosList.forEach(r => {
      const b = r.barangay ?? 'Unknown'
      if (!map[b]) map[b] = { safe: 0, notSafe: 0, noResp: 0, critical: 0, total: 0 }
      map[b].total++
      if (isSafe(r))       map[b].safe++
      if (isNotSafe(r))    map[b].notSafe++
      if (isNoResponse(r)) map[b].noResp++
      if (isCritical(r))   map[b].critical++
    })
    return Object.entries(map)
      .map(([b, v]) => ({ b, registered: victimsByBarangay[b] ?? 0, ...v }))
      .sort((a, c) => c.critical - a.critical || c.notSafe - a.notSafe || c.total - a.total)
  }, [data])

  const criticalIncidents = useMemo(
    () => (data?.sosList ?? []).filter(isCritical).slice(0, 15),
    [data]
  )

  const pendingAssistance = useMemo(
    () => (data?.sosList ?? []).filter(isPending).slice(0, 15),
    [data]
  )

  const trendData = useMemo(() => {
    if (!data) return []
    const byDay = {}
    data.sosList.forEach(r => {
      const d = (r.created_at ?? '').slice(0, 10)
      if (!byDay[d]) byDay[d] = { date: d, Total: 0, Critical: 0, Resolved: 0 }
      byDay[d].Total++
      if (isCritical(r)) byDay[d].Critical++
      if (isResolved(r)) byDay[d].Resolved++
    })
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  const hasData   = Boolean(data)
  const dateLabel = fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-y-auto">

        {/* ── Header controls ─────────────────────────────────────────────── */}
        <div className="p-4 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.15)] sticky top-0 z-10">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] flex items-center justify-center shrink-0">
                <ClipboardList size={18} className="text-[#ef4444]" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white uppercase tracking-wide leading-tight">
                  Municipality Disaster Situation Report
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {muni ? `Municipality of ${muni}` : 'All Jurisdictions'}
                  {generatedAt
                    ? ` · As of ${generatedAt.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                    : ' · Generate to load data'}
                </p>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {[['today','Today'],['7d','Last 7 Days'],['30d','Last 30 Days'],['custom','Custom']].map(([p,lbl]) => (
                  <button key={p} onClick={() => applyPreset(p)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      preset===p
                        ? 'bg-[rgba(239,68,68,0.2)] text-[#ef4444] border border-[rgba(239,68,68,0.3)]'
                        : 'text-slate-400 border border-[rgba(255,255,255,0.08)] hover:text-white'
                    }`}>{lbl}</button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                    className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-[rgba(239,68,68,0.4)]" />
                  <span className="text-slate-500 text-xs">to</span>
                  <input type="date" value={toDate} min={fromDate} onChange={e=>setToDate(e.target.value)}
                    className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-[rgba(239,68,68,0.4)]" />
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={generate} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all bg-gradient-to-r from-[#ef4444] to-[#f97316] disabled:opacity-50 hover:opacity-90">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Generating…' : 'Generate Report'}
                </button>
                {hasData && (
                  <button onClick={() => doPrint({ summary, barangayRows, muni, generatedAt, fromDate, toDate })}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#ef4444] border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.08)] transition-all">
                    <Printer size={13} /> Print / Export
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!hasData && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 py-16">
            <div className="w-16 h-16 rounded-2xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] flex items-center justify-center">
              <ClipboardList size={28} className="text-[rgba(239,68,68,0.5)]" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">No report generated yet</p>
              <p className="text-slate-500 text-sm mt-1 max-w-xs leading-relaxed">
                Select a date range and click <strong className="text-slate-300">Generate Report</strong> to produce the SITREP for {muni ?? 'your municipality'}.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-sm animate-pulse">Generating SITREP…</p>
          </div>
        )}

        {/* ── Report body ─────────────────────────────────────────────────── */}
        {hasData && !loading && (
          <div className="p-4 space-y-6">

            {/* Period label */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
              <p className="text-[10px] text-slate-500 uppercase tracking-widest px-2">
                Period: {dateLabel} · {data.sosList.length} SOS report{data.sosList.length !== 1 ? 's' : ''}
              </p>
              <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
            </div>

            {/* ── I. Summary stats ─────────────────────────────────────────── */}
            <section>
              <SectionTitle>I. Summary Statistics</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <SumCard label="Total Affected" value={summary.total}    color="#00d4ff" icon={Activity} />
                <SumCard label="Safe"           value={summary.safe}     color="#22c55e" icon={CheckCircle} />
                <SumCard label="Not Safe"       value={summary.notSafe}  color="#f97316" icon={AlertTriangle} />
                <SumCard label="Critical"       value={summary.critical} color="#ef4444" icon={Siren} />
                <SumCard label="No Response"    value={summary.noResp}   color="#8b5cf6" icon={HelpCircle} />
                <SumCard label="Pending Assist" value={summary.pending}  color="#f59e0b" icon={Clock} />
                <SumCard label="Resolved"       value={summary.resolved} color="#22c55e" icon={CheckCircle} />
              </div>
            </section>

            {/* ── II. Barangay breakdown table ─────────────────────────────── */}
            <section>
              <SectionTitle>II. Barangay Breakdown</SectionTitle>
              <div className="glass rounded-2xl p-4">
                <Tbl
                  heads={['Barangay', 'Registered', 'Safe', 'Not Safe', 'No Response', 'Critical', 'Status']}
                  rows={barangayRows.map(r => {
                    const sev = severity(r)
                    return [
                      <span key="b" className="font-medium text-white">{r.b}</span>,
                      r.registered,
                      <span key="safe" className="font-semibold text-[#22c55e]">{r.safe}</span>,
                      <span key="ns"   className="font-semibold text-[#f97316]">{r.notSafe}</span>,
                      <span key="nr"   className="font-semibold text-[#8b5cf6]">{r.noResp}</span>,
                      <span key="cr"   className="font-semibold text-[#ef4444]">{r.critical}</span>,
                      <span key="sev"
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: SEV_COLOR[sev], background: SEV_COLOR[sev] + '18' }}
                      >{SEV_LABEL[sev]}</span>,
                    ]
                  })}
                  empty="No SOS reports in selected period"
                />
              </div>
            </section>

            {/* ── III. Severity Heatmap ────────────────────────────────────── */}
            {barangayRows.length > 0 && (
              <section>
                <SectionTitle>III. Barangay Severity Heatmap</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {barangayRows.map(row => {
                    const sev   = severity(row)
                    const color = SEV_COLOR[sev]
                    return (
                      <div
                        key={row.b}
                        className="rounded-xl p-3 border transition-all"
                        style={{
                          borderColor: color + '55',
                          background:  color + '0d',
                        }}
                      >
                        <p className="text-xs font-bold text-white truncate leading-tight">{row.b}</p>
                        <p className="text-[10px] font-semibold mt-0.5" style={{ color }}>
                          {SEV_LABEL[sev]}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-1 leading-snug">
                          {row.total} SOS · {row.critical} critical
                        </p>
                        {/* mini severity bar */}
                        <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width:      `${Math.min(100, (row.critical / Math.max(1, barangayRows[0]?.critical || row.total)) * 100)}%`,
                              background: color,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── IV. Analysis sections (2-col grid) ──────────────────────── */}
            <section>
              <SectionTitle>IV. Analysis</SectionTitle>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Most affected barangays */}
                <div className="glass rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-300 mb-3">Most Affected Barangays</p>
                  {barangayRows.length === 0
                    ? <p className="text-xs text-slate-500">No data</p>
                    : barangayRows.slice(0, 5).map((r, i) => {
                        const pct = Math.round((r.total / Math.max(1, barangayRows[0].total)) * 100)
                        return (
                          <div key={r.b} className="mb-3 last:mb-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-200 font-medium">
                                <span className="text-slate-500 mr-1.5">#{i + 1}</span>{r.b}
                              </span>
                              <span className="text-xs text-slate-400">{r.total} SOS</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, background: SEV_COLOR[severity(r)] }}
                              />
                            </div>
                          </div>
                        )
                      })
                  }
                </div>

                {/* Response activities */}
                <div className="glass rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-300 mb-3">Response Activities</p>
                  {[
                    { label: 'En Route',     value: (data.sosList.filter(r => r.rescue_status === 'en_route')).length,  color: '#00d4ff' },
                    { label: 'On Scene',     value: (data.sosList.filter(r => r.rescue_status === 'on_scene')).length,  color: '#f59e0b' },
                    { label: 'Rescued',      value: (data.sosList.filter(r => r.rescue_status === 'rescued')).length,   color: '#22c55e' },
                    { label: 'Cannot Reach', value: (data.sosList.filter(r => r.rescue_status === 'cannot_reach')).length, color: '#8b5cf6' },
                    { label: 'Pending',      value: (data.sosList.filter(r => r.rescue_status === 'pending')).length,   color: '#64748b' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-xs text-slate-300">{label}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Critical incidents */}
                <div className="glass rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-300 mb-3">
                    Critical Incidents
                    <span className="ml-2 text-[10px] font-normal text-[#ef4444]">{criticalIncidents.length} case{criticalIncidents.length !== 1 ? 's' : ''}</span>
                  </p>
                  {criticalIncidents.length === 0
                    ? <p className="text-xs text-slate-500">No critical SOS in selected period</p>
                    : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                        {criticalIncidents.map(r => (
                          <div key={r.id} className="bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)] rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-white truncate">{r.barangay ?? 'Unknown'}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#ef4444] text-white shrink-0">CRITICAL</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                              {r.status ?? 'unknown'} · {r.people_count ?? 1} person{(r.people_count ?? 1) > 1 ? 's' : ''}
                              {r.rescue_status ? ` · ${r.rescue_status.replace('_', ' ')}` : ''}
                            </p>
                            {r.special_conditions && (
                              <p className="text-[9px] text-[#f97316] mt-0.5">{r.special_conditions}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>

                {/* Assistance requirements */}
                <div className="glass rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-300 mb-3">
                    Assistance Requirements
                    <span className="ml-2 text-[10px] font-normal text-[#f59e0b]">{pendingAssistance.length} pending</span>
                  </p>
                  {pendingAssistance.length === 0
                    ? <p className="text-xs text-slate-500">No pending SOS — all resolved or no data</p>
                    : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                        {pendingAssistance.map(r => (
                          <div key={r.id} className="bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)] rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-white truncate">{r.barangay ?? 'Unknown'}</p>
                              <span className="text-[9px] text-[#f59e0b] font-bold capitalize shrink-0">
                                {(r.rescue_status ?? '').replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                              {r.status ?? 'unknown'} · {r.people_count ?? 1} person{(r.people_count ?? 1) > 1 ? 's' : ''}
                            </p>
                            {r.special_conditions && (
                              <p className="text-[9px] text-[#f97316] mt-0.5">{r.special_conditions}</p>
                            )}
                            {r.notes && (
                              <p className="text-[9px] text-slate-500 mt-0.5 truncate">{r.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>

              </div>
            </section>

            {/* ── V. Trends over time ──────────────────────────────────────── */}
            {trendData.length > 1 && (
              <section>
                <SectionTitle>V. Trends Over Time</SectionTitle>
                <div className="glass rounded-2xl p-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trendData} margin={{ left: 0, right: 8 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickFormatter={d => d.slice(5)} // MM-DD
                      />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11, borderRadius: 8 }}
                        labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      <Bar dataKey="Total"    fill="#00d4ff" radius={[3,3,0,0]} />
                      <Bar dataKey="Critical" fill="#ef4444" radius={[3,3,0,0]} />
                      <Bar dataKey="Resolved" fill="#22c55e" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Footer stamp */}
            <div className="text-center py-4">
              <p className="text-[10px] text-slate-600">
                SurvAIve PH — DRRM Command System · Report generated {generatedAt?.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </div>

          </div>
        )}
      </div>
  )
}
