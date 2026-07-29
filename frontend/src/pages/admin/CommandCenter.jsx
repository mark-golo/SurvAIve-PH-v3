import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Users, AlertTriangle, CheckCircle, Radio, RefreshCw, Shield } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { StatCard } from '../../components/ui/StatCard'
import { NeonButton } from '../../components/ui/NeonButton'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { fetchWeather, getWeatherLabel } from '../../lib/weatherService'
import { predictDepletion } from '../../lib/resourcePredictor'

const COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', SAFE: '#22c55e' }

const MUNICIPALITY_CENTERS = {
  // Surigao del Norte — Siargao Island
  'Del Carmen':               [9.842, 126.076, 13],
  'Dapa':                     [9.758, 126.057, 13],
  'General Luna':             [9.798, 126.165, 13],
  'Santa Monica':             [9.905, 126.083, 13],
  'Pilar':                    [9.872, 126.043, 13],
  'Burgos':                   [9.880, 126.062, 13],
  'San Isidro':               [9.921, 125.977, 13],
  'San Benito':               [9.983, 126.083, 13],
  'Socorro':                  [9.617, 125.967, 13],
  // Surigao del Norte — mainland
  'Surigao City':             [9.783, 125.497, 13],
  'Alegria':                  [9.753, 125.396, 13],
  'Bacuag':                   [9.683, 125.617, 13],
  'Claver':                   [9.583, 125.733, 12],
  'Gigaquit':                 [9.567, 125.683, 13],
  'Mainit':                   [9.517, 125.533, 13],
  'Malimono':                 [9.467, 125.467, 13],
  'Placer':                   [9.617, 125.600, 13],
  'San Francisco (Anao-Aon)':[9.617, 125.383, 13],
  'Sison':                    [9.467, 125.567, 13],
  'Tagana-an':                [9.500, 125.500, 13],
  'Tubod':                    [9.600, 125.367, 13],
  // Cebu
  'Cebu City':                [10.316, 123.885, 13],
  'Mandaue':                  [10.324, 123.922, 13],
  'Lapu-Lapu':                [10.310, 124.008, 13],
  'Talisay':                  [10.245, 123.846, 13],
  'Danao':                    [10.522, 124.026, 13],
  'Carcar':                   [10.106, 123.640, 13],
  'Toledo':                   [10.377, 123.638, 13],
  // Leyte
  'Tacloban City':            [11.244, 125.004, 13],
  'Ormoc City':               [11.006, 124.608, 13],
  'Baybay City':              [10.675, 124.800, 12],
  'Palo':                     [11.157, 124.991, 13],
  'Tanauan':                  [11.112, 125.017, 13],
  'Dulag':                    [10.963, 125.027, 13],
  // Iloilo
  'Iloilo City':              [10.720, 122.562, 13],
  'Passi City':               [11.103, 122.640, 13],
  'Oton':                     [10.693, 122.478, 13],
  'Pavia':                    [10.781, 122.542, 13],
  'Santa Barbara':            [10.830, 122.534, 13],
  'Leganes':                  [10.780, 122.580, 13],
  // Metro Manila
  'Quezon City':              [14.676, 121.044, 13],
  'Manila':                   [14.599, 120.984, 13],
  'Makati':                   [14.556, 121.024, 13],
  'Pasig':                    [14.587, 121.061, 13],
  'Taguig':                   [14.521, 121.079, 13],
  'Caloocan':                 [14.657, 120.968, 13],
  'Marikina':                 [14.652, 121.103, 13],
  'Parañaque':                [14.480, 121.016, 13],
  // Davao del Sur
  'Davao City':               [7.190, 125.455, 12],
  'Digos City':               [6.750, 125.357, 13],
  'Hagonoy':                  [6.533, 125.350, 13],
  'Padada':                   [6.633, 125.233, 13],
  'Sta. Cruz':                [6.900, 125.383, 13],
  'Sulop':                    [6.700, 125.217, 13],
  // Laguna
  'Calamba City':             [14.212, 121.165, 13],
  'Santa Rosa City':          [14.312, 121.111, 13],
  'San Pedro City':           [14.361, 121.021, 13],
  'Biñan City':               [14.340, 121.081, 13],
  'Cabuyao City':             [14.273, 121.124, 13],
  'Bay':                      [14.181, 121.289, 13],
  'Los Baños':                [14.167, 121.241, 13],
  // Cavite
  'Bacoor City':              [14.459, 120.937, 13],
  'Imus City':                [14.430, 120.936, 13],
  'Dasmariñas City':          [14.330, 120.936, 13],
  'General Trias City':       [14.387, 120.882, 13],
  'Trece Martires City':      [14.283, 120.867, 13],
  'Kawit':                    [14.438, 120.900, 13],
  // Bulacan
  'Malolos City':             [14.844, 120.811, 13],
  'San Jose del Monte City':  [14.813, 121.044, 13],
  'Meycauayan City':          [14.735, 120.960, 13],
  'Marilao':                  [14.757, 120.950, 13],
  'Bocaue':                   [14.799, 120.931, 13],
  'Balagtas':                 [14.820, 120.907, 13],
  // Batangas
  'Batangas City':            [13.756, 121.058, 13],
  'Lipa City':                [13.942, 121.163, 13],
  'Tanauan City':             [14.086, 121.150, 13],
  'Santo Tomas':              [14.106, 121.140, 13],
  'Taal':                     [13.883, 120.933, 13],
  'Lemery':                   [13.867, 120.900, 13],
  // Negros Occidental
  'Bacolod City':             [10.676, 122.955, 13],
  'Bago City':                [10.533, 122.833, 13],
  'Cadiz City':               [10.950, 123.300, 13],
  'Escalante City':           [10.833, 123.500, 13],
  'Himamaylan City':          [10.100, 122.867, 13],
  'Kabankalan City':          [9.983,  122.817, 13],
  // Pangasinan
  'Dagupan City':             [16.043, 120.333, 13],
  'San Carlos City':          [15.927, 120.350, 13],
  'Urdaneta City':            [15.976, 120.571, 13],
  'Alaminos City':            [16.155, 119.980, 13],
  'Lingayen':                 [16.015, 120.233, 13],
  'Calasiao':                 [16.017, 120.360, 13],
  // Nueva Ecija
  'Cabanatuan City':          [15.487, 120.967, 13],
  'Gapan City':               [15.308, 120.945, 13],
  'Palayan City':             [15.550, 121.083, 13],
  'Science City of Muñoz':   [15.717, 120.900, 13],
  'Talavera':                 [15.583, 120.917, 13],
  'Guimba':                   [15.667, 120.767, 13],
  // Pampanga
  'Angeles City':             [15.149, 120.589, 13],
  'San Fernando City':        [15.029, 120.690, 13],
  'Mabalacat City':           [15.218, 120.572, 13],
  'Arayat':                   [15.150, 120.767, 13],
  'Candaba':                  [15.100, 120.833, 13],
  'Guagua':                   [14.967, 120.633, 13],
  // Zamboanga del Sur
  'Pagadian City':            [7.827,  123.437, 13],
  'Zamboanga City':           [6.910,  122.073, 12],
  'Molave':                   [8.083,  123.483, 13],
  'Dumingag':                 [8.150,  123.350, 13],
  'Tambulig':                 [8.083,  123.550, 13],
  // Misamis Oriental
  'Cagayan de Oro City':      [8.482,  124.647, 13],
  'Gingoog City':             [8.817,  125.083, 13],
  'El Salvador City':         [8.567,  124.517, 13],
  'Villanueva':               [8.583,  124.783, 13],
  'Tagoloan':                 [8.533,  124.750, 13],
}

