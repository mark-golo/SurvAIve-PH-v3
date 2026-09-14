import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import {
  Brain, TrendingUp, AlertTriangle, Users,
  RefreshCw, WifiOff, Zap, Eye, ChevronDown, MapPin, Target,
} from 'lucide-react'

import { NeonButton } from '../../components/ui/NeonButton'
import { GlassCard } from '../../components/ui/GlassCard'
import api from '../../lib/api'
import { db } from '../../lib/db'
import { useAuthStore } from '../../store/auth'

// ─────────────────────────────────────────────────────────────────────────────
// AI Analysis Engine — pure JS, runs fully offline, no cloud calls needed
// ─────────────────────────────────────────────────────────────────────────────

const getPriority = (score) =>
  score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW'

function analyzeZones(reports) {
  if (!reports.length) return []

  const normalised = reports.map(r => ({
    ...r,
    priority: r.priority ?? getPriority(r.ai_priority_score ?? 50),
    minutes_ago: Number(r.minutes_ago) || 9999,
  }))

  const groups = {}
  normalised.forEach(r => {
    const key = r.barangay?.trim() || 'Unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })

  const maxCount = Math.max(...Object.values(groups).map(g => g.length), 1)

  return Object.entries(groups).map(([barangay, zr]) => {
    const total         = zr.length
    const unrescued     = zr.filter(r => r.rescue_status !== 'rescued').length
    const rescued       = total - unrescued
    const criticalCount = zr.filter(r => r.priority === 'CRITICAL').length
    const highCount     = zr.filter(r => r.priority === 'HIGH').length
    const avgScore      = Math.round(zr.reduce((s, r) => s + (r.ai_priority_score ?? 50), 0) / total)
    const criticalPct   = criticalCount / total
    const photoCount    = zr.filter(r => r.sos_mode === 'photo').length

    const recentCount    = zr.filter(r => r.minutes_ago < 30).length
    const isSurging      = recentCount >= 3 || (recentCount >= 2 && total >= 4)
    const recentCritical = zr.filter(r =>
      r.minutes_ago < 60 && (r.priority === 'CRITICAL' || r.priority === 'HIGH')
    ).length

    let tag, tagColor, recommendation, sortPriority
    if (criticalCount >= 3 || total >= 8 || (criticalPct >= 0.5 && total >= 4)) {
      tag           = 'CRITICAL CLUSTER'
      tagColor      = '#ef4444'
      recommendation = 'Deploy maximum available rescue resources immediately. Establish incident command post on-site.'
      sortPriority  = 1
    } else if (isSurging || (total >= 5 && unrescued >= 4)) {
      tag           = 'SURGE ZONE'
      tagColor      = '#f97316'
      recommendation = 'Incident rate rising rapidly. Pre-position additional rescue teams and evacuation transport.'
      sortPriority  = 2
    } else if (total >= 3 || avgScore >= 65 || recentCritical >= 1) {
      tag           = 'HIGH RISK'
      tagColor      = '#f59e0b'
      recommendation = 'Assign a dedicated rescue unit. Maintain direct communication and prepare evacuation route.'
      sortPriority  = 3
    } else {
      tag           = 'ACTIVE'
      tagColor      = '#22c55e'
      recommendation = 'Assign nearest available unit. Standard response protocol applies.'
      sortPriority  = 4
    }

    const evacScore = unrescued * 10 + criticalCount * 25 + (isSurging ? 20 : 0)

    return {
      barangay, total, unrescued, rescued,
      criticalCount, highCount, avgScore, criticalPct,
      isSurging, recentCount, recentCritical, photoCount,
      tag, tagColor, recommendation, sortPriority, evacScore,
      widthPct: Math.round((total / maxCount) * 100),
      reports: zr,
    }
  }).sort((a, b) =>
    a.sortPriority !== b.sortPriority
      ? a.sortPriority - b.sortPriority
      : b.total - a.total
  )
}

function generateInsights(zones) {
  const insights = []
  if (!zones.length) return insights

  const top = zones[0]
  insights.push({
    type: 'priority', icon: '', color: '#ef4444',
    title: 'Immediate Priority Zone',
    body: `${top.barangay} requires immediate action — ${top.total} SOS report${top.total > 1 ? 's' : ''}, ${top.criticalCount} CRITICAL, average AI score ${top.avgScore}.`,
  })

  const surging = zones.filter(z => z.isSurging)
  if (surging.length) {
    insights.push({
      type: 'surge', icon: '⚡', color: '#f97316',
      title: `Surge Detected — ${surging.length} Zone${surging.length > 1 ? 's' : ''}`,
      body: `${surging.map(z => z.barangay).join(', ')} ${surging.length === 1 ? 'is' : 'are'} showing rapidly increasing incident rates. Pre-position rescue resources immediately.`,
    })
  }

  const evacTop = [...zones]
    .sort((a, b) => b.evacScore - a.evacScore)
    .filter(z => z.unrescued > 0)
    .slice(0, 3)
  if (evacTop.length) {
    insights.push({
      type: 'evacuation', icon: '🏃', color: '#8b5cf6',
      title: 'Evacuation Priorities',
      body: evacTop.map(z => `${z.barangay} (${z.unrescued} unrescued)`).join(' › ') +
        '. These zones have the most people awaiting rescue.',
    })
  }

  const totalPhotos = zones.reduce((s, z) => s + z.photoCount, 0)
  if (totalPhotos > 0) {
    const photoZones = zones.filter(z => z.photoCount > 0)
    insights.push({
      type: 'ai', icon: '🤖', color: '#00d4ff',
      title: `YOLO11 Scene Reports — ${totalPhotos} Photo${totalPhotos > 1 ? 's' : ''}`,
      body: `AI-analysed photos received from ${photoZones.map(z => z.barangay).join(', ')}. Scene classification data enhances situation confidence.`,
    })
  }

  return insights
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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

function MetricCard({ label, value, color }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function InsightCard({ insight, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="glass rounded-xl p-3.5 border"
      style={{ borderColor: `${insight.color}35` }}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-xl shrink-0 mt-0.5">{insight.icon}</span>
        <div>
          <p className="text-xs font-bold mb-1" style={{ color: insight.color }}>
            {insight.title}
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">{insight.body}</p>
        </div>
      </div>
    </motion.div>
  )
}

function ZoneBar({ zone, rank, isExpanded, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.04 }}
    >
      <button type="button" onClick={onToggle} className="w-full text-left group">
        <div className="flex items-center gap-3 py-2.5 px-1 hover:bg-[rgba(255,255,255,0.03)] rounded-xl transition-colors">
          <span className="text-[11px] font-black w-5 text-right shrink-0"
            style={{ color: zone.tagColor }}>{rank}</span>

          <div className="w-36 xl:w-44 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-white truncate">{zone.barangay}</span>
              {zone.isSurging && <Zap size={10} className="text-[#f97316] shrink-0" />}
            </div>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${zone.tagColor}20`, color: zone.tagColor }}
            >
              {zone.tag}
            </span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-2.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${zone.widthPct}%`,
                  background: zone.tagColor,
                  boxShadow: `0 0 8px ${zone.tagColor}50`,
                }}
              />
            </div>
            <span className="text-xs font-black shrink-0"
              style={{ color: zone.tagColor, minWidth: '28px', textAlign: 'right' }}>
              {zone.total}
            </span>
          </div>

          <ChevronDown
            size={13}
            className="text-slate-500 shrink-0 transition-transform"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
          />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="mx-1 mb-2 rounded-xl p-3 border text-xs space-y-2"
              style={{ background: `${zone.tagColor}08`, borderColor: `${zone.tagColor}25` }}
            >
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Total SOS',  value: zone.total,         color: '#00d4ff' },
                  { label: 'Unrescued',  value: zone.unrescued,     color: zone.tagColor },
                  { label: 'Critical',   value: zone.criticalCount,  color: '#ef4444' },
                  { label: 'Avg Score',  value: zone.avgScore,       color: '#f59e0b' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="font-black text-base" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[9px] text-slate-500 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {zone.isSurging && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(249,115,22,0.15)] border border-[rgba(249,115,22,0.3)] text-[#f97316] font-medium">
                    ⚡ Surging — {zone.recentCount} new in 30 min
                  </span>
                )}
                {zone.photoCount > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.15)] border border-[rgba(139,92,246,0.3)] text-violet-300 font-medium">
                    🤖 {zone.photoCount} YOLO11 photo report{zone.photoCount > 1 ? 's' : ''}
                  </span>
                )}
                {zone.rescued > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[#22c55e] font-medium">
                    ✓ {zone.rescued} rescued
                  </span>
                )}
              </div>

              <div className="pt-1 border-t border-[rgba(255,255,255,0.06)]">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5 font-semibold">
                  🤖 AI Recommendation
                </p>
                <p className="text-[10px] text-slate-200 leading-relaxed">{zone.recommendation}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component — Analytics + AI Situational Awareness merged
