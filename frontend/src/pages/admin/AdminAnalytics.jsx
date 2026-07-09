import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { AdminLayout } from './AdminLayout'
import { GlassCard } from '../../components/ui/GlassCard'

const STATUS_DATA = [
  { name: 'Rescued',  value: 1, color: '#22c55e' },
  { name: 'En Route', value: 1, color: '#00d4ff' },
  { name: 'Pending',  value: 4, color: '#ef4444' },
]

const TIME_DATA = [
  { day: 'Mon', verified: 3, guest: 2 },
  { day: 'Tue', verified: 5, guest: 4 },
  { day: 'Wed', verified: 8, guest: 6 },
  { day: 'Thu', verified: 12,guest: 9 },
  { day: 'Fri', verified: 7, guest: 5 },
  { day: 'Sat', verified: 4, guest: 3 },
  { day: 'Sun', verified: 6, guest: 4 },
]

const PRIORITY_DATA = [
  { range: 'Critical (80+)', count: 2, color: '#ef4444' },
  { range: 'High (60-79)',   count: 2, color: '#f97316' },
  { range: 'Moderate (40)', count: 1, color: '#f59e0b' },
  { range: 'Low (<40)',      count: 1, color: '#22c55e' },
]

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
  return (
    <AdminLayout title="Analytics">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pie chart */}
          <GlassCard>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Victim Status Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={STATUS_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {STATUS_DATA.map((entry, i) => (
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
              <BarChart data={PRIORITY_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="range" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {PRIORITY_DATA.map((entry, i) => (
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
            <LineChart data={TIME_DATA} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Avg Response" value="18 min" color="#00d4ff" />
          <MetricCard label="Verified Rate" value="50%" color="#22c55e" />
          <MetricCard label="AI Accuracy" value="87%" color="#8b5cf6" />
          <MetricCard label="Mesh Uptime" value="94%" color="#f97316" />
        </div>

        {/* Spam indicator */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Spam / False Report Indicator</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#f59e0b]" style={{ width: '50%' }} />
            </div>
            <span className="text-sm font-bold text-[#f59e0b]">50%</span>
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