const pinIcon = (color, verified) => L.divIcon({
  className: '',
  html: `<div style="width:${verified ? 14 : 12}px;height:${verified ? 14 : 12}px;background:${color};
         border:${verified ? '2px solid white' : '2px dashed rgba(255,255,255,0.5)'};border-radius:50%;
         box-shadow:0 0 10px ${color}"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
})

const responderMarkerIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#00d4ff;border:3px solid white;border-radius:50%;
         box-shadow:0 0 12px #00d4ff"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
})

const shelterIcon = (status) => {
  const color = status === 'open' ? '#22c55e' : status === 'full' ? '#f59e0b' : '#9ca3af'
  return L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;background:${color};border:2px solid white;border-radius:5px;
           display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px ${color};font-size:11px">⛺</div>`,
    iconSize: [20, 20], iconAnchor: [10, 10],
  })
}

function FlyTo({ pos }) {
  const map = useMap()
  useEffect(() => { if (pos) map.flyTo(pos, 16, { duration: 1.2 }) }, [pos])
  return null
}

export function CommandCenter() {
  const { scope } = useAuthStore()
  const [stats, setStats] = useState({ total: 0, critical: 0, rescued: 0, nodes: 0, unverified: 0 })
  const [syncing, setSyncing] = useState(false)
  const [reports, setReports] = useState([])
  const [centers, setCenters] = useState([])
  const [activeResponders, setActiveResponders] = useState([])
  const [selectedSOS, setSelectedSOS] = useState(null)
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState(false)

  const muni = scope?.municipality
  const muniGeo   = muni ? (MUNICIPALITY_CENTERS[muni] ?? null) : null
  const mapCenter = muniGeo ? [muniGeo[0], muniGeo[1]] : [9.852, 126.073]
  const mapZoom   = muniGeo ? muniGeo[2] : 12

  useEffect(() => {
    if (muniGeo) {
      fetchWeather(muniGeo[0], muniGeo[1])
        .then(setWeather)
        .catch(() => setWeatherError(true))
    }
  }, [])

  const weatherBonus = weather?.scoreBonus ?? 0
  const adjustedReports = useMemo(() => {
    if (weatherBonus === 0) return reports
    return reports.map(r => {
      const mins      = Number(r.minutes_ago) || 0
      const timeBonus = mins >= 240 ? 20 : mins >= 120 ? 15 : mins >= 60 ? 10 : mins >= 30 ? 5 : 0
      const display   = Math.min((r.ai_priority_score ?? 50) + timeBonus + weatherBonus, 99)
      return {
        ...r,
        priority: display >= 80 ? 'CRITICAL' : display >= 60 ? 'HIGH' : display >= 40 ? 'MODERATE' : 'LOW',
      }
    })
  }, [reports, weatherBonus])

  const criticalCount = adjustedReports.filter(r => r.priority === 'CRITICAL').length

  const resourceForecast = useMemo(
    () => predictDepletion(adjustedReports, activeResponders),
    [adjustedReports, activeResponders]
  )

  useEffect(() => {
    api.get(muni ? `/evacuation_centers?municipality=${encodeURIComponent(muni)}` : '/evacuation_centers')
      .then(rows => setCenters(rows))
      .catch(() => setCenters([]))
  }, [])

  useEffect(() => {
    let q = supabase.from('responders')
      .select('id,name,unit_name,assigned_zone,lat,lng,last_seen_at,duty_status,municipality')
      .eq('duty_status', 'on_duty')
      .not('lat', 'is', null)
    if (muni) q = q.eq('municipality', muni)
    q.then(({ data }) => setActiveResponders(data ?? []))

    const channel = supabase.channel('cc-responder-locations')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'responders' },
        payload => {
          const r = payload.new
          if (muni && r.municipality !== muni) return
          if (r.duty_status === 'on_duty' && r.lat && r.lng) {
            setActiveResponders(prev => {
              const idx = prev.findIndex(x => x.id === r.id)
              if (idx === -1) return [...prev, r]
              const next = [...prev]
              next[idx] = { ...next[idx], lat: r.lat, lng: r.lng, last_seen_at: r.last_seen_at }
              return next
            })
          } else {
            setActiveResponders(prev => prev.filter(x => x.id !== r.id))
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => { sync() }, [])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
      setReports(res)
      setStats(prev => ({
        total: res.length,
        critical: res.filter(r => r.priority === 'CRITICAL').length,
        rescued: res.filter(r => r.rescue_status === 'rescued').length,
        nodes: prev.nodes,
        unverified: res.filter(r => !r.is_verified).length,
      }))
    } catch (err) {
      console.error('[CommandCenter] SOS fetch failed:', err)
    }
    setSyncing(false)
  }

  return (
    <AdminLayout title="Command Center">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Map — main content */}
        <div className="flex-1 min-h-[400px]">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', background: '#0a1628' }}
            zoomControl={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            {selectedSOS && <FlyTo pos={selectedSOS} />}
            {adjustedReports.filter(r => r.lat && r.lng).map(r => (
              <Marker key={r.id} position={[r.lat, r.lng]} icon={pinIcon(COLORS[r.priority], r.is_verified ?? r.verified)}>
                <Popup>
                  <div className="bg-[#0f172a] text-white text-xs p-3 rounded-xl min-w-[160px]">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={r.priority} />
                      {(r.is_verified ?? r.verified)
                        ? <span className="text-[10px] text-[#00d4ff]">✓ Verified</span>
                        : <span className="text-[10px] text-[#f59e0b]">Guest</span>
                      }
                    </div>
                    <p className="font-semibold">{r.name ?? 'Anonymous'}</p>
                    <p className="text-slate-400">{r.barangay}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {/* Heatmap approximation via circles */}
            {adjustedReports.filter(r => r.lat && r.lng && ['CRITICAL', 'HIGH'].includes(r.priority)).map(r => (
              <Circle key={`circle-${r.id}`} center={[r.lat, r.lng]} radius={150}
                pathOptions={{ color: `${COLORS[r.priority]}40`, fillColor: `${COLORS[r.priority]}15`, fillOpacity: 1, weight: 1 }} />
            ))}
            {/* Evacuation centers */}
            {centers.map(c => (
              <Marker key={`ec-${c.id}`} position={[c.lat, c.lng]} icon={shelterIcon(c.status)}>
                <Popup>
                  <div className="bg-[#0f172a] text-white text-xs p-3 rounded-xl min-w-[170px]">
                    <p className="font-bold text-[#22c55e] mb-1">⛺ {c.name}</p>
                    <p className="text-slate-400 mb-0.5">Brgy. {c.barangay}</p>
                    {c.capacity && <p className="text-slate-400 mb-0.5">Capacity: {c.capacity}</p>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'open' ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' :
                      c.status === 'full' ? 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]' :
                                           'bg-[rgba(107,114,128,0.15)] text-[#9ca3af]'
                    }`}>{c.status.toUpperCase()}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
            {/* Active responders */}
            {activeResponders.map(r => (
              <Marker key={`resp-${r.id}`} position={[r.lat, r.lng]} icon={responderMarkerIcon()}>
                <Popup>
                  <div className="bg-[#0f172a] text-white text-xs p-2 rounded min-w-[140px]">
                    <p className="font-bold text-[#00d4ff]">{r.name}</p>
                    <p className="text-slate-400">{r.unit_name ?? '—'} · {r.assigned_zone ?? '—'}</p>
                    {r.last_seen_at && (
                      <p className="text-slate-500 text-[10px] mt-1">
                        Last seen: {new Date(r.last_seen_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar stats */}
        <aside className="w-full lg:w-72 xl:w-80 glass border-t lg:border-t-0 lg:border-l border-[rgba(255,255,255,0.08)] flex flex-col overflow-hidden">

          {/* 1 — Live Stats */}
          <div className="p-3 border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Stats</p>
              <NeonButton size="sm" variant="ghost" onClick={sync} loading={syncing}>
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
              </NeonButton>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <StatCard label="Total SOS"  value={stats.total}   icon={Users}         color="#00d4ff" className="!p-2.5 !gap-0.5 !rounded-xl" />
              <StatCard label="Critical"   value={criticalCount} icon={AlertTriangle} color="#ef4444" className="!p-2.5 !gap-0.5 !rounded-xl" />
              <StatCard label="Rescued"    value={stats.rescued} icon={CheckCircle}   color="#22c55e" className="!p-2.5 !gap-0.5 !rounded-xl" />
              <StatCard label="Mesh Nodes" value={stats.nodes}   icon={Radio}         color="#8b5cf6" className="!p-2.5 !gap-0.5 !rounded-xl" />
            </div>
          </div>

          {/* 2 — Weather Risk Widget */}
          {(weather || weatherError) && (
            <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.08)]">
              {weather && (
                <div className={`glass rounded-xl p-3 border ${
                  weather.riskLevel === 'EXTREME'  ? 'border-[rgba(239,68,68,0.4)]'  :
                  weather.riskLevel === 'HIGH'     ? 'border-[rgba(249,115,22,0.4)]' :
                  weather.riskLevel === 'MODERATE' ? 'border-[rgba(245,158,11,0.3)]' :
                                                     'border-[rgba(255,255,255,0.08)]'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                      Weather Risk · {muni ?? 'Area'}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      weather.riskLevel === 'EXTREME'  ? 'bg-[rgba(239,68,68,0.2)] text-[#ef4444]'  :
                      weather.riskLevel === 'HIGH'     ? 'bg-[rgba(249,115,22,0.2)] text-[#f97316]' :
                      weather.riskLevel === 'MODERATE' ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]' :
                                                         'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                    }`}>{weather.riskLevel}</span>
                  </div>
                  <p className="text-xs text-white font-medium">{getWeatherLabel(weather.weatherCode)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {weather.rainfall.toFixed(1)} mm/h · {weather.windSpeed.toFixed(0)} km/h wind
                  </p>
                  {weather.scoreBonus > 0 && (
                    <p className="text-[10px] text-[#f59e0b] mt-1 font-medium">
                      ⚠ Scores elevated +{weather.scoreBonus}
                    </p>
                  )}
                </div>
              )}
              {weatherError && (
                <div className="glass rounded-xl p-2.5 border border-[rgba(255,255,255,0.05)]">
                  <p className="text-[10px] text-slate-600">Weather data unavailable</p>
                </div>
              )}
            </div>
          )}

          {/* 3 — Resource Forecast Widget */}
          <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.08)]">
            {(() => {
              const f = resourceForecast
              const color =
                f.alertLevel === 'OVERWHELMED' ? '#ef4444' :
                f.alertLevel === 'AT_RISK'     ? '#f97316' :
                f.alertLevel === 'ELEVATED'    ? '#f59e0b' : '#22c55e'
              const pct = Math.min(f.loadRatio * 100, 100)
              return (
                <div className="glass rounded-xl p-3 border" style={{ borderColor: `${color}40` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Resource Forecast</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}20`, color }}>
                      {f.alertLevel}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mb-1">
                    {f.activeLoad} active / {f.capacity} capacity · {f.onDutyCount} on duty
                  </p>
                  {f.alertLevel === 'OVERWHELMED' && (
                    <p className="text-[10px] font-bold text-[#ef4444]">At capacity — request reinforcements</p>
                  )}
                  {f.alertLevel === 'AT_RISK' && (
                    <p className="text-[10px] font-bold text-[#f97316]">
                      {f.minutesToOverwhelm != null ? `Overwhelmed in ~${f.minutesToOverwhelm} min` : 'Threshold approaching'}
                      {f.surging ? ' — surge' : ''}
                    </p>
                  )}
                  {f.alertLevel === 'ELEVATED' && (
                    <p className="text-[10px] text-[#f59e0b]">Load elevated — monitor rate</p>
                  )}
                  {f.alertLevel === 'NORMAL' && (
                    <p className="text-[10px] text-[#22c55e]">Capacity sufficient</p>
                  )}
                </div>
              )
            })()}
          </div>

          {/* 4 — Recent Reports */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recent Reports</p>
            <div className="space-y-1.5">
              {adjustedReports.map(r => {
                const isSelected = selectedSOS && r.lat === selectedSOS[0] && r.lng === selectedSOS[1]
                return (
                  <div
                    key={r.id}
                    onClick={() => r.lat && r.lng && setSelectedSOS([r.lat, r.lng])}
                    className={`rounded-xl p-2 flex items-center gap-2 transition-all ${
                      r.lat && r.lng ? 'cursor-pointer hover:bg-[rgba(255,255,255,0.05)]' : ''
                    } ${isSelected
                      ? 'bg-[rgba(0,212,255,0.12)] border border-[rgba(0,212,255,0.3)]'
                      : 'glass'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[r.priority], boxShadow: `0 0 6px ${COLORS[r.priority]}` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{r.name ?? 'Anonymous'}</p>
                      <p className="text-[10px] text-slate-500">{r.barangay}</p>
                    </div>
                    <StatusBadge status={r.priority} className="shrink-0 text-[9px] !py-0.5 !px-1.5" />
                  </div>
                )
              })}
            </div>
          </div>

          {/* 5 — Unverified Reports */}
          <div className="p-3 border-t border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Unverified Reports</p>
              <span className="text-xs font-black text-[#f59e0b]">{stats.unverified}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="h-1.5 rounded-full flex-1 bg-slate-700">
                <div className="h-full rounded-full bg-[#f59e0b]" style={{ width: stats.total ? `${(stats.unverified / stats.total) * 100}%` : '0%' }} />
              </div>
              <span className="text-[10px] text-slate-500">{stats.total ? Math.round((stats.unverified / stats.total) * 100) : 0}% guest</span>
            </div>
          </div>

          {/* 6 — Map Legend */}
          <div className="p-3 border-t border-[rgba(255,255,255,0.08)]">
            <div className="flex flex-wrap gap-2.5">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-white/50" style={{ background: '#ef4444' }} />
                <span className="text-[10px] text-slate-400">Verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-white/50" style={{ background: '#f97316' }} />
                <span className="text-[10px] text-slate-400">Guest</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-[#22c55e] flex items-center justify-center text-[9px]">⛺</div>
                <span className="text-[10px] text-slate-400">Evacuation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-white bg-[#00d4ff]" style={{ boxShadow: '0 0 6px #00d4ff' }} />
                <span className="text-[10px] text-slate-400">Responder</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
