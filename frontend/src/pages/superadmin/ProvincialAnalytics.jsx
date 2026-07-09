import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell
} from 'recharts'
import { Download, TrendingUp } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'

const MUN_DATA = [
  { name: 'Del Carmen',   total: 9, critical: 3, rescued: 1 },
  { name: 'Dapa',         total: 4, critical: 1, rescued: 0 },
  { name: 'Gen. Luna',    total: 1, critical: 0, rescued: 1 },
  { name: 'Santa Monica', total: 0, critical: 0, rescued: 0 },
  { name: 'Pilar',        total: 0, critical: 0, rescued: 0 },
]

const TREND = [
  { hour: '08:00', del_carmen: 1, dapa: 0, luna: 0 },
  { hour: '10:00', del_carmen: 3, dapa: 1, luna: 0 },
  { hour: '12:00', del_carmen: 6, dapa: 2, luna: 1 },
  { hour: '14:00', del_carmen: 8, dapa: 4, luna: 1 },
  { hour: '16:00', del_carmen: 9, dapa: 4, luna: 1 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl p-3 border border-[rgba(255,255,255,0.1)]">
      <p className="text-xs font-medium text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-xs capitalize" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export function ProvincialAnalytics() {
  const SURGE = MUN_DATA.find(m => m.total >= 5) // AI surge detection

  return (
    <SuperAdminLayout title="Provincial Analytics">
      <div className="p-4 space-y-4">
        {/* Surge alert */}
        {SURGE && (
          <div className="glass rounded-xl p-3 border border-[rgba(239,68,68,0.5)] flex items-center gap-3">
            <TrendingUp size={18} className="text-[#ef4444] shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#ef4444]">AI Surge Detected: {SURGE.name}</p>
              <p className="text-xs text-slate-400">Abnormal spike — {SURGE.total} incidents, {SURGE.critical} critical</p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <NeonButton size="sm" variant="ghost" onClick={() => alert('Export PDF report for DOST/NDRRMC briefing')}>
            <Download size={13} className="mr-1.5" />
            Export Report PDF
          </NeonButton>
        </div>

        {/* Bar chart */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Incident Count per Municipality</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MUN_DATA} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" fill="#00d4ff" radius={[4,4,0,0]} name="Total" />
              <Bar dataKey="critical" fill="#ef4444" radius={[4,4,0,0]} name="Critical" />
              <Bar dataKey="rescued" fill="#22c55e" radius={[4,4,0,0]} name="Rescued" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Line chart trends */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">SOS Trend Today (Cumulative)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={TREND} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'capitalize' }}>{v}</span>} />
              <Line type="monotone" dataKey="del_carmen" stroke="#ef4444"  strokeWidth={2} dot={false} name="Del Carmen" />
              <Line type="monotone" dataKey="dapa"      stroke="#f97316"  strokeWidth={2} dot={false} name="Dapa" />
              <Line type="monotone" dataKey="luna"      stroke="#f59e0b"  strokeWidth={2} dot={false} name="Gen. Luna" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Province heatmap proxy */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Province Severity Heatmap</p>
          <div className="space-y-2">
            {MUN_DATA.map(m => {
              const pct = Math.min((m.total / 8) * 100, 100)
              const color = m.critical >= 2 ? '#ef4444' : m.critical >= 1 ? '#f97316' : m.total > 0 ? '#f59e0b' : '#22c55e'
              return (
                <div key={m.name} className="flex items-center gap-3">
                  <p className="text-xs text-slate-400 w-20 shrink-0">{m.name}</p>
                  <div className="flex-1 h-5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}40` }} />
                  </div>
                  <span className="text-xs font-bold w-6 text-right" style={{ color }}>{m.total}</span>
                </div>
              )
            })}
          </div>
        </GlassCard>
      </div>
    </SuperAdminLayout>
  )
}
