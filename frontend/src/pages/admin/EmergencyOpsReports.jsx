import { useState, useEffect, useCallback } from 'react'
import { FileText, Printer, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { AdminLayout } from './AdminLayout'
import { SuperAdminLayout } from '../superadmin/SuperAdminLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

const TABS = [
  { id: 'aar',        label: 'After-Action Report' },
  { id: 'daily',      label: 'Daily Incident Summary' },
  { id: 'victims',    label: 'Victim Management' },
  { id: 'responders', label: 'Responder Operations' },
  { id: 'welfare',    label: 'Welfare Check Summary' },
  { id: 'ai',         label: 'AI Decision Accuracy' },
]

const todayStr = () => new Date().toISOString().slice(0, 10)
const priLabel = s => s >= 80 ? 'CRITICAL' : s >= 60 ? 'HIGH' : s >= 40 ? 'MODERATE' : 'LOW'
const priColor = l => ({ CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', LOW: '#22c55e' })[l]

const PIE_COLORS = ['#22c55e', '#f97316', '#f59e0b', '#ef4444']

function StatCard({ label, value, color }) {
  return (
    <div className="glass-bright rounded-2xl p-4 text-center">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-black" style={{ color: color ?? '#00d4ff' }}>{value ?? '—'}</p>
    </div>
  )
}

function SectionTitle({ children }) {
  return <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-5">{children}</p>
}

function Tbl({ heads, rows, empty = 'No data' }) {
  if (!rows.length) return <p className="text-xs text-slate-500 py-4 text-center">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10">
            {heads.map(h => <th key={h} className="text-left py-2 px-3 text-slate-400 font-semibold whitespace-nowrap">{h}</th>)}
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

function printReport(title, muni, prov, bodyHtml) {
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#000;background:#fff;margin:30px;font-size:12px}
      h1{font-size:18px;margin-bottom:4px} h2{font-size:13px;color:#444;margin:16px 0 8px}
      .header{text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px}
      .meta{font-size:11px;color:#666;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}
      th{background:#e8e8e8;font-weight:bold}
      .stat-row{display:flex;gap:16px;margin:12px 0;flex-wrap:wrap}
      .stat{border:1px solid #bbb;padding:10px 14px;flex:1;text-align:center;min-width:80px}
      .stat-n{font-size:22px;font-weight:bold}
      .stat-l{font-size:10px;color:#666;text-transform:uppercase}
      @media print{button{display:none}}
    </style>
  </head><body>
    <div class="header">
      <h1>SurvAIve PH — ${title}</h1>
      <div class="meta">${muni ? `Municipality: ${muni} · ` : ''}${prov ? `Province: ${prov} · ` : ''}Generated: ${new Date().toLocaleString()}</div>
    </div>
    ${bodyHtml}
    <script>window.onload=()=>{window.print()}</script>
  </body></html>`)
  win.document.close()
}

// ─── AAR ────────────────────────────────────────────────────────────────────
function AARReport({ muni, prov, fromDate, toDate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('sos_reports')
        .select('id, barangay, rescue_status, ai_priority_score, people_count')
        .gte('created_at', fromDate + 'T00:00:00')
        .lte('created_at', toDate + 'T23:59:59')
      if (muni) q = q.eq('municipality', muni)
      else if (prov) q = q.eq('province', prov)
      const { data: rows } = await q

      let rq = supabase.from('responders').select('id', { count: 'exact', head: true }).eq('duty_status', 'on_duty')
      if (muni) rq = rq.eq('municipality', muni)
      const { count: responderCount } = await rq

      const safe = rows ?? []
      const rescued = safe.filter(r => r.rescue_status === 'rescued').length
      const unresolved = safe.filter(r => ['pending','en_route','on_scene'].includes(r.rescue_status)).length
      const cannotReach = safe.filter(r => r.rescue_status === 'cannot_reach').length

      const bMap = {}
      safe.forEach(r => {
        const b = r.barangay ?? 'Unknown'
        if (!bMap[b]) bMap[b] = { total: 0, rescued: 0 }
        bMap[b].total++
        if (r.rescue_status === 'rescued') bMap[b].rescued++
      })

      const priMap = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 }
      safe.forEach(r => { if (r.ai_priority_score != null) priMap[priLabel(r.ai_priority_score)]++ })

      setData({ rows: safe, rescued, unresolved, cannotReach, bMap, priMap, responderCount: responderCount ?? 0 })
    } finally {
      setLoading(false)
    }
  }, [muni, prov, fromDate, toDate])

  const doPrint = () => {
    if (!data) return
    const { rows, rescued, unresolved, cannotReach, bMap, priMap, responderCount } = data
    const bRows = Object.entries(bMap).sort((a,b) => b[1].total - a[1].total)
    const body = `
      <div class="stat-row">
        <div class="stat"><div class="stat-n">${rows.length}</div><div class="stat-l">Total SOS</div></div>
        <div class="stat"><div class="stat-n">${rescued}</div><div class="stat-l">Rescued</div></div>
        <div class="stat"><div class="stat-n">${unresolved}</div><div class="stat-l">Unresolved</div></div>
        <div class="stat"><div class="stat-n">${cannotReach}</div><div class="stat-l">Cannot Reach</div></div>
        <div class="stat"><div class="stat-n">${responderCount}</div><div class="stat-l">Responders On-Duty</div></div>
      </div>
      <h2>Priority Breakdown</h2>
      <table><tr><th>Priority</th><th>Count</th></tr>
        ${Object.entries(priMap).map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
      </table>
      <h2>Barangay Breakdown</h2>
      <table><tr><th>Barangay</th><th>Total SOS</th><th>Rescued</th><th>Pending</th></tr>
        ${bRows.map(([b,v]) => `<tr><td>${b}</td><td>${v.total}</td><td>${v.rescued}</td><td>${v.total - v.rescued}</td></tr>`).join('')}
      </table>`
    printReport('After-Action Report', muni, prov, body)
  }

  if (!data && !loading) return (
    <button onClick={load} className="flex items-center gap-2 text-xs text-[#00d4ff] hover:underline mt-2">
      <RefreshCw size={12} /> Generate Report
    </button>
  )
  if (loading) return <p className="text-xs text-slate-400 py-6 text-center">Loading…</p>

  const { rows, rescued, unresolved, cannotReach, bMap, priMap, responderCount } = data
  const bRows = Object.entries(bMap).sort((a,b) => b[1].total - a[1].total)
  const chartData = bRows.slice(0, 10).map(([b, v]) => ({ name: b, Rescued: v.rescued, Pending: v.total - v.rescued }))
  const pieData = Object.entries(priMap).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={doPrint} className="flex items-center gap-1.5 text-xs bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.25)] text-[#00d4ff] rounded-lg px-3 py-1.5 hover:bg-[rgba(0,212,255,0.2)] transition-colors">
          <Printer size={12} /> Print Report
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total SOS" value={rows.length} color="#ef4444" />
        <StatCard label="Rescued" value={rescued} color="#22c55e" />
        <StatCard label="Unresolved" value={unresolved} color="#f59e0b" />
        <StatCard label="Cannot Reach" value={cannotReach} color="#8b5cf6" />
        <StatCard label="Responders On-Duty" value={responderCount} color="#00d4ff" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-bright rounded-2xl p-4">
          <SectionTitle>Priority Breakdown</SectionTitle>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({name,value}) => `${name}: ${value}`}>
                  {pieData.map((e, i) => <Cell key={i} fill={priColor(e.name)} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-slate-500 py-4 text-center">No priority data</p>}
        </div>
        <div className="glass-bright rounded-2xl p-4">
          <SectionTitle>Barangay Breakdown (Top 10)</SectionTitle>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} width={80} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }} />
                <Bar dataKey="Rescued" fill="#22c55e" stackId="a" />
                <Bar dataKey="Pending" fill="#ef4444" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-slate-500 py-4 text-center">No barangay data</p>}
        </div>
      </div>
      <div className="glass-bright rounded-2xl p-4">
        <SectionTitle>All Barangays</SectionTitle>
        <Tbl
          heads={['Barangay', 'Total SOS', 'Rescued', 'Pending']}
          rows={bRows.map(([b,v]) => [b, v.total, v.rescued, v.total - v.rescued])}
          empty="No SOS reports in this date range"
        />
      </div>
    </div>
  )
}

// ─── DAILY ──────────────────────────────────────────────────────────────────
function DailyReport({ muni, prov, fromDate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dayStart = fromDate + 'T00:00:00'
      const dayEnd   = fromDate + 'T23:59:59'

      let sosQ = supabase.from('sos_reports').select('id, rescue_status')
        .gte('created_at', dayStart).lte('created_at', dayEnd)
      if (muni) sosQ = sosQ.eq('municipality', muni)
      else if (prov) sosQ = sosQ.eq('province', prov)

      let wcQ = supabase.from('welfare_checks').select('id', { count: 'exact', head: true })
        .eq('check_date', fromDate)
      if (muni) wcQ = wcQ.eq('municipality', muni)

      let vQ = supabase.from('victims').select('id', { count: 'exact', head: true })
      if (muni) vQ = vQ.eq('municipality', muni)
      else if (prov) vQ = vQ.eq('province', prov)

      let rQ = supabase.from('responders').select('id', { count: 'exact', head: true }).eq('duty_status', 'on_duty')
      if (muni) rQ = rQ.eq('municipality', muni)

      let ecQ = supabase.from('evacuation_centers').select('id, status')
      if (muni) ecQ = ecQ.eq('municipality', muni)
      else if (prov) ecQ = ecQ.eq('province', prov)

      const [sosRes, wcRes, vRes, rRes, ecRes] = await Promise.all([sosQ, wcQ, vQ, rQ, ecQ])
      const sosList = sosRes.data ?? []
      const opened  = sosList.length
      const closed  = sosList.filter(s => s.rescue_status === 'rescued').length
      const active  = sosList.filter(s => ['pending','en_route','on_scene'].includes(s.rescue_status)).length
      const ecList  = ecRes.data ?? []
      const ecOpen  = ecList.filter(e => e.status === 'open').length

      setData({ opened, closed, active, wc: wcRes.count ?? 0, victims: vRes.count ?? 0, responders: rRes.count ?? 0, ecOpen, ecTotal: ecList.length })
    } finally {
      setLoading(false)
    }
  }, [muni, prov, fromDate])

  const doPrint = () => {
    if (!data) return
    const { opened, closed, active, wc, victims, responders, ecOpen, ecTotal } = data
    const body = `
      <div class="stat-row">
        <div class="stat"><div class="stat-n">${opened}</div><div class="stat-l">Incidents Opened</div></div>
        <div class="stat"><div class="stat-n">${closed}</div><div class="stat-l">Resolved</div></div>
        <div class="stat"><div class="stat-n">${active}</div><div class="stat-l">Active</div></div>
        <div class="stat"><div class="stat-n">${wc}</div><div class="stat-l">Welfare Checks</div></div>
        <div class="stat"><div class="stat-n">${victims}</div><div class="stat-l">Registered Victims</div></div>
        <div class="stat"><div class="stat-n">${responders}</div><div class="stat-l">Responders On-Duty</div></div>
        <div class="stat"><div class="stat-n">${ecOpen}/${ecTotal}</div><div class="stat-l">Evacuation Centers Open</div></div>
      </div>`
    printReport(`Daily Incident Summary — ${fromDate}`, muni, prov, body)
  }

  if (!data && !loading) return (
    <button onClick={load} className="flex items-center gap-2 text-xs text-[#00d4ff] hover:underline mt-2">
      <RefreshCw size={12} /> Generate Report
    </button>
  )
  if (loading) return <p className="text-xs text-slate-400 py-6 text-center">Loading…</p>

  const { opened, closed, active, wc, victims, responders, ecOpen, ecTotal } = data
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={doPrint} className="flex items-center gap-1.5 text-xs bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.25)] text-[#00d4ff] rounded-lg px-3 py-1.5 hover:bg-[rgba(0,212,255,0.2)] transition-colors">
          <Printer size={12} /> Print Report
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Incidents Opened" value={opened} color="#ef4444" />
        <StatCard label="Resolved" value={closed} color="#22c55e" />
        <StatCard label="Active" value={active} color="#f59e0b" />
        <StatCard label="Welfare Checks Done" value={wc} color="#00d4ff" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Registered Victims" value={victims} color="#8b5cf6" />
        <StatCard label="Responders On-Duty" value={responders} color="#22c55e" />
        <StatCard label={`Evac Centers Open`} value={`${ecOpen}/${ecTotal}`} color="#f97316" />
      </div>
    </div>
  )
}

// ─── VICTIMS ────────────────────────────────────────────────────────────────
function VictimsReport({ muni, prov, fromDate, toDate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('victims')
        .select('id, name, barangay, municipality, status, vulnerabilities, created_at')
        .gte('created_at', fromDate + 'T00:00:00')
        .lte('created_at', toDate + 'T23:59:59')
        .order('created_at', { ascending: false })
      if (muni) q = q.eq('municipality', muni)
      else if (prov) q = q.eq('province', prov)
      const { data: rows } = await q
      setData(rows ?? [])
    } finally {
      setLoading(false)
    }
  }, [muni, prov, fromDate, toDate])

  const doPrint = () => {
    if (!data) return
    const statusCount = {}
    data.forEach(v => { statusCount[v.status ?? 'unknown'] = (statusCount[v.status ?? 'unknown'] ?? 0) + 1 })
    const body = `
      <div class="stat-row">
        ${Object.entries(statusCount).map(([k,v]) => `<div class="stat"><div class="stat-n">${v}</div><div class="stat-l">${k}</div></div>`).join('')}
        <div class="stat"><div class="stat-n">${data.length}</div><div class="stat-l">Total</div></div>
      </div>
      <h2>Affected Persons List</h2>
      <table><tr><th>#</th><th>Name</th><th>Barangay</th><th>Status</th><th>Vulnerabilities</th><th>Registered</th></tr>
        ${data.map((v,i) => `<tr><td>${i+1}</td><td>${v.name ?? '—'}</td><td>${v.barangay ?? '—'}</td><td>${v.status ?? '—'}</td><td>${(v.vulnerabilities ?? []).join(', ') || '—'}</td><td>${new Date(v.created_at).toLocaleDateString()}</td></tr>`).join('')}
      </table>`
    printReport('Victim Management Report', muni, prov, body)
  }

  if (!data && !loading) return (
    <button onClick={load} className="flex items-center gap-2 text-xs text-[#00d4ff] hover:underline mt-2">
      <RefreshCw size={12} /> Generate Report
    </button>
  )
  if (loading) return <p className="text-xs text-slate-400 py-6 text-center">Loading…</p>

  const statusCount = {}
  data.forEach(v => { statusCount[v.status ?? 'unknown'] = (statusCount[v.status ?? 'unknown'] ?? 0) + 1 })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={doPrint} className="flex items-center gap-1.5 text-xs bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.25)] text-[#00d4ff] rounded-lg px-3 py-1.5 hover:bg-[rgba(0,212,255,0.2)] transition-colors">
          <Printer size={12} /> Print Report
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(statusCount).map(([k,v]) => <StatCard key={k} label={k} value={v} />)}
        <StatCard label="Total Registered" value={data.length} color="#00d4ff" />
      </div>
      <div className="glass-bright rounded-2xl p-4">
        <SectionTitle>Affected Persons List</SectionTitle>
        <Tbl
          heads={['Name', 'Barangay', 'Status', 'Vulnerabilities', 'Registered']}
          rows={data.map(v => [
            v.name ?? '—',
            v.barangay ?? '—',
            v.status ?? '—',
            (v.vulnerabilities ?? []).join(', ') || '—',
            new Date(v.created_at).toLocaleDateString(),
          ])}
          empty="No victims registered in this date range"
        />
      </div>
    </div>
  )
}

// ─── RESPONDERS ─────────────────────────────────────────────────────────────
function RespondersReport({ muni, prov, fromDate, toDate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let rQ = supabase.from('responders').select('id, name, unit, zone, duty_status')
      if (muni) rQ = rQ.eq('municipality', muni)
      else if (prov) rQ = rQ.eq('province', prov)

      let sosQ = supabase.from('sos_reports')
        .select('id, assigned_responder_id, rescue_status')
        .not('assigned_responder_id', 'is', null)
        .gte('created_at', fromDate + 'T00:00:00')
        .lte('created_at', toDate + 'T23:59:59')
      if (muni) sosQ = sosQ.eq('municipality', muni)
      else if (prov) sosQ = sosQ.eq('province', prov)

      const [rRes, sosRes] = await Promise.all([rQ, sosQ])
      const responders = rRes.data ?? []
      const sosList    = sosRes.data ?? []

      const caseMap = {}
      sosList.forEach(s => {
        const rid = s.assigned_responder_id
        if (!caseMap[rid]) caseMap[rid] = { total: 0, rescued: 0 }
        caseMap[rid].total++
        if (s.rescue_status === 'rescued') caseMap[rid].rescued++
      })

      setData(responders.map(r => ({
        ...r,
        cases: caseMap[r.id]?.total ?? 0,
        rescued: caseMap[r.id]?.rescued ?? 0,
      })))
    } finally {
      setLoading(false)
    }
  }, [muni, prov, fromDate, toDate])

  const doPrint = () => {
    if (!data) return
    const body = `
      <table><tr><th>Name</th><th>Unit</th><th>Zone</th><th>Duty Status</th><th>Cases Assigned</th><th>Rescued</th><th>Success Rate</th></tr>
        ${data.map(r => `<tr><td>${r.name ?? '—'}</td><td>${r.unit ?? '—'}</td><td>${r.zone ?? '—'}</td><td>${r.duty_status ?? '—'}</td><td>${r.cases}</td><td>${r.rescued}</td><td>${r.cases > 0 ? Math.round(r.rescued/r.cases*100) + '%' : '—'}</td></tr>`).join('')}
      </table>`
    printReport('Responder Operations Report', muni, prov, body)
  }

  if (!data && !loading) return (
    <button onClick={load} className="flex items-center gap-2 text-xs text-[#00d4ff] hover:underline mt-2">
      <RefreshCw size={12} /> Generate Report
    </button>
  )
  if (loading) return <p className="text-xs text-slate-400 py-6 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={doPrint} className="flex items-center gap-1.5 text-xs bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.25)] text-[#00d4ff] rounded-lg px-3 py-1.5 hover:bg-[rgba(0,212,255,0.2)] transition-colors">
          <Printer size={12} /> Print Report
        </button>
      </div>
      <div className="glass-bright rounded-2xl p-4">
        <SectionTitle>Responder Deployment Record</SectionTitle>
        <Tbl
          heads={['Name', 'Unit', 'Zone', 'Duty Status', 'Cases', 'Rescued', 'Success Rate']}
          rows={data.map(r => [
            r.name ?? '—',
            r.unit ?? '—',
            r.zone ?? '—',
            r.duty_status ?? '—',
            r.cases,
            r.rescued,
            r.cases > 0 ? Math.round(r.rescued / r.cases * 100) + '%' : '—',
          ])}
          empty="No responders found for this jurisdiction"
        />
      </div>
    </div>
  )
}

// ─── WELFARE ────────────────────────────────────────────────────────────────
function WelfareReport({ muni, prov, fromDate, toDate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let wcQ = supabase.from('welfare_checks')
        .select('victim_id, check_date, victims(barangay, municipality)')
        .gte('check_date', fromDate)
        .lte('check_date', toDate)
      if (muni) wcQ = wcQ.eq('municipality', muni)

      let vQ = supabase.from('victims').select('id, barangay')
      if (muni) vQ = vQ.eq('municipality', muni)
      else if (prov) vQ = vQ.eq('province', prov)

      const [wcRes, vRes] = await Promise.all([wcQ, vQ])
      const checks   = wcRes.data ?? []
      const victims  = vRes.data ?? []

      const totalByB = {}
      victims.forEach(v => { totalByB[v.barangay ?? 'Unknown'] = (totalByB[v.barangay ?? 'Unknown'] ?? 0) + 1 })

      const checkedByB = {}
      checks.forEach(c => {
        const b = c.victims?.barangay ?? 'Unknown'
        checkedByB[b] = (checkedByB[b] ?? 0) + 1
      })

      const rows = Object.entries(totalByB).map(([b, total]) => ({
        b, total, checked: checkedByB[b] ?? 0,
      })).sort((a, c) => c.total - a.total)

      setData({ rows, totalChecks: checks.length, totalVictims: victims.length })
    } finally {
      setLoading(false)
    }
  }, [muni, prov, fromDate, toDate])

  const doPrint = () => {
    if (!data) return
    const { rows, totalChecks, totalVictims } = data
    const body = `
      <div class="stat-row">
        <div class="stat"><div class="stat-n">${totalVictims}</div><div class="stat-l">Total Registered</div></div>
        <div class="stat"><div class="stat-n">${totalChecks}</div><div class="stat-l">Total Checks</div></div>
        <div class="stat"><div class="stat-n">${totalVictims > 0 ? Math.round(totalChecks/totalVictims*100) : 0}%</div><div class="stat-l">Overall Coverage</div></div>
      </div>
      <h2>Barangay Welfare Check Completion</h2>
      <table><tr><th>Barangay</th><th>Total Registered</th><th>Checked</th><th>% Complete</th></tr>
        ${rows.map(r => `<tr><td>${r.b}</td><td>${r.total}</td><td>${r.checked}</td><td>${Math.round(r.checked/r.total*100)}%</td></tr>`).join('')}
      </table>`
    printReport('Welfare Check Summary', muni, prov, body)
  }

  if (!data && !loading) return (
    <button onClick={load} className="flex items-center gap-2 text-xs text-[#00d4ff] hover:underline mt-2">
      <RefreshCw size={12} /> Generate Report
    </button>
  )
  if (loading) return <p className="text-xs text-slate-400 py-6 text-center">Loading…</p>

  const { rows, totalChecks, totalVictims } = data

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={doPrint} className="flex items-center gap-1.5 text-xs bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.25)] text-[#00d4ff] rounded-lg px-3 py-1.5 hover:bg-[rgba(0,212,255,0.2)] transition-colors">
          <Printer size={12} /> Print Report
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Registered" value={totalVictims} color="#8b5cf6" />
        <StatCard label="Total Checks Done" value={totalChecks} color="#22c55e" />
        <StatCard label="Overall Coverage" value={totalVictims > 0 ? Math.round(totalChecks / totalVictims * 100) + '%' : '—'} color="#00d4ff" />
      </div>
      <div className="glass-bright rounded-2xl p-4">
        <SectionTitle>Barangay Completion</SectionTitle>
        <Tbl
          heads={['Barangay', 'Registered', 'Checked', '% Complete']}
          rows={rows.map(r => [
            r.b,
            r.total,
            r.checked,
            <div key="bar" className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${Math.round(r.checked / r.total * 100)}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 w-8 text-right">{Math.round(r.checked / r.total * 100)}%</span>
            </div>,
          ])}
          empty="No welfare check data in this date range"
        />
      </div>
    </div>
  )
}

// ─── AI ACCURACY ────────────────────────────────────────────────────────────
function AIReport({ muni, prov, fromDate, toDate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('sos_reports')
        .select('id, ai_priority_score, rescue_status')
        .gte('created_at', fromDate + 'T00:00:00')
        .lte('created_at', toDate + 'T23:59:59')
        .not('ai_priority_score', 'is', null)
      if (muni) q = q.eq('municipality', muni)
      else if (prov) q = q.eq('province', prov)
      const { data: rows } = await q

      const buckets = { CRITICAL: [], HIGH: [], MODERATE: [], LOW: [] }
      ;(rows ?? []).forEach(r => buckets[priLabel(r.ai_priority_score)].push(r))

      const stats = Object.entries(buckets).map(([label, list]) => {
        const total   = list.length
        const rescued = list.filter(r => r.rescue_status === 'rescued').length
        const tpr     = total > 0 ? Math.round(rescued / total * 100) : 0
        return { label, total, rescued, tpr, color: priColor(label) }
      })

      setData({ stats, total: (rows ?? []).length })
    } finally {
      setLoading(false)
    }
  }, [muni, prov, fromDate, toDate])

  const doPrint = () => {
    if (!data) return
    const body = `
      <p style="font-size:11px;color:#666;margin-bottom:12px">Higher TPR on CRITICAL cases indicates the AI correctly identified the most urgent victims.</p>
      <table><tr><th>Priority</th><th>Total Cases</th><th>Rescued</th><th>True Positive Rate</th></tr>
        ${data.stats.map(s => `<tr><td>${s.label}</td><td>${s.total}</td><td>${s.rescued}</td><td>${s.tpr}%</td></tr>`).join('')}
      </table>`
    printReport('AI Decision Accuracy Report', muni, prov, body)
  }

  if (!data && !loading) return (
    <button onClick={load} className="flex items-center gap-2 text-xs text-[#00d4ff] hover:underline mt-2">
      <RefreshCw size={12} /> Generate Report
    </button>
  )
  if (loading) return <p className="text-xs text-slate-400 py-6 text-center">Loading…</p>

  const { stats, total } = data
  const chartData = stats.filter(s => s.total > 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={doPrint} className="flex items-center gap-1.5 text-xs bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.25)] text-[#00d4ff] rounded-lg px-3 py-1.5 hover:bg-[rgba(0,212,255,0.2)] transition-colors">
          <Printer size={12} /> Print Report
        </button>
      </div>
      <div className="glass-bright rounded-xl p-3">
        <p className="text-[11px] text-slate-400">
          Higher rescue rate on CRITICAL cases = AI correctly identified the most urgent victims.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => <StatCard key={s.label} label={s.label} value={`${s.tpr}%`} color={s.color} />)}
      </div>
      {chartData.length > 0 && (
        <div className="glass-bright rounded-2xl p-4">
          <SectionTitle>True Positive Rate by Priority</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => v + '%'} contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }} />
              <Bar dataKey="tpr" name="TPR">
                {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="glass-bright rounded-2xl p-4">
        <SectionTitle>Detail by Priority</SectionTitle>
        <Tbl
          heads={['Priority', 'Total Cases', 'Rescued', 'True Positive Rate']}
          rows={stats.map(s => [s.label, s.total, s.rescued, `${s.tpr}%`])}
        />
        <p className="text-[10px] text-slate-500 mt-3">Total cases with AI score: {total}</p>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export function EmergencyOpsReports() {
  const { scope, role } = useAuthStore()
  const muni = scope?.municipality
  const prov = scope?.province

  const [tab, setTab]           = useState('aar')
  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate]     = useState(todayStr())

  const Layout = role === 'superadmin' ? SuperAdminLayout : AdminLayout

  return (
    <Layout title="Emergency Operations Reports">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
            <FileText size={18} className="text-[#00d4ff]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Emergency Operations Reports</h1>
            <p className="text-[11px] text-slate-500">{muni ? `Municipality of ${muni}` : prov ? `Province of ${prov}` : 'All Jurisdictions'}</p>
          </div>
        </div>

        {/* Date range filter */}
        <div className="glass-bright rounded-2xl p-4">
          <p className="text-[11px] text-slate-400 mb-3 font-semibold uppercase tracking-wider">
            {tab === 'daily' ? 'Select Date' : 'Date Range'}
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">{tab === 'daily' ? 'Date' : 'From'}</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-white text-xs rounded-lg px-3 py-1.5 outline-none focus:border-[rgba(0,212,255,0.4)]"
              />
            </div>
            {tab !== 'daily' && (
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={e => setToDate(e.target.value)}
                  className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-white text-xs rounded-lg px-3 py-1.5 outline-none focus:border-[rgba(0,212,255,0.4)]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                tab === t.id
                  ? 'bg-[rgba(0,212,255,0.15)] border border-[rgba(0,212,255,0.3)] text-[#00d4ff]'
                  : 'text-slate-400 border border-transparent hover:text-white hover:border-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Report content */}
        <div className="glass-bright rounded-2xl p-4">
          {tab === 'aar'        && <AARReport       muni={muni} prov={prov} fromDate={fromDate} toDate={toDate} />}
          {tab === 'daily'      && <DailyReport     muni={muni} prov={prov} fromDate={fromDate} />}
          {tab === 'victims'    && <VictimsReport   muni={muni} prov={prov} fromDate={fromDate} toDate={toDate} />}
          {tab === 'responders' && <RespondersReport muni={muni} prov={prov} fromDate={fromDate} toDate={toDate} />}
          {tab === 'welfare'    && <WelfareReport   muni={muni} prov={prov} fromDate={fromDate} toDate={toDate} />}
          {tab === 'ai'         && <AIReport        muni={muni} prov={prov} fromDate={fromDate} toDate={toDate} />}
        </div>
      </div>
    </Layout>
  )
}
