import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  FileBarChart, RefreshCw, Printer,
  CheckCircle, AlertTriangle, HelpCircle, Activity, Users, Siren,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

// ── Helpers ────────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10)
const daysAgo  = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const priLabel = s => s >= 80 ? 'CRITICAL' : s >= 60 ? 'HIGH' : s >= 40 ? 'MODERATE' : 'LOW'
const priColor = n => ({ CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', LOW: '#22c55e' }[n] ?? '#64748b')

// ── Print ──────────────────────────────────────────────────────────────────────
function printReport(title, muni, body) {
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#000;background:#fff;margin:30px;font-size:12px}
      h1{font-size:16px;font-weight:bold;margin-bottom:2px;text-transform:uppercase}
      h2{font-size:12px;color:#444;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.05em}
      .header{text-align:center;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:18px}
      .meta{font-size:11px;color:#555;margin-top:4px}
      .stat-row{display:flex;gap:12px;margin:10px 0;flex-wrap:wrap}
      .stat{border:1px solid #bbb;padding:8px 14px;flex:1;text-align:center;min-width:80px}
      .stat-n{font-size:22px;font-weight:bold}
      .stat-l{font-size:9px;color:#555;text-transform:uppercase;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px}
      th,td{border:1px solid #bbb;padding:4px 8px;text-align:left}
      th{background:#e8e8e8;font-weight:bold;font-size:10px;text-transform:uppercase}
      .section{margin-top:18px;page-break-inside:avoid}
      @media print{button{display:none}}
    </style>
  </head><body>
    <div class="header">
      <h1>Emergency Response Summary Report</h1>
      <div class="meta">${muni ? `Municipality of ${muni} &nbsp;|&nbsp; ` : ''}Generated: ${new Date().toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })}</div>
      <div class="meta" style="margin-top:8px;font-weight:bold;font-size:10px;color:#888">SurvAIve PH — DRRM Command System</div>
    </div>
    ${body}
    <script>window.onload=()=>{window.print()}</script>
  </body></html>`)
  win.document.close()
}

// ── Local UI helpers ───────────────────────────────────────────────────────────
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
export function EmergencyReport() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality
  const prov = scope?.province

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
      let sosQ = supabase
        .from('sos_reports')
        .select('id, barangay, rescue_status, ai_priority_score, people_count')
        .gte('created_at', fromDate + 'T00:00:00')
        .lte('created_at', toDate   + 'T23:59:59')

      if (muni) sosQ = sosQ.eq('municipality', muni)
      else if (prov) sosQ = sosQ.eq('province', prov)

      let respQ = supabase
        .from('responders')
        .select('id', { count: 'exact', head: true })
        .eq('duty_status', 'on_duty')

      if (muni) respQ = respQ.eq('municipality', muni)

      const [sosRes, respRes] = await Promise.all([sosQ, respQ])

      const rows = sosRes.data ?? []
      const bMap   = {}
      const priMap = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 }

      rows.forEach(r => {
        const b = r.barangay ?? 'Unknown'
        if (!bMap[b]) bMap[b] = { total: 0, rescued: 0 }
        bMap[b].total++
        if (r.rescue_status === 'rescued') bMap[b].rescued++
        priMap[priLabel(r.ai_priority_score ?? 0)]++
      })

      setData({
        rows,
        rescued:        rows.filter(r => r.rescue_status === 'rescued').length,
        unresolved:     rows.filter(r => ['pending', 'en_route', 'on_scene'].includes(r.rescue_status)).length,
        cannotReach:    rows.filter(r => r.rescue_status === 'cannot_reach').length,
        bMap,
        priMap,
        responderCount: respRes.count ?? 0,
      })
      setGeneratedAt(new Date())
    } catch (e) {
      console.error('EmergencyReport generate error', e)
    } finally {
      setLoading(false)
    }
  }, [muni, prov, fromDate, toDate])

  useEffect(() => { generate() }, [generate])

  // ── Derived data ─────────────────────────────────────────────────────────────
  const bRows     = useMemo(() => data ? Object.entries(data.bMap).sort((a, b) => b[1].total - a[1].total) : [], [data])
  const chartData = useMemo(() => bRows.slice(0, 10).map(([b, v]) => ({ name: b, Rescued: v.rescued, Pending: v.total - v.rescued })), [bRows])
  const pieData   = useMemo(() => data ? Object.entries(data.priMap).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })) : [], [data])

  const hasData   = Boolean(data)
  const dateLabel = fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`

  function doPrint() {
    if (!data) return
    const { rows, rescued, unresolved, cannotReach, bMap, priMap, responderCount } = data
    const allRows = Object.entries(bMap).sort((a, b) => b[1].total - a[1].total)
    const body = `
      <div class="stat-row">
        <div class="stat"><div class="stat-n">${rows.length}</div><div class="stat-l">Total SOS</div></div>
        <div class="stat"><div class="stat-n">${rescued}</div><div class="stat-l">Rescued</div></div>
        <div class="stat"><div class="stat-n">${unresolved}</div><div class="stat-l">Unresolved</div></div>
        <div class="stat"><div class="stat-n">${cannotReach}</div><div class="stat-l">Cannot Reach</div></div>
        <div class="stat"><div class="stat-n">${responderCount}</div><div class="stat-l">Responders On-Duty</div></div>
      </div>
      <div class="section">
        <h2>Priority Breakdown</h2>
        <table>
          <tr><th>Priority Level</th><th>Count</th></tr>
          ${Object.entries(priMap).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
        </table>
      </div>
      <div class="section">
        <h2>Barangay Breakdown (All)</h2>
        <table>
          <tr><th>Barangay</th><th>Total SOS</th><th>Rescued</th><th>Pending / Unresolved</th></tr>
          ${allRows.map(([b, v]) => `<tr><td>${b}</td><td>${v.total}</td><td>${v.rescued}</td><td>${v.total - v.rescued}</td></tr>`).join('')}
        </table>
      </div>`
    printReport('Emergency Response Summary Report', muni, body)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-y-auto">

        {/* ── Header controls ─────────────────────────────────────────────── */}
        <div className="p-4 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.15)] sticky top-0 z-10">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] flex items-center justify-center shrink-0">
                <FileBarChart size={18} className="text-[#ef4444]" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white uppercase tracking-wide leading-tight">
                  Emergency Response Summary Report
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {muni ? `Municipality of ${muni}` : 'All Jurisdictions'}
                  {generatedAt
                    ? ` · As of ${generatedAt.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                    : ' · Generate to load data'}
                </p>
              </div>
            </div>

            {/* Controls */}
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
                  <button onClick={doPrint}
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
              <FileBarChart size={28} className="text-[rgba(239,68,68,0.5)]" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">No report generated yet</p>
              <p className="text-slate-500 text-sm mt-1 max-w-xs leading-relaxed">
                Select a date range and click <strong className="text-slate-300">Generate Report</strong> to produce the Emergency Response Summary for {muni ?? 'your municipality'}.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-sm animate-pulse">Generating Emergency Response Summary…</p>
          </div>
        )}

        {/* ── Report body ─────────────────────────────────────────────────── */}
        {hasData && !loading && (
          <div className="p-4 space-y-6">

            {/* Period label */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
              <p className="text-[10px] text-slate-500 uppercase tracking-widest px-2">
                Period: {dateLabel} · {data.rows.length} SOS report{data.rows.length !== 1 ? 's' : ''}
              </p>
              <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
            </div>

            {/* ── I. Summary Statistics ─────────────────────────────────────── */}
            <section>
              <SectionTitle>I. Summary Statistics</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <SumCard label="Total SOS"          value={data.rows.length}    color="#00d4ff" icon={Activity} />
                <SumCard label="Rescued"             value={data.rescued}        color="#22c55e" icon={CheckCircle} />
                <SumCard label="Unresolved"          value={data.unresolved}     color="#f59e0b" icon={AlertTriangle} />
                <SumCard label="Cannot Reach"        value={data.cannotReach}    color="#8b5cf6" icon={HelpCircle} />
                <SumCard label="Responders On-Duty"  value={data.responderCount} color="#00d4ff" icon={Users} />
              </div>
            </section>

            {/* ── II & III. Charts side-by-side ────────────────────────────── */}
            <section>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* II. Priority Breakdown */}
                <div>
                  <SectionTitle>II. Priority Breakdown</SectionTitle>
                  <div className="glass rounded-2xl p-4">
                    {pieData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={pieData} dataKey="value" nameKey="name"
                              cx="50%" cy="50%" outerRadius={70}
                              label={({ name, value }) => `${name}: ${value}`}
                              labelLine={{ stroke: '#475569' }}
                            >
                              {pieData.map((e, i) => <Cell key={i} fill={priColor(e.name)} />)}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11, borderRadius: 8 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 justify-center mt-2">
                          {pieData.map(e => (
                            <div key={e.name} className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: priColor(e.name) }} />
                              <span className="text-[10px] text-slate-400">{e.name} ({e.value})</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500 py-8 text-center">No priority data in selected period</p>
                    )}
                  </div>
                </div>

                {/* III. Barangay Breakdown Top 10 */}
                <div>
                  <SectionTitle>III. Barangay Breakdown (Top 10)</SectionTitle>
                  <div className="glass rounded-2xl p-4">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                          <YAxis
                            type="category" dataKey="name"
                            tick={{ fill: '#94a3b8', fontSize: 9 }} width={90}
                            tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v}
                          />
                          <Tooltip
                            contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11, borderRadius: 8 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                          <Bar dataKey="Rescued" fill="#22c55e" stackId="a" radius={[0, 2, 2, 0]} />
                          <Bar dataKey="Pending" fill="#ef4444" stackId="a" radius={[0, 2, 2, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-xs text-slate-500 py-8 text-center">No barangay data in selected period</p>
                    )}
                  </div>
                </div>

              </div>
            </section>

            {/* ── IV. All Barangays Table ──────────────────────────────────── */}
            {bRows.length > 0 && (
              <section>
                <SectionTitle>IV. All Barangays</SectionTitle>
                <div className="glass rounded-2xl p-4">
                  <Tbl
                    heads={['Barangay', 'Total SOS', 'Rescued', 'Pending / Unresolved', 'Rescue Rate']}
                    rows={bRows.map(([b, v], i) => {
                      const rate = v.total > 0 ? Math.round((v.rescued / v.total) * 100) : 0
                      return [
                        <span key="b" className="font-medium text-white flex items-center gap-1.5">
                          <span className="text-slate-600 text-[10px] w-4 text-right shrink-0">#{i + 1}</span>
                          {b}
                        </span>,
                        <span key="t" className="font-semibold text-[#00d4ff]">{v.total}</span>,
                        <span key="r" className="font-semibold text-[#22c55e]">{v.rescued}</span>,
                        <span key="p" className="font-semibold text-[#f59e0b]">{v.total - v.rescued}</span>,
                        <div key="rate" className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden" style={{ minWidth: 48 }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${rate}%`, background: rate >= 70 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444' }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{rate}%</span>
                        </div>,
                      ]
                    })}
                    empty="No SOS reports in selected period"
                  />
                </div>
              </section>
            )}

            {/* Footer stamp */}
            <div className="text-center py-4">
              <p className="text-[10px] text-slate-600">
                SurvAIve PH — DRRM Command System · Emergency Response Summary generated {generatedAt?.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </div>

          </div>
        )}
      </div>
  )
}
