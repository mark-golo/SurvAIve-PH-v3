import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { AdminLayout } from './AdminLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl p-3 border border-[rgba(255,255,255,0.1)]">
      <p className="text-xs font-medium text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export function AdminAnalytics() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality
  const [sos, setSos]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos'
    api.get(q).then(setSos).catch(() => setSos([])).finally(() => setLoading(false))
  }, [])

  // Computed chart data
  const statusData = [
    { name: 'Rescued',  value: sos.filter(r => r.rescue_status === 'rescued').length,  color: '#22c55e' },
    { name: 'En Route', value: sos.filter(r => r.rescue_status === 'en_route').length, color: '#00d4ff' },
    { name: 'Pending',  value: sos.filter(r => !r.rescue_status || r.rescue_status === 'pending').length, color: '#ef4444' },
  ]

  const priorityData = [
    { range: 'Critical (80+)', count: sos.filter(r => (r.ai_priority_score ?? 0) >= 80).length, color: '#ef4444' },
    { range: 'High (60-79)',   count: sos.filter(r => { const s = r.ai_priority_score ?? 0; return s >= 60 && s < 80 }).length, color: '#f97316' },
    { range: 'Moderate (40)', count: sos.filter(r => { const s = r.ai_priority_score ?? 0; return s >= 40 && s < 60 }).length, color: '#f59e0b' },
    { range: 'Low (<40)',      count: sos.filter(r => (r.ai_priority_score ?? 50) < 40).length, color: '#22c55e' },
  ]

  const timeData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const label  = DAYS[d.getDay()]
    const dateStr = d.toISOString().slice(0, 10)
    const dayRows = sos.filter(r => r.created_at?.slice(0, 10) === dateStr)
    return { day: label, verified: dayRows.filter(r => r.is_verified).length, guest: dayRows.filter(r => !r.is_verified).length }
  })

  const verifiedRate = sos.length ? Math.round(sos.filter(r => r.is_verified).length / sos.length * 100) : 0
  const guestRatio   = sos.length ? Math.round(sos.filter(r => !r.is_verified).length / sos.length * 100) : 0

  if (loading) return (
    <AdminLayout title="Analytics">
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
    </AdminLayout>
  )

  return (
    <AdminLayout title="Analytics">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pie chart */}
          <GlassCard>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Victim Status Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="rgba(255,255,255,0.1)" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Priority histogram */}
          <GlassCard>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">AI Priority Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priorityData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="range" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>

        {/* Time series */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Reports Over Time (Last 7 Days)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'capitalize' }}>{v}</span>} />
              <Line type="monotone" dataKey="verified" stroke="#00d4ff" strokeWidth={2} dot={{ fill: '#00d4ff', r: 3 }} />
              <Line type="monotone" dataKey="guest"    stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Verified Rate"  value={`${verifiedRate}%`} color="#22c55e" />
          <MetricCard label="Total Reports"  value={sos.length}         color="#00d4ff" />
        </div>

        {/* Spam indicator */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Spam / False Report Indicator</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#f59e0b]" style={{ width: `${guestRatio}%` }} />
            </div>
            <span className="text-sm font-bold text-[#f59e0b]">{guestRatio}%</span>
            <span className="text-xs text-slate-500">guest reports</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Ratio below 60% is acceptable. High guest ratio may indicate spam activity.</p>
        </GlassCard>
      </div>
    </AdminLayout>
  )
}

function MetricCard({ label, value, color }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  )
}
