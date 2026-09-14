import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip as MapTooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { AlertTriangle, CheckCircle, Building2, Users, RefreshCw, CalendarDays } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { StatCard } from '../../components/ui/StatCard'
import { NeonButton } from '../../components/ui/NeonButton'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { MUNICIPALITY_BOUNDS, MUNICIPALITY_PSGC } from '../../lib/philippineLocations'

const COLORS = {
  RED:   { fill: 'rgba(239,68,68,0.07)',  stroke: '#ef4444' },
  AMBER: { fill: 'rgba(245,158,11,0.07)', stroke: '#f59e0b' },
  GREEN: { fill: 'rgba(34,197,94,0.07)',  stroke: '#22c55e' },
}

const PIN_COLORS = { RED: '#ef4444', AMBER: '#f59e0b', GREEN: '#22c55e' }

const municipalityPin = (color) => L.divIcon({
  className: '',
  html: `<svg width="20" height="26" viewBox="0 0 20 26" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 16 10 16s10-8.5 10-16C20 4.48 15.52 0 10 0z"
      fill="${color}" stroke="white" stroke-width="1.5" opacity="0.92"/>
    <circle cx="10" cy="10" r="3.5" fill="white" opacity="0.85"/>
  </svg>`,
  iconSize:   [20, 26],
  iconAnchor: [10, 26],
})

// ── Daily stats history — persisted in localStorage, survives refreshes ────────
const DAILY_HISTORY_KEY = 'pd-daily-stats-history'
const todayStr = () => new Date().toISOString().slice(0, 10)           // YYYY-MM-DD
const isToday  = (ts) => {
  try { return Boolean(ts) && new Date(ts).toISOString().slice(0, 10) === todayStr() }
  catch { return false }
}
const loadDailyHistory = () => {
  try { return JSON.parse(localStorage.getItem(DAILY_HISTORY_KEY) ?? '[]') } catch { return [] }
}
const saveDailyHistory = (arr) => {
  try { localStorage.setItem(DAILY_HISTORY_KEY, JSON.stringify(arr.slice(0, 90))) } catch {}
}

