import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, TrendingUp, AlertTriangle, Users, Shield,
  RefreshCw, WifiOff, Zap, Eye, ChevronRight, ChevronDown,
  MapPin, Target, Clock,
} from 'lucide-react'
import { assessDelay, tierColor, tierLabel, formatMsShort } from '../../lib/ai/erdiEngine'
import { fetchWeather } from '../../lib/weatherService'

import { NeonButton } from '../../components/ui/NeonButton'
import { GlassCard } from '../../components/ui/GlassCard'
import api, { logActivity } from '../../lib/api'
import { getNetworkOnline, probeBackend, invalidateProbeCache, onNetworkChange } from '../../lib/capacitor'
import { db } from '../../lib/db'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { analyzeZones, generateInsights, detectAnomalies, computeSafetyAggregation } from '../../lib/ai/situationalAnalytics'
import { clusterSOS } from '../../lib/kmeans'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const AI_CATEGORY_LABELS = {
  mdrrmo: 'Disaster (MDRRMO)', hospital: 'Medical', bfp: 'Fire (BFP)',
  pnp: 'Crime / Security (PNP)', pcg: 'Maritime (PCG)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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
      {/* Zone row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-3 py-2.5 px-1 hover:bg-[rgba(255,255,255,0.03)] rounded-xl transition-colors">
          {/* Rank */}
          <span className="text-[11px] font-black w-5 text-right shrink-0"
            style={{ color: zone.tagColor }}>{rank}</span>

          {/* Barangay name + tag */}
          <div className="w-36 xl:w-44 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-white truncate">{zone.barangay}</span>
              {zone.isSurging && (
                <Zap size={10} className="text-[#f97316] shrink-0" />
              )}
            </div>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${zone.tagColor}20`, color: zone.tagColor }}
            >
              {zone.tag}
            </span>
          </div>

          {/* Bar */}
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
            <span className="text-xs font-black shrink-0" style={{ color: zone.tagColor, minWidth: '28px', textAlign: 'right' }}>
              {zone.total}
            </span>
          </div>

          {/* Expand chevron */}
          <ChevronDown
            size={13}
            className="text-slate-500 shrink-0 transition-transform"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
          />
        </div>
      </button>

      {/* Expanded detail */}
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
              {/* Stats row */}
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

              {(zone.reviewCounts.confirmed + zone.reviewCounts.corrected + zone.reviewCounts.rejected) > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[9px] pt-0.5">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider">AI Review:</span>
                  {zone.reviewCounts.confirmed > 0 && <span className="text-[#22c55e]">✓ {zone.reviewCounts.confirmed} confirmed</span>}
                  {zone.reviewCounts.corrected > 0 && <span className="text-blue-400">✎ {zone.reviewCounts.corrected} corrected</span>}
                  {zone.reviewCounts.rejected > 0 && <span className="text-[#ef4444]">✕ {zone.reviewCounts.rejected} rejected</span>}
                  <span className="text-slate-600">{zone.reviewCounts.unreviewed} unreviewed</span>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {zone.isSurging && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(249,115,22,0.15)] border border-[rgba(249,115,22,0.3)] text-[#f97316] font-medium">
                    ⚡ Surging — {zone.recentCount} new in 30 min
                  </span>
                )}
                {zone.rescued > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[#22c55e] font-medium">
                    ✓ {zone.rescued} rescued
                  </span>
                )}
              </div>

              {/* AI Recommendation */}
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
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SituationalAwareness() {
  const { scope } = useAuthStore()
  const [reports, setReports]       = useState([])
  const [constituents, setConstituents] = useState([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [snapshotAge, setSnapshotAge] = useState(null)
  const [expandedZone, setExpandedZone] = useState(null)
  const [activeTab, setActiveTab]   = useState('zones') // 'zones' | 'insights' | 'delay' | 'safety'
  const [delayWeather, setDelayWeather] = useState(null)
  const [onDutyCount,  setOnDutyCount]  = useState(0)
  const [acknowledgedAnomalies, setAcknowledgedAnomalies] = useState(() => {
    try {
      const stored = localStorage.getItem('survAIve-acknowledged-anomalies')
      return new Set(stored ? JSON.parse(stored) : [])
    } catch { return new Set() }
  })
  const [closedSections, setClosedSections] = useState(new Set())
  const [lastFetchedAt, setLastFetchedAt] = useState(null)

  const muni = scope?.municipality

  function handleAcknowledgeAnomaly(anomaly) {
    setAcknowledgedAnomalies(prev => {
      const next = new Set([...prev, anomaly.id])
      try { localStorage.setItem('survAIve-acknowledged-anomalies', JSON.stringify([...next])) } catch {}
      return next
    })
    logActivity('POST', 'anomaly_ack', 'ai_anomaly', null, {
      anomalyId: anomaly.id,
      text: anomaly.text,
      evidence: anomaly.evidence,
    })
  }

  function toggleSection(key) {
    setClosedSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const load = async () => {
    setSyncing(true)
    try {
      const res = await api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
      setReports(res)
      setOfflineMode(false)
      setSnapshotAge(null)
      setLastFetchedAt(new Date())
      // Fetch constituents for Community Safety aggregation (non-blocking)
      api.get(muni ? `/constituents?municipality=${encodeURIComponent(muni)}` : '/constituents')
        .then(rows => setConstituents(Array.isArray(rows) ? rows : []))
        .catch(() => {})
    } catch {
      // Fall back to IndexedDB snapshot
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
    let q = supabase.from('responders').select('id', { count: 'exact', head: true }).eq('duty_status', 'on_duty')
    if (muni) q = q.eq('municipality', muni)
    q.then(({ count }) => setOnDutyCount(count ?? 0)).catch(() => {})
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`sa-sos-rescue-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_reports' }, () => load())
      .on('postgres_changes', { event: 'UPDATE',  schema: 'public', table: 'sos_reports' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    const goOnline = async () => {
      const reachable = await probeBackend()
      if (reachable) { invalidateProbeCache(); setOfflineMode(false); load() }
    }
    const goOffline = () => setOfflineMode(true)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    let capacitorHandle = null
    const capSub = onNetworkChange(async connected => {
      if (connected) {
        const reachable = await probeBackend()
        if (reachable) { invalidateProbeCache(); setOfflineMode(false); load() }
      } else {
        setOfflineMode(true)
      }
    })
    capSub.then(h => { capacitorHandle = h })
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
      capacitorHandle?.remove()
    }
  }, [])

  // Auto-recover every 30 s while offline
  useEffect(() => {
    if (!offlineMode) return
    const id = setInterval(async () => {
      const reachable = await probeBackend()
      if (reachable) { invalidateProbeCache(); setOfflineMode(false); load() }
    }, 30_000)
    return () => clearInterval(id)
  }, [offlineMode])

  // Bridge: sync immediately when AdminLayout's Realtime fires a new SOS
  useEffect(() => {
    const h = () => load()
    window.addEventListener('sos:new-insert', h)
    return () => window.removeEventListener('sos:new-insert', h)
  }, [])

  // Online polling fallback — refreshes situational picture every 30 s
  useEffect(() => {
    if (offlineMode) return
    const id = setInterval(() => load(), 30_000)
    return () => clearInterval(id)
  }, [offlineMode])

  const zones    = useMemo(() => analyzeZones(reports), [reports])
  const insights = useMemo(() => generateInsights(zones), [zones])
  const anomalies  = useMemo(() => detectAnomalies(reports), [reports])
  const safetyAgg  = useMemo(() => computeSafetyAggregation(constituents), [constituents])
  const clusters   = useMemo(() => clusterSOS(reports), [reports])

  // Fetch weather for Delay Intel tab using first available report with coords
  useEffect(() => {
    if (!reports.length) return
    const ref = reports.find(r => r.lat && r.lng)
    if (!ref) return
    fetchWeather(ref.lat, ref.lng)
      .then(w => setDelayWeather(w))
      .catch(() => {})
  }, [reports])

  const agencyCtx = useMemo(() => ({
    onDutyCount,
    activeLoad: reports.filter(
      r => !['rescued', 'cannot_reach'].includes(r.rescue_status)
    ).length,
  }), [onDutyCount, reports])

  // ERDI: assess each active report (no per-report events available in admin view)
  const delayAssessments = useMemo(() => {
    return reports
      .filter(r => !['rescued', 'cannot_reach'].includes(r.rescue_status))
      .map(r => ({ report: r, assessment: assessDelay(r, [], null, delayWeather, agencyCtx) }))
  }, [reports, delayWeather, agencyCtx])

  const delayTierCounts = useMemo(() => {
    const counts = { CRITICAL_DELAY: 0, DELAYED: 0, MINOR_DELAY: 0, ON_TRACK: 0 }
    delayAssessments.forEach(({ assessment }) => { counts[assessment.tier] = (counts[assessment.tier] ?? 0) + 1 })
    return counts
  }, [delayAssessments])

  const snapshotLabel = snapshotAge
    ? (() => {
        const mins = Math.round((Date.now() - snapshotAge) / 60000)
        return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`
      })()
    : null

  // Summary counts
  const clusterCount = zones.filter(z => z.tag === 'CRITICAL CLUSTER').length
  const surgeCount   = zones.filter(z => z.isSurging).length
  const totalUnrescued = zones.reduce((s, z) => s + z.unrescued, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      <Brain size={16} className="mr-2 animate-pulse" /> Analysing SOS data…
    </div>
  )

  return (
    <>

      {/* Offline banner */}
      {offlineMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
          <WifiOff size={13} className="shrink-0" />
          <span>
            Offline mode — analysing locally cached SOS data.
            {snapshotLabel && <> Snapshot from <strong>{snapshotLabel}</strong>.</>}
          </span>
          <button onClick={load}
            className="ml-auto flex items-center gap-1 text-amber-300 hover:text-white transition-colors">
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={18} className="text-violet-400" />
              <h2 className="text-sm font-black text-white">AI-Assisted Situational Analytics</h2>
            </div>
            <p className="text-[11px] text-slate-400">
              Aggregating {reports.length} SOS report{reports.length !== 1 ? 's' : ''} across {zones.length} barangay{zones.length !== 1 ? 's' : ''} · {muni ?? 'All municipalities'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {!offlineMode && lastFetchedAt && (
              <span className="text-[10px] text-slate-500">
                Last refreshed {lastFetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <NeonButton size="sm" variant="ghost" onClick={load} loading={syncing}>
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              <span className="ml-1.5">Refresh</span>
            </NeonButton>
          </div>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Total Zones',       value: zones.length,   icon: MapPin,       color: '#00d4ff' },
            { label: 'Critical Clusters', value: clusterCount,   icon: AlertTriangle, color: '#ef4444' },
            { label: 'Surge Zones',       value: surgeCount,     icon: TrendingUp,    color: '#f97316' },
            { label: 'Awaiting Rescue',   value: totalUnrescued, icon: Users,         color: '#f59e0b' },
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
            {/* Tab toggle */}
            <div className="glass rounded-xl p-1 flex gap-1">
              {[
                { key: 'zones',    label: 'Zone Analysis',    icon: Target  },
                { key: 'insights', label: 'AI Insights',      icon: Brain   },
                { key: 'delay',    label: 'Delay Intel',      icon: Clock   },
                { key: 'safety',   label: 'Community Safety', icon: Shield  },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.key
                      ? 'bg-[rgba(139,92,246,0.2)] text-violet-300 border border-[rgba(139,92,246,0.3)]'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Zone Analysis tab */}
            {activeTab === 'zones' && (
              <motion.div key="zones-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <GlassCard>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
                      SOS Cluster Map — By Barangay
                    </p>
                    <p className="text-[10px] text-slate-500">Tap any zone to expand</p>
                  </div>

                  {/* Column headers */}
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

                {/* K-means++ geographic cluster map — §4.2 GIS presentation */}
                <div className="mt-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-1">GPS Cluster Map</p>
                  {clusters.length === 0 ? (
                    <div className="glass rounded-xl p-4 text-center border border-[rgba(255,255,255,0.06)]">
                      <p className="text-xs text-slate-500">No GPS coordinates available for spatial clustering.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)]" style={{ height: 240 }}>
                      <MapContainer
                        bounds={clusters.map(c => [c.centroid[0], c.centroid[1]])}
                        boundsOptions={{ padding: [30, 30] }}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl
                        scrollWheelZoom={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                        {clusters.map((c, i) => {
                          const color = c.priority === 'CRITICAL' ? '#ef4444'
                                      : c.priority === 'HIGH'     ? '#f59e0b'
                                      : c.priority === 'MODERATE' ? '#3b82f6'
                                      :                             '#22c55e'
                          return (
                            <CircleMarker
                              key={i}
                              center={[c.centroid[0], c.centroid[1]]}
                              radius={Math.min(24, 6 + c.count * 2)}
                              pathOptions={{ color, fillColor: color, fillOpacity: 0.45, weight: 2 }}
                            >
                              <Popup>
                                <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 130 }}>
                                  <strong style={{ color }}>{c.priority}</strong><br />
                                  {c.count} report{c.count !== 1 ? 's' : ''} · avg score {c.avgScore}
                                  {c.criticalCount > 0 && <><br />{c.criticalCount} CRITICAL</>}
                                  {c.barangays.length > 0 && <><br /><span style={{ color: '#64748b' }}>{c.barangays.join(', ')}</span></>}
                                  {c.categories && Object.keys(c.categories).length > 0 && (
                                    <><br /><span style={{ color: '#94a3b8', fontSize: 10 }}>
                                      {Object.entries(c.categories).sort((a, b) => b[1] - a[1]).map(([cat, n]) => `${n} ${AI_CATEGORY_LABELS[cat] ?? cat}`).join(' · ')}
                                    </span></>
                                  )}
                                </div>
                              </Popup>
                            </CircleMarker>
                          )
                        })}
                      </MapContainer>
                    </div>
                  )}
                </div>

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
                <p className="text-[10px] text-slate-500 mt-1 italic px-1">
                  Zone classifications are derived from AI-scored SOS reports and may not reflect verified ground conditions. Confirm with field personnel before acting.
                </p>
                </div>
              </motion.div>
            )}

            {/* AI Insights tab */}
            {activeTab === 'insights' && (
              <motion.div
                key="insights-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
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

                {/* Statistical anomaly alerts — §4.6 (with human verification) */}
                {anomalies.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.15)]">
                    <span className="text-green-500 text-[10px]">●</span>
                    <p className="text-[11px] text-[rgba(34,197,94,0.8)]">No anomalies detected in current reporting window.</p>
                  </div>
                ) : anomalies.map((anomaly) => {
                  const isAnomalyOpen = !closedSections.has(anomaly.id)
                  return (
                    <div key={anomaly.id} className="glass rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)] overflow-hidden">
                      {/* Header */}
                      <button
                        type="button"
                        onClick={() => toggleSection(anomaly.id)}
                        className="w-full text-left px-3.5 pt-3.5 pb-2 flex items-start gap-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-bold text-red-400">Anomaly Detected</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${anomaly.severity === 'high' ? 'bg-[rgba(239,68,68,0.15)] text-red-400' : 'bg-[rgba(245,158,11,0.15)] text-amber-400'}`}>
                              {anomaly.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{anomaly.text}</p>
                        </div>
                        <ChevronDown
                          size={14}
                          className="text-slate-500 shrink-0 mt-0.5 transition-transform"
                          style={{ transform: isAnomalyOpen ? 'rotate(180deg)' : 'none' }}
                        />
                      </button>

                      {/* Acknowledge */}
                      <div className="px-3.5 pb-2.5">
                        {!acknowledgedAnomalies.has(anomaly.id) ? (
                          <button
                            onClick={() => handleAcknowledgeAnomaly(anomaly)}
                            className="text-[10px] px-2 py-1 rounded-lg bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] text-amber-400 hover:bg-[rgba(245,158,11,0.2)] transition-colors">
                            Acknowledge
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500">✓ Acknowledged</span>
                        )}
                      </div>

                      {/* Expandable viz */}
                      <AnimatePresence>
                        {isAnomalyOpen && (
                          <motion.div
                            key="anomaly-viz"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3.5 pb-3.5 border-t border-[rgba(239,68,68,0.15)] space-y-2.5">
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-2.5 font-semibold">Evidence</p>
                              <p className="text-[10px] text-slate-400 leading-relaxed">{anomaly.evidence}</p>

                              {/* Surge viz */}
                              {'lastHour' in anomaly && (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="glass rounded-lg p-2.5 text-center">
                                      <p className="text-lg font-black text-red-400">{anomaly.lastHour}</p>
                                      <p className="text-[9px] text-slate-500">Last Hour</p>
                                    </div>
                                    <div className="glass rounded-lg p-2.5 text-center">
                                      <p className="text-lg font-black text-slate-400">{anomaly.trailingAvg.toFixed(1)}</p>
                                      <p className="text-[9px] text-slate-500">Avg / Hr (5h)</p>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                                      <span>Surge ratio</span>
                                      <span>{anomaly.trailingAvg > 0 ? `${(anomaly.lastHour / anomaly.trailingAvg).toFixed(1)}× baseline` : 'No baseline'}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-700"
                                        style={{ width: `${Math.min(anomaly.trailingAvg > 0 ? Math.round((anomaly.lastHour / (anomaly.lastHour + anomaly.trailingAvg * 2)) * 100) : 100, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Stale viz */}
                              {'unresolvedOld' in anomaly && (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="glass rounded-lg p-2.5 text-center">
                                      <p className="text-lg font-black text-amber-400">{anomaly.unresolvedOld}</p>
                                      <p className="text-[9px] text-slate-500">Stale &gt;2h</p>
                                    </div>
                                    <div className="glass rounded-lg p-2.5 text-center">
                                      <p className="text-lg font-black text-slate-400">{anomaly.totalActive}</p>
                                      <p className="text-[9px] text-slate-500">Total Active</p>
                                    </div>
                                    <div className="glass rounded-lg p-2.5 text-center">
                                      <p className="text-lg font-black text-amber-400">
                                        {anomaly.totalActive > 0 ? Math.round(anomaly.unresolvedOld / anomaly.totalActive * 100) : 0}%
                                      </p>
                                      <p className="text-[9px] text-slate-500">Stale Rate</p>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                                      <span>Stale proportion</span>
                                      <span>{anomaly.unresolvedOld} of {anomaly.totalActive} reports</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-700"
                                        style={{ width: `${anomaly.totalActive > 0 ? Math.round(anomaly.unresolvedOld / anomaly.totalActive * 100) : 0}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}

                {insights.map((insight, i) => {
                  if (insight.type === 'priority') {
                    const isOpen = !closedSections.has('priority')
                    const zone = insight.zone
                    return (
                      <div key="priority" className="glass rounded-xl border overflow-hidden" style={{ borderColor: `${insight.color}35` }}>
                        <button
                          type="button"
                          onClick={() => toggleSection('priority')}
                          className="w-full text-left px-3.5 py-3 flex items-start gap-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold mb-1" style={{ color: insight.color }}>{insight.title}</p>
                            <p className="text-xs text-slate-300 leading-relaxed">{insight.body}</p>
                          </div>
                          <ChevronDown
                            size={14}
                            className="text-slate-500 shrink-0 mt-0.5 transition-transform"
                            style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                          />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              key="priority-viz"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3.5 pb-3.5 border-t space-y-3" style={{ borderColor: `${insight.color}20` }}>
                                <div className="grid grid-cols-4 gap-2 pt-3">
                                  {[
                                    { label: 'Total SOS', value: zone.total,        color: '#00d4ff' },
                                    { label: 'Critical',  value: zone.criticalCount, color: '#ef4444' },
                                    { label: 'High',      value: zone.highCount,     color: '#f59e0b' },
                                    { label: 'Avg Score', value: zone.avgScore,      color: '#8b5cf6' },
                                  ].map(s => (
                                    <div key={s.label} className="glass rounded-lg p-2 text-center">
                                      <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                                      <p className="text-[9px] text-slate-500 leading-tight">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {(zone.rescued + zone.unrescued) > 0 && (
                                  <div>
                                    <div className="flex justify-between text-[9px] mb-1.5">
                                      <span className="text-green-400">{zone.rescued} rescued</span>
                                      <span className="text-red-400">{zone.unrescued} unrescued</span>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden flex">
                                      <div
                                        className="h-full bg-green-500 transition-all duration-700"
                                        style={{ width: `${Math.round(zone.rescued / (zone.rescued + zone.unrescued) * 100)}%` }}
                                      />
                                      <div className="h-full bg-red-500 flex-1" />
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-1 text-right">
                                      {Math.round(zone.rescued / (zone.rescued + zone.unrescued) * 100)}% resolved
                                    </p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  }

                  if (insight.type === 'evacuation') {
                    const isOpen = !closedSections.has('evacuation')
                    const evacZones = insight.evacZones ?? []
                    const maxScore = Math.max(...evacZones.map(z => z.evacScore), 1)
                    return (
                      <div key="evacuation" className="glass rounded-xl border overflow-hidden" style={{ borderColor: `${insight.color}35` }}>
                        <button
                          type="button"
                          onClick={() => toggleSection('evacuation')}
                          className="w-full text-left px-3.5 py-3 flex items-start gap-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold mb-1" style={{ color: insight.color }}>{insight.title}</p>
                            <p className="text-xs text-slate-300 leading-relaxed">{insight.body}</p>
                          </div>
                          <ChevronDown
                            size={14}
                            className="text-slate-500 shrink-0 mt-0.5 transition-transform"
                            style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                          />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              key="evac-viz"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3.5 pb-3.5 border-t pt-3 space-y-3" style={{ borderColor: `${insight.color}20` }}>
                                {evacZones.map((zone, idx) => (
                                  <div key={zone.barangay} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black w-4 text-right shrink-0 text-violet-400">{idx + 1}</span>
                                      <span className="text-xs font-semibold text-white flex-1 truncate">{zone.barangay}</span>
                                      <span className="text-[10px] text-red-400 shrink-0">{zone.unrescued} unrescued</span>
                                      {zone.criticalCount > 0 && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-red-400 shrink-0">
                                          {zone.criticalCount} CRIT
                                        </span>
                                      )}
                                      {zone.isSurging && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(249,115,22,0.15)] text-orange-400 shrink-0">⚡</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="w-4 shrink-0" />
                                      <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)]">
                                        <div
                                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700"
                                          style={{ width: `${Math.round(zone.evacScore / maxScore * 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-[9px] text-slate-500 w-16 text-right shrink-0">score {zone.evacScore}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  }

                  return <InsightCard key={insight.type} insight={insight} delay={i * 0.07} />
                })}

                {/* Rescue resource allocation table */}
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
              </motion.div>
            )}
            {/* Community Safety tab — §4.4 SAFE/UNSAFE/UNKNOWN aggregation */}
            {activeTab === 'safety' && (
              <motion.div key="safety-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="glass rounded-xl px-4 py-3 border border-[rgba(34,197,94,0.2)] flex items-center gap-3">
                  <Shield size={15} className="text-[#22c55e] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[#22c55e]">Community Safety Status</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Based on registered constituent records. SAFE = rescued · UNSAFE = SOS sent · UNKNOWN = no status reported.
                    </p>
                  </div>
                </div>

                <GlassCard>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider">
                      Safety by Barangay
                    </p>
                    {lastFetchedAt && (
                      <span className="text-[10px] text-slate-500">
                        as of {lastFetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {safetyAgg.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No constituent records found.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {safetyAgg.map(row => (
                        <div key={row.barangay} className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-white w-32 xl:w-40 shrink-0 truncate">
                            {row.barangay}
                          </span>
                          <div className="flex-1 h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden flex">
                            <div className="h-full bg-[#22c55e] transition-all duration-700"
                              style={{ width: `${(row.safe / row.total) * 100}%` }} />
                            <div className="h-full bg-[#ef4444] transition-all duration-700"
                              style={{ width: `${(row.unsafe / row.total) * 100}%` }} />
                            <div className="h-full bg-[rgba(255,255,255,0.1)] transition-all duration-700"
                              style={{ width: `${(row.unknown / row.total) * 100}%` }} />
                          </div>
                          <div className="flex gap-2 text-[10px] shrink-0">
                            <span className="text-[#22c55e] font-semibold">{row.safe} safe</span>
                            <span className="text-[#ef4444] font-semibold">{row.unsafe} unsafe</span>
                            <span className="text-slate-500">{row.unknown} unknown</span>
                            <span className="text-[9px] text-slate-600">{row.coveragePct}% rptd</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>

                {safetyAgg.length > 0 && (
                  <GlassCard>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: 'Total Constituents', value: safetyAgg.reduce((s, r) => s + r.total, 0), color: '#00d4ff' },
                        { label: 'UNSAFE (SOS sent)',  value: safetyAgg.reduce((s, r) => s + r.unsafe, 0), color: '#ef4444' },
                        { label: 'SAFE (Rescued)',     value: safetyAgg.reduce((s, r) => s + r.safe, 0), color: '#22c55e' },
                      ].map(s => (
                        <div key={s.label}>
                          <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
                          <p className="text-[10px] text-slate-500 leading-tight">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </motion.div>
            )}

            {/* Delay Intelligence tab */}
            {activeTab === 'delay' && (
              <motion.div key="delay-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {/* Notice */}
                <div className="glass rounded-xl px-4 py-3 border border-[rgba(0,212,255,0.2)] flex items-center gap-3">
                  <Clock size={15} className="text-[#00d4ff] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[#00d4ff]">Emergency Response Delay Intelligence (ERDI)</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Rule-based delay assessment for active incidents. Computed from priority baselines and elapsed stage times. Verify with field personnel.
                    </p>
                  </div>
                </div>

                {/* Tier summary counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { tier: 'CRITICAL_DELAY', count: delayTierCounts.CRITICAL_DELAY },
                    { tier: 'DELAYED',        count: delayTierCounts.DELAYED },
                    { tier: 'MINOR_DELAY',    count: delayTierCounts.MINOR_DELAY },
                    { tier: 'ON_TRACK',       count: delayTierCounts.ON_TRACK },
                  ].map(({ tier, count }) => (
                    <div key={tier}
                      className="glass rounded-xl p-3 border text-center"
                      style={{ borderColor: tierColor(tier) + '30', backgroundColor: tierColor(tier) + '08' }}
                    >
                      <p className="text-lg font-black" style={{ color: tierColor(tier) }}>{count}</p>
                      <p className="text-[9px] font-semibold mt-0.5" style={{ color: tierColor(tier) }}>
                        {tierLabel(tier).toUpperCase()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Critical / Delayed cases list */}
                {delayAssessments
                  .filter(({ assessment }) => assessment.tier === 'CRITICAL_DELAY' || assessment.tier === 'DELAYED')
                  .sort((a, b) => {
                    const tierOrder = { CRITICAL_DELAY: 0, DELAYED: 1 }
                    return (tierOrder[a.assessment.tier] ?? 2) - (tierOrder[b.assessment.tier] ?? 2)
                  })
                  .length === 0 ? (
                    <div className="glass rounded-xl p-6 text-center border border-[rgba(34,197,94,0.2)]">
                      <p className="text-sm font-semibold text-[#22c55e]">All active incidents are within baseline</p>
                      <p className="text-[10px] text-slate-500 mt-1">No significant delays detected at this time</p>
                    </div>
                  ) : (
                    <GlassCard>
                      <p className="text-xs font-semibold text-[#f97316] uppercase tracking-wider mb-3">Delayed Incidents</p>
                      <div className="space-y-3">
                        {delayAssessments
                          .filter(({ assessment }) => assessment.tier === 'CRITICAL_DELAY' || assessment.tier === 'DELAYED')
                          .sort((a, b) => {
                            const tierOrder = { CRITICAL_DELAY: 0, DELAYED: 1 }
                            return (tierOrder[a.assessment.tier] ?? 2) - (tierOrder[b.assessment.tier] ?? 2)
                          })
                          .slice(0, 10)
                          .map(({ report: r, assessment: a }) => (
                            <div key={r.id}
                              className="flex items-start gap-3 pb-3 border-b border-[rgba(255,255,255,0.05)] last:border-0"
                            >
                              <div
                                className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: tierColor(a.tier) }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-white truncate">{r.name ?? 'Unknown'}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                    style={{ color: tierColor(a.tier), backgroundColor: tierColor(a.tier) + '18' }}>
                                    {tierLabel(a.tier)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">{r.barangay} · {r.rescue_status?.replace('_', ' ')}</p>
                                {a.factors[0] && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 italic">{a.factors[0]?.label ?? a.factors[0]}</p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{a.recommendations?.admin}</p>
                              </div>
                              <span className="text-[10px] shrink-0" style={{ color: tierColor(a.tier) }}>
                                {r.minutes_ago != null ? `${r.minutes_ago}m` : '—'}
                              </span>
                            </div>
                          ))}
                      </div>
                    </GlassCard>
                  )
                }
              </motion.div>
            )}
          </>
        )}

      </div>
    </>
  )
}
