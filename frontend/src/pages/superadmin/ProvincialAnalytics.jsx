import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts'
import { Download, TrendingUp, AlertTriangle } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import api from '../../lib/api'
import { clusterSOS } from '../../lib/kmeans'
import { groupPredictionByMunicipality } from '../../lib/resourcePredictor'

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
  const [sos, setSos]             = useState([])
  const [responders, setResponders] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    api.get('/sos').then(setSos).catch(() => setSos([])).finally(() => setLoading(false))
    api.get('/responders').then(setResponders).catch(() => setResponders([]))
  }, [])

  // Group by municipality
  const munMap = {}
  sos.forEach(r => {
    const name = r.municipality ?? 'Unknown'
    if (!munMap[name]) munMap[name] = { name, total: 0, critical: 0, rescued: 0 }
    munMap[name].total++
    if (r.priority === 'CRITICAL') munMap[name].critical++
    if (r.rescue_status === 'rescued') munMap[name].rescued++
  })
  const munData = Object.values(munMap).sort((a, b) => b.total - a.total)

  // SOS trend by hour (last 5 hours, total count)
  const trendData = Array.from({ length: 5 }, (_, i) => {
    const now  = new Date()
    const hour = ((now.getHours() - 4 + i) + 24) % 24
    const label = `${String(hour).padStart(2, '0')}:00`
    const count = sos.filter(r => r.created_at && new Date(r.created_at).getHours() === hour).length
    return { hour: label, total: count }
  })

  const clusters = useMemo(() => clusterSOS(sos), [sos])

  const muniForecasts  = useMemo(() => groupPredictionByMunicipality(sos, responders), [sos, responders])
  const alertForecasts = muniForecasts.filter(f => f.alertLevel === 'AT_RISK' || f.alertLevel === 'OVERWHELMED')

  if (loading) return (
    <SuperAdminLayout title="Provincial Analytics">
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
    </SuperAdminLayout>
  )

  return (
    <SuperAdminLayout title="Provincial Analytics">
      <div className="p-4 space-y-4">
        {/* Resource Depletion Alert */}
        {alertForecasts.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#ef4444] shrink-0" />
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Resource Depletion Alert · {alertForecasts.length} Municipality{alertForecasts.length > 1 ? 's' : ''} At Risk
              </p>
            </div>
            {alertForecasts.map(f => {
              const color = f.alertLevel === 'OVERWHELMED' ? '#ef4444' : '#f97316'
              const pct = Math.min(f.loadRatio * 100, 100)
              return (
                <div key={f.municipality} className="glass rounded-xl p-3 border" style={{ borderColor: `${color}40` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold" style={{ color }}>{f.municipality}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}20`, color }}>{f.alertLevel}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {f.activeLoad} active SOS · {f.onDutyCount} responder{f.onDutyCount !== 1 ? 's' : ''} on duty
                    {f.minutesToOverwhelm != null ? ` · overwhelmed in ~${f.minutesToOverwhelm} min` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* AI Cluster Analysis */}
        {clusters.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-[#ef4444]" />
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                AI Cluster Analysis · {clusters.length} Hotspot{clusters.length > 1 ? 's' : ''} Detected
              </p>
            </div>
            {clusters.map((cl, idx) => {
              const color = cl.priority === 'CRITICAL' ? '#ef4444' : cl.priority === 'HIGH' ? '#f97316' : cl.priority === 'MODERATE' ? '#f59e0b' : '#22c55e'
              return (
                <div key={idx} className="glass rounded-xl p-3 border" style={{ borderColor: `${color}40` }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold" style={{ color }}>
                      Cluster {idx + 1} · {cl.count} report{cl.count > 1 ? 's' : ''}
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>
                      {cl.priority}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {cl.criticalCount > 0 ? `${cl.criticalCount} critical · ` : ''}Avg score {cl.avgScore}
                  </p>
                  {cl.barangays.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {cl.barangays.slice(0, 3).join(', ')}{cl.barangays.length > 3 ? ` +${cl.barangays.length - 3} more` : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end">
          <NeonButton size="sm" variant="ghost" onClick={() => alert('Export PDF report for DOST/NDRRMC briefing')}>
            <Download size={13} className="mr-1.5" />
            Export Report PDF
          </NeonButton>
        </div>

        {munData.length === 0 ? (
          <GlassCard>
            <p className="text-xs text-slate-500 text-center py-8">No SOS data yet</p>
          </GlassCard>
        ) : (
          <>
            {/* Bar chart */}
            <GlassCard>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Incident Count per Municipality</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={munData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total"    fill="#00d4ff" radius={[4,4,0,0]} name="Total" />
                  <Bar dataKey="critical" fill="#ef4444" radius={[4,4,0,0]} name="Critical" />
                  <Bar dataKey="rescued"  fill="#22c55e" radius={[4,4,0,0]} name="Rescued" />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Line chart trends */}
            <GlassCard>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">SOS Trend Today (by Hour)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
                  <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '10px' }}>{v}</span>} />
                  <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} dot={false} name="Total SOS" />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Province heatmap proxy */}
            <GlassCard>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Province Severity Heatmap</p>
              <div className="space-y-2">
                {munData.map(m => {
                  const maxTotal = Math.max(...munData.map(x => x.total), 1)
                  const pct   = Math.min((m.total / maxTotal) * 100, 100)
                  const color = m.critical >= 2 ? '#ef4444' : m.critical >= 1 ? '#f97316' : m.total > 0 ? '#f59e0b' : '#22c55e'
                  return (
                    <div key={m.name} className="flex items-center gap-3">
                      <p className="text-xs text-slate-400 w-24 shrink-0 truncate">{m.name}</p>
                      <div className="flex-1 h-5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}40` }} />
                      </div>
                      <span className="text-xs font-bold w-6 text-right" style={{ color }}>{m.total}</span>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}