export function ProvincialDashboard() {
  const { scope } = useAuthStore()
  const [selected, setSelected] = useState(null)
  const [sosData, setSosData]   = useState([])
  const [syncing,      setSyncing]      = useState(false)
  const [showHistory,  setShowHistory]  = useState(false)
  const [dailyHistory, setDailyHistory] = useState(() => loadDailyHistory())

  const prov = scope?.province

  const sync = async () => {
    if (!prov) return
    setSyncing(true)
    try {
      const rows = await api.get(`/sos?province=${encodeURIComponent(prov)}`)
      setSosData(rows)
      // Snapshot today's stats for daily history
      const todayOnly = rows.filter(r => isToday(r.timestamp ?? r.created_at))
      const reportingToday = new Set(todayOnly.map(r => r.municipality).filter(Boolean)).size
      const snap = {
        date:      todayStr(),
        label:     new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }),
        total:     todayOnly.length,
        critical:  todayOnly.filter(r => r.priority === 'CRITICAL').length,
        rescued:   todayOnly.filter(r => r.rescue_status === 'rescued').length,
        reporting: reportingToday,
        savedAt:   Date.now(),
      }
      const hist = loadDailyHistory()
      const next = [snap, ...hist.filter(h => h.date !== snap.date)]
      saveDailyHistory(next)
      setDailyHistory(next)
      // Persist snapshot to local MySQL (non-critical — localStorage is the fallback)
      try { await api.post('/province_reports', { ...snap, province: prov }) } catch { /* offline or XAMPP down */ }
    } catch {}
    setSyncing(false)
  }

  useEffect(() => { sync() }, [prov])

  // Merge live SOS counts with known municipality boundaries
  const municipalities = useMemo(() => {
    const map = {}
    // Start all known boundaries at zero
    MUNICIPALITY_BOUNDS.forEach(m => {
      const psgc = MUNICIPALITY_PSGC[m.name]
      const lat  = psgc?.lat ?? (m.coords.length ? (m.coords[0][0] + m.coords[2][0]) / 2 : null)
      const lng  = psgc?.lng ?? (m.coords.length ? (m.coords[0][1] + m.coords[2][1]) / 2 : null)
      map[m.name] = { name: m.name, lat, lng, total: 0, critical: 0, rescued: 0 }
    })
    // Overlay live SOS data
    sosData.forEach(r => {
      const name = r.municipality ?? 'Unknown'
      if (!map[name]) map[name] = { name, coords: [], total: 0, critical: 0, rescued: 0 }
      map[name].total++
      if (r.priority === 'CRITICAL') map[name].critical++
      if (r.rescue_status === 'rescued') map[name].rescued++
    })
    return Object.values(map).map(m => ({
      ...m,
      severity: m.critical > 0 ? 'RED' : m.total > 0 ? 'AMBER' : 'GREEN',
    }))
  }, [sosData])

  const todayReports = useMemo(
    () => sosData.filter(r => isToday(r.timestamp ?? r.created_at)),
    [sosData]
  )
  const todayReportingMunis = useMemo(
    () => new Set(todayReports.map(r => r.municipality).filter(Boolean)).size,
    [todayReports]
  )

  return (
    <SuperAdminLayout title="Provincial Dashboard">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        <div className="flex-1 min-h-[400px]">
          <MapContainer center={[9.75, 125.85]} zoom={9} style={{ height: '100%', background: '#0a1628' }} zoomControl>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            {municipalities.filter(m => m.lat && m.lng).map(m => (
              <Marker
                key={m.name}
                position={[m.lat, m.lng]}
                icon={municipalityPin(PIN_COLORS[m.severity])}
                eventHandlers={{ click: () => setSelected(m) }}
              >
                <MapTooltip sticky>
                  <div className="text-xs font-semibold">{m.name}</div>
                  <div className="text-xs">
                    {m.total} SOS · {m.critical} critical · {m.rescued} rescued
                  </div>
                </MapTooltip>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 glass border-t lg:border-t-0 lg:border-l border-[rgba(255,255,255,0.08)] flex flex-col overflow-hidden">

          {/* Province Summary — today's daily stats with history */}
          <div className="p-3 border-b border-[rgba(255,255,255,0.08)]">
            {/* Header row */}
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Province Summary</p>
                <p className="text-[10px] text-slate-600">
                  Today · {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowHistory(v => !v)}
                  title="Daily report history"
                  className={`p-1.5 rounded-lg transition-all ${
                    showHistory
                      ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff]'
                      : 'text-slate-500 hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)]'
                  }`}
                >
                  <CalendarDays size={12} />
                </button>
                <NeonButton size="sm" variant="ghost" onClick={sync} loading={syncing}>
                  <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                </NeonButton>
              </div>
            </div>

            {/* Today's stat cards */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <StatCard label="SOS Today"  value={todayReports.length}
                icon={Users}         color="#00d4ff" className="!p-2.5 !gap-0.5 !rounded-xl" />
              <StatCard label="Critical"   value={todayReports.filter(r => r.priority === 'CRITICAL').length}
                icon={AlertTriangle} color="#ef4444" className="!p-2.5 !gap-0.5 !rounded-xl" />
              <StatCard label="Rescued"    value={todayReports.filter(r => r.rescue_status === 'rescued').length}
                icon={CheckCircle}   color="#22c55e" className="!p-2.5 !gap-0.5 !rounded-xl" />
              <StatCard label="Reporting"  value={todayReportingMunis}
                icon={Building2}     color="#8b5cf6" className="!p-2.5 !gap-0.5 !rounded-xl" />
            </div>

            {/* Daily history panel — collapsible */}
            {showHistory && (
              <div className="border-t border-[rgba(255,255,255,0.06)] pt-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  📅 Daily Report History
                </p>
                {dailyHistory.length === 0 ? (
                  <p className="text-[10px] text-slate-600 py-1">
                    No history yet — data saves automatically on each sync.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {dailyHistory.map(h => {
                      const isCurrentDay = h.date === todayStr()
                      return (
                        <div key={h.date}
                          className={`rounded-lg px-2.5 py-2 flex items-center justify-between border ${
                            isCurrentDay
                              ? 'bg-[rgba(0,212,255,0.06)] border-[rgba(0,212,255,0.2)]'
                              : 'glass border-[rgba(255,255,255,0.05)]'
                          }`}>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-slate-200 truncate">
                              {h.label ?? h.date}
                            </p>
                            <p className="text-[9px] text-slate-500">
                              {isCurrentDay ? 'Today — live' : h.date}
                            </p>
                          </div>
                          <div className="flex gap-3 shrink-0 ml-2">
                            <div className="text-center">
                              <p className="text-xs font-black text-[#00d4ff]">{h.total}</p>
                              <p className="text-[9px] text-slate-600">SOS</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-black text-[#ef4444]">{h.critical}</p>
                              <p className="text-[9px] text-slate-600">Crit</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-black text-[#22c55e]">{h.rescued}</p>
                              <p className="text-[9px] text-slate-600">Res.</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {selected && (
            <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
              <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-2">Selected: {selected.name}</p>
              <div className="space-y-1 text-xs text-slate-400">
                <p>Total SOS: <span className="text-white font-medium">{selected.total}</span></p>
                <p>Critical: <span className="text-[#ef4444] font-medium">{selected.critical}</span></p>
                <p>Rescued: <span className="text-[#22c55e] font-medium">{selected.rescued}</span></p>
              </div>
            </div>
          )}

          <div className="flex-1 p-4 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Legend</p>
            {Object.entries(PIN_COLORS).map(([k, color]) => (
              <div key={k} className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full border-2 border-white/70 shrink-0"
                  style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                <span className="text-xs text-slate-400">
                  {k === 'RED' ? 'Active Emergency' : k === 'AMBER' ? 'Moderate Incidents' : 'Stable'}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </SuperAdminLayout>
  )
}