// ─────────────────────────────────────────────────────────────────────────────

export function AdminAnalytics() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality

  // Shared SOS data — feeds both Analytics charts and AI zone analysis
  const [reports,      setReports]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [syncing,      setSyncing]      = useState(false)
  const [offlineMode,  setOfflineMode]  = useState(!navigator.onLine)
  const [snapshotAge,  setSnapshotAge]  = useState(null)
  const [expandedZone, setExpandedZone] = useState(null)

  const load = async () => {
    setSyncing(true)
    try {
      const res = await api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
      setReports(res)
      setOfflineMode(false)
      setSnapshotAge(null)
    } catch {
      try {
        const cached = await db.getCachedReports()
        if (cached.length) {
          setReports(cached)
          setOfflineMode(true)
          const ts = Number(localStorage.getItem('cc-snapshot-ts') ?? 0)
          setSnapshotAge(ts || null)
        }
      } catch { /* no cache */ }
    }
    setLoading(false)
    setSyncing(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const goOnline  = () => { setOfflineMode(false); load() }
    const goOffline = () => setOfflineMode(true)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // AI-derived data
  const zones    = useMemo(() => analyzeZones(reports), [reports])
  const insights = useMemo(() => generateInsights(zones), [zones])

  // Analytics chart data (inline derivations from `reports`)
  const statusData = [
    { name: 'Rescued',  value: reports.filter(r => r.rescue_status === 'rescued').length,  color: '#22c55e' },
    { name: 'En Route', value: reports.filter(r => r.rescue_status === 'en_route').length, color: '#00d4ff' },
    { name: 'Pending',  value: reports.filter(r => !r.rescue_status || r.rescue_status === 'pending').length, color: '#ef4444' },
  ]

  const priorityData = [
    { range: 'Critical (80+)', count: reports.filter(r => (r.ai_priority_score ?? 0) >= 80).length, color: '#ef4444' },
    { range: 'High (60-79)',   count: reports.filter(r => { const s = r.ai_priority_score ?? 0; return s >= 60 && s < 80 }).length, color: '#f97316' },
    { range: 'Moderate (40)', count: reports.filter(r => { const s = r.ai_priority_score ?? 0; return s >= 40 && s < 60 }).length, color: '#f59e0b' },
    { range: 'Low (<40)',      count: reports.filter(r => (r.ai_priority_score ?? 50) < 40).length, color: '#22c55e' },
  ]

  const timeData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const label   = DAYS[d.getDay()]
    const dateStr = d.toISOString().slice(0, 10)
    const dayRows = reports.filter(r => r.created_at?.slice(0, 10) === dateStr)
    return { day: label, verified: dayRows.filter(r => r.is_verified).length, guest: dayRows.filter(r => !r.is_verified).length }
  })

  const verifiedRate = reports.length ? Math.round(reports.filter(r => r.is_verified).length / reports.length * 100) : 0
  const guestRatio   = reports.length ? Math.round(reports.filter(r => !r.is_verified).length / reports.length * 100) : 0

  // AI display helpers
  const snapshotLabel = snapshotAge
    ? (() => {
        const mins = Math.round((Date.now() - snapshotAge) / 60000)
        return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`
      })()
    : null

  const clusterCount   = zones.filter(z => z.tag === 'CRITICAL CLUSTER').length
  const surgeCount     = zones.filter(z => z.isSurging).length
  const totalUnrescued = zones.reduce((s, z) => s + z.unrescued, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      <Brain size={16} className="mr-2 animate-pulse" /> Loading analytics…
    </div>
  )

  return (
    <>

      {/* Offline banner */}
      {offlineMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
          <WifiOff size={13} className="shrink-0" />
          <span>
            Offline mode — using locally cached SOS data.
            {snapshotLabel && <> Snapshot from <strong>{snapshotLabel}</strong>.</>}
          </span>
          <button onClick={load}
            className="ml-auto flex items-center gap-1 text-amber-300 hover:text-white transition-colors">
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      <div className="p-4 space-y-4">

        {/* ── SECTION A: Analytics ──────────────────────────────────────────── */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Victim Status pie */}
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

          {/* AI Priority histogram */}
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

        {/* Reports Over Time */}
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
          <MetricCard label="Total Reports"  value={reports.length}     color="#00d4ff" />
        </div>

        {/* Spam indicator */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Spam / False Report Indicator</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#f59e0b]"
                style={{ width: `${guestRatio}%` }} />
            </div>
            <span className="text-sm font-bold text-[#f59e0b]">{guestRatio}%</span>
            <span className="text-xs text-slate-500">guest reports</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Ratio below 60% is acceptable. High guest ratio may indicate spam activity.</p>
        </GlassCard>

        {/* ── SECTION B: AI-Assisted Situational Awareness ─────────────────── */}

        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI-Assisted Situational Awareness</span>
          <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
        </div>

        {/* Brain header + refresh */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={18} className="text-violet-400" />
              <h2 className="text-sm font-black text-white">AI-Assisted Situational Awareness</h2>
            </div>
            <p className="text-[11px] text-slate-400">
              Aggregating {reports.length} SOS report{reports.length !== 1 ? 's' : ''} across {zones.length} barangay{zones.length !== 1 ? 's' : ''} · {muni ?? 'All municipalities'}
            </p>
          </div>
          <NeonButton size="sm" variant="ghost" onClick={load} loading={syncing}>
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            <span className="ml-1.5">Refresh</span>
          </NeonButton>
        </div>

        {/* 4 stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Total Zones',       value: zones.length,   icon: MapPin,        color: '#00d4ff' },
            { label: 'Critical Clusters', value: clusterCount,   icon: AlertTriangle,  color: '#ef4444' },
            { label: 'Surge Zones',       value: surgeCount,     icon: TrendingUp,     color: '#f97316' },
            { label: 'Awaiting Rescue',   value: totalUnrescued, icon: Users,          color: '#f59e0b' },
          ].map(s => (
            <div key={s.label}
              className="glass rounded-xl p-3 border border-[rgba(255,255,255,0.06)] flex items-center gap-3">
              <s.icon size={20} style={{ color: s.color }} className="shrink-0" />
              <div>
                <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {zones.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center border border-[rgba(255,255,255,0.06)]">
            <Eye size={28} className="text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No SOS reports received yet</p>
            <p className="text-xs text-slate-600 mt-1">Situational analysis will appear as reports come in</p>
          </div>
        )}

        {zones.length > 0 && (
          <>
            {/* ── SECTION C: Zone Analysis ─────────────────────────────────── */}

            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
                  SOS Cluster Map — By Barangay
                </p>
                <p className="text-[10px] text-slate-500">Tap any zone to expand</p>
              </div>

              <div className="flex items-center gap-3 px-1 mb-2">
                <span className="text-[9px] text-slate-600 uppercase w-5 text-right shrink-0">#</span>
                <span className="text-[9px] text-slate-600 uppercase w-36 xl:w-44 shrink-0">Barangay</span>
                <span className="text-[9px] text-slate-600 uppercase flex-1">SOS Volume</span>
                <span className="text-[9px] text-slate-600 uppercase shrink-0 w-4" />
              </div>

              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {zones.map((zone, i) => (
                  <ZoneBar
                    key={zone.barangay}
                    zone={zone}
                    rank={i + 1}
                    isExpanded={expandedZone === zone.barangay}
                    onToggle={() => setExpandedZone(
                      expandedZone === zone.barangay ? null : zone.barangay
                    )}
                  />
                ))}
              </div>
            </GlassCard>

            {/* Legend */}
            <div className="glass rounded-xl px-4 py-3 flex flex-wrap gap-x-5 gap-y-2">
              {[
                { tag: 'CRITICAL CLUSTER', color: '#ef4444', desc: '8+ SOS or 50%+ Critical' },
                { tag: 'SURGE ZONE',       color: '#f97316', desc: '3+ reports in 30 min' },
                { tag: 'HIGH RISK',        color: '#f59e0b', desc: '3+ SOS or avg score ≥65' },
                { tag: 'ACTIVE',           color: '#22c55e', desc: '1–2 SOS, standard response' },
              ].map(l => (
                <div key={l.tag} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: l.color }}>{l.tag}</span>
                  <span className="text-[10px] text-slate-500">— {l.desc}</span>
                </div>
              ))}
            </div>

            {/* ── SECTION D: AI Insights ───────────────────────────────────── */}

            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI Insights</span>
              <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
            </div>

            {/* AI engine notice */}
            <div className="glass rounded-xl px-4 py-3 border border-[rgba(139,92,246,0.2)] flex items-center gap-3">
              <div>
                <p className="text-xs font-semibold text-violet-300">AI Analysis Engine — Offline</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Insights are generated locally from aggregated SOS data. No cloud connectivity required.
                  Analysis updates in real-time as new reports arrive.
                </p>
              </div>
            </div>

            {/* Insight cards */}
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <InsightCard key={insight.type} insight={insight} delay={i * 0.07} />
              ))}
            </div>

            {/* Rescue resource allocation */}
            <GlassCard>
              <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">
                Recommended Rescue Resource Allocation
              </p>
              <div className="space-y-2">
                {zones.filter(z => z.unrescued > 0).slice(0, 6).map((zone, i) => {
                  const resources =
                    zone.tag === 'CRITICAL CLUSTER' ? 'All available teams + medical unit' :
                    zone.tag === 'SURGE ZONE'       ? '2–3 rescue teams + standby unit' :
                    zone.tag === 'HIGH RISK'        ? '1–2 rescue teams' :
                                                      '1 rescue team'
                  return (
                    <div key={zone.barangay}
                      className="flex items-center gap-3 py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <span className="text-xs font-black w-5 text-right shrink-0"
                        style={{ color: zone.tagColor }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{zone.barangay}</p>
                        <p className="text-[10px] text-slate-500">{zone.unrescued} unrescued · {zone.tag}</p>
                      </div>
                      <p className="text-[10px] text-slate-300 text-right shrink-0 max-w-[140px] leading-tight">
                        {resources}
                      </p>
                    </div>
                  )
                })}
              </div>
            </GlassCard>

            {/* Evacuation priorities */}
            <GlassCard>
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">
                Potential Evacuation Priorities
              </p>
              <div className="space-y-1.5">
                {[...zones]
                  .sort((a, b) => b.evacScore - a.evacScore)
                  .filter(z => z.unrescued > 0)
                  .slice(0, 5)
                  .map((zone, i) => (
                    <div key={zone.barangay} className="flex items-center gap-3">
                      <span className="text-xs font-black w-5 text-right shrink-0 text-violet-400">{i + 1}</span>
                      <div className="flex-1 h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-[#00d4ff]"
                          style={{ width: `${Math.round((zone.evacScore / zones[0].evacScore) * 100)}%` }} />
                      </div>
                      <div className="min-w-[100px] text-right">
                        <p className="text-xs font-semibold text-white">{zone.barangay}</p>
                        <p className="text-[10px] text-slate-500">{zone.unrescued} people</p>
                      </div>
                    </div>
                  ))}
              </div>
            </GlassCard>
          </>
        )}

      </div>
    </>
  )
}
