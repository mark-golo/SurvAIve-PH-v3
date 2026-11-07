import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Home, Map, Radio, Settings, MessageSquare, Navigation, AlertTriangle, Tent, LocateFixed, Route, Play, Square } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme } from '../../lib/victimTheme'

const EC_CACHE_KEY = 'ec-cache'

function computeRecommendationScore(center, victimPos, allCenters) {
  const safetyMap = { Safe: 100, 'At Risk': 50, Unverified: 25, Unsafe: 0 }
  const accessMap = { Accessible: 100, Limited: 50, Unverified: 25, Inaccessible: 0 }
  const Sa  = safetyMap[center.safety_status] ?? 25
  const Ac  = accessMap[center.accessibility_status] ?? 25
  const avail = Math.max(0, (center.capacity ?? 0) - (center.current_occupancy ?? 0))
  const C   = center.capacity > 0 ? (avail / center.capacity) * 100 : 0
  const dists = allCenters.filter(c => c.lat && c.lng)
    .map(c => haversineCoords(victimPos[0], victimPos[1], Number(c.lat), Number(c.lng)))
  const maxDist = Math.max(...dists, 1)
  const dist = haversineCoords(victimPos[0], victimPos[1], Number(center.lat), Number(center.lng))
  const D   = 100 - Math.min(100, (dist / maxDist) * 100)
  return (Sa * 0.35) + (C * 0.25) + (Ac * 0.20) + (D * 0.15)
}

function haversineCoords(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const DEFAULT_POS = [9.852, 126.073]

const NAV = [
  { icon: Home,          label: 'Home',     path: '/home'     },
  { icon: MessageSquare, label: 'SOS',      path: '/sos'      },
  { icon: Map,           label: 'Map',      path: '/map'      },
  { icon: Radio,         label: 'Mesh',     path: '/mesh'     },
  { icon: Settings,      label: 'Settings', path: '/settings' },
]

function haversine([lat1, lng1], [lat2, lng2]) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const userIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;position:relative">
    <div style="position:absolute;inset:0;background:#00d4ff;border:3px solid white;border-radius:50%;box-shadow:0 0 12px #00d4ff;z-index:2"></div>
    <div style="position:absolute;inset:-6px;border:2px solid rgba(0,212,255,0.4);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
  </div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
})

const shelterIcon = (isNearest, status) => {
  const color = status === 'open' ? '#22c55e' : status === 'full' ? '#f59e0b' : '#9ca3af'
  const border = isNearest ? '3px solid #fbbf24' : `2px solid ${color}`
  const glow = isNearest ? '0 0 14px #fbbf24, 0 0 6px #22c55e' : `0 0 8px ${color}`
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;background:${color};border:${border};border-radius:6px;
           display:flex;align-items:center;justify-content:center;box-shadow:${glow}">
             <span style="font-size:12px">⛺</span>
           </div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  })
}

function FlyTo({ pos }) {
  const map = useMap()
  useEffect(() => { if (pos) map.flyTo(pos, 15, { duration: 1.2 }) }, [pos])
  return null
}

function FlyToBounds({ line }) {
  const map = useMap()
  useEffect(() => {
    if (line?.length) map.fitBounds(L.latLngBounds(line), { padding: [40, 40] })
  }, [line])
  return null
}

function MapRefSetter({ mapRef }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map])
  return null
}

function FollowUser({ pos, active }) {
  const map = useMap()
  useEffect(() => {
    if (active && pos) map.flyTo(pos, 19, { animate: true, duration: 0.5 })
  }, [pos, active])
  return null
}

export function LocalMap() {
  const { scope } = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [userPos, setUserPos]     = useState(null)
  const [gpsError, setGpsError]   = useState(false)
  const [centers, setCenters]     = useState([])
  const [loading, setLoading]     = useState(true)

  // Smart Center Finder
  const [finderOpen, setFinderOpen]       = useState(false)
  const [recommendation, setRec]          = useState(null)
  const [finderLoading, setFinderLoading] = useState(false)
  const [isOffline, setIsOffline]         = useState(false)
  const [cacheTime, setCacheTime]         = useState(null)

  // In-app routing
  const [routeLine, setRouteLine]         = useState(null)
  const [routeTarget, setRouteTarget]     = useState(null)
  const [routeInfo, setRouteInfo]         = useState(null)
  const [routeLoading, setRouteLoading]   = useState(false)
  const [routeError, setRouteError]       = useState(null)

  // Map controls
  const mapRef         = useRef(null)
  const watchIdRef     = useRef(null)
  const routeLineRef   = useRef(null)
  const routeTargetRef = useRef(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [navError, setNavError]         = useState(null)

  const muni = scope?.municipality

  useEffect(() => {
    const url = muni ? `/evacuation_centers?municipality=${encodeURIComponent(muni)}` : '/evacuation_centers'
    api.get(url)
      .then(rows => {
        setCenters(Array.isArray(rows) ? rows : [])
        try { localStorage.setItem(EC_CACHE_KEY, JSON.stringify({ centers: rows, ts: Date.now() })) } catch {}
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem(EC_CACHE_KEY)
          if (raw) {
            const { centers: cached, ts } = JSON.parse(raw)
            setCenters(Array.isArray(cached) ? cached : [])
            setIsOffline(true)
            setCacheTime(new Date(ts).toLocaleString())
          }
        } catch {}
      })
      .finally(() => setLoading(false))
  }, [])

  function runFinder() {
    if (!userPos) return
    setFinderLoading(true)
    const eligible = centers.filter(c =>
      c.lat && c.lng &&
      !['Unsafe', 'Under Maintenance', 'Full'].includes(c.overall_status) &&
      c.accessibility_status !== 'Inaccessible')
    const scored = eligible.map(c => ({
      ...c,
      distKm: haversineCoords(userPos[0], userPos[1], Number(c.lat), Number(c.lng)),
      score:  computeRecommendationScore(c, userPos, centers),
    })).sort((a, b) => b.score - a.score)
    setRec({ top: scored[0] ?? null, alternatives: scored.slice(1, 4) })
    setFinderOpen(true)
    setFinderLoading(false)
  }

  async function navigateInApp(center) {
    if (!userPos) return
    setRouteLoading(true)
    setRouteError(null)
    setRouteLine(null); routeLineRef.current = null
    setRouteTarget(center); routeTargetRef.current = center
    try {
      const osrmUrl =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${userPos[1]},${userPos[0]};${center.lng},${center.lat}` +
        `?overview=full&geometries=geojson`
      const res  = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) })
      const data = await res.json()
      if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No route found')
      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
      const dist   = (data.routes[0].distance / 1000).toFixed(1)
      const dur    = Math.ceil(data.routes[0].duration / 60)
      setRouteLine(coords); routeLineRef.current = coords
      setRouteInfo({ distanceKm: dist, durationMin: dur })
    } catch {
      const fallback = [userPos, [Number(center.lat), Number(center.lng)]]
      setRouteLine(fallback); routeLineRef.current = fallback
      setRouteInfo(null)
      setRouteError('Live routing unavailable — showing straight-line path.')
    } finally {
      setRouteLoading(false)
    }
  }

  function clearRoute() {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
    setIsNavigating(false); setNavError(null)
    setRouteLine(null);   routeLineRef.current  = null
    setRouteTarget(null); routeTargetRef.current = null
    setRouteInfo(null); setRouteError(null)
  }

  function goToMyLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = [pos.coords.latitude, pos.coords.longitude]
        setUserPos(p)
        mapRef.current?.flyTo(p, 18, { duration: 1 })
      },
      () => mapRef.current?.flyTo(userPos ?? DEFAULT_POS, 15, { duration: 1 }),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  async function handleNavigate(center) {
    if (isNavigating && routeTargetRef.current?.id === center.id) {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setIsNavigating(false); setNavError(null)
      return
    }
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
    setIsNavigating(false)
    if (!navigator.geolocation) { setNavError('GPS not available'); return }
    await navigateInApp(center)
    setIsNavigating(true); setNavError(null)
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const p = [pos.coords.latitude, pos.coords.longitude]
        setUserPos(p)
        if (routeLineRef.current?.length) {
          const nearest = Math.min(...routeLineRef.current.map(([rlat, rlng]) =>
            haversineCoords(p[0], p[1], rlat, rlng) * 1000))
          if (nearest > 150 && routeTargetRef.current) navigateInApp(routeTargetRef.current)
        }
      },
      () => setNavError('GPS signal lost'),
      { enableHighAccuracy: true, maximumAge: 3000 }
    )
  }

  useEffect(() => () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError(true); return }
    navigator.geolocation.getCurrentPosition(
      pos => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      ()  => setGpsError(true),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const nearestId = userPos && centers.length
    ? centers.reduce((best, c) => {
        const d = haversine(userPos, [c.lat, c.lng])
        return d < best.dist ? { id: c.id, dist: d } : best
      }, { id: null, dist: Infinity }).id
    : null

  const nearestCenter = centers.find(c => c.id === nearestId)
  const nearestDist   = nearestCenter && userPos
    ? haversine(userPos, [nearestCenter.lat, nearestCenter.lng]).toFixed(2)
    : null

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="My Location & Evacuation Centers" subtitle="Tap a shelter for details" onBack />

      {/* Scrollable area: banners + map + center list */}
      <div className="flex-1 overflow-y-auto pb-nav">

      {/* GPS warning */}
      {gpsError && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#f59e0b] shrink-0" />
          <p className="text-xs text-[#f59e0b]">GPS unavailable — showing approximate location. Enable location access for accuracy.</p>
        </div>
      )}

      {/* Nearest shelter banner */}
      {nearestCenter && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] flex items-center gap-2">
          <Tent size={14} className="text-[#22c55e] shrink-0" />
          <p className="text-xs text-white">
            Nearest shelter: <span className="font-semibold text-[#22c55e]">{nearestCenter.name}</span>
            {nearestDist && <span className="text-slate-400"> — {nearestDist} km away</span>}
          </p>
        </div>
      )}

      {/* Map */}
      <div className="mx-4 mt-2 mb-2 relative rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)] h-[45vh] min-h-[280px]">
        <MapContainer
          center={userPos ?? DEFAULT_POS}
          zoom={14}
          style={{ height: '100%', background: '#0a1628' }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
          <MapRefSetter mapRef={mapRef} />
          <FollowUser pos={userPos} active={isNavigating} />
          {userPos && <FlyTo pos={userPos} />}

          {/* User position */}
          {userPos && (
            <Marker position={userPos} icon={userIcon()}>
              <Popup>
                <div className="bg-[#0f172a] text-white text-xs p-2 rounded-lg min-w-[130px]">
                  <p className="font-bold text-[#00d4ff] mb-1">📍 You are here</p>
                  <p className="text-slate-400">{userPos[0].toFixed(5)}, {userPos[1].toFixed(5)}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* GPS accuracy circle */}
          {userPos && (
            <Circle center={userPos} radius={50} pathOptions={{ color: '#00d4ff', fillColor: '#00d4ff', fillOpacity: 0.06, weight: 1 }} />
          )}

          {/* Route polyline */}
          {routeLine && (
            <>
              <Polyline positions={routeLine} pathOptions={{ color: '#00d4ff', weight: 8, opacity: 0.15 }} />
              <Polyline positions={routeLine} pathOptions={{ color: '#00d4ff', weight: 3, opacity: 0.9, dashArray: '10 6' }} />
              <FlyToBounds line={routeLine} />
            </>
          )}

          {/* Evacuation centers */}
          {centers.map(c => {
            const isNearest = c.id === nearestId
            const dist = userPos ? haversine(userPos, [c.lat, c.lng]).toFixed(2) : null
            return (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={shelterIcon(isNearest, c.status)}>
                <Popup>
                  <div className="bg-[#0f172a] text-white text-xs p-3 rounded-xl min-w-[180px]">
                    {isNearest && <p className="text-[10px] font-bold text-[#fbbf24] uppercase tracking-wider mb-1">⭐ Nearest Shelter</p>}
                    <p className="font-bold text-[#22c55e] mb-1">{c.name}</p>
                    <p className="text-slate-400 mb-0.5">Brgy. {c.barangay}</p>
                    {c.capacity && <p className="text-slate-400 mb-0.5">Capacity: {c.capacity} persons</p>}
                    {c.contact_number && <p className="text-slate-400 mb-0.5">Contact: {c.contact_number}</p>}
                    {dist && <p className="text-[#00d4ff] font-medium mb-1">{dist} km away</p>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'open'   ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' :
                      c.status === 'full'   ? 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]' :
                                              'bg-[rgba(107,114,128,0.15)] text-[#9ca3af]'
                    }`}>{c.status.toUpperCase()}</span>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {/* Nav error toast */}
      {navError && (
        <div className="mx-4 mb-1 px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)]">
          <p className="text-[11px] text-[#ef4444]">{navError}</p>
        </div>
      )}

      {/* Route info banner */}
      {(routeTarget || routeLoading) && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.25)] space-y-1">
          {routeLoading
            ? <p className="text-xs text-[#00d4ff]">Calculating route…</p>
            : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#00d4ff] flex items-center gap-1.5">
                    <Navigation size={12} /> Navigating to {routeTarget?.name}
                    {isNavigating && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#22c55e] font-semibold ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />LIVE
                      </span>
                    )}
                  </p>
                  <button onClick={clearRoute} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">✕ Clear</button>
                </div>
                {routeInfo && (
                  <p className="text-[11px] text-slate-400">{routeInfo.distanceKm} km · ~{routeInfo.durationMin} min by road</p>
                )}
                {routeError && (
                  <p className="text-[11px] text-[#f59e0b]">{routeError}</p>
                )}
              </>
            )
          }
        </div>
      )}

      {/* Smart Center Finder */}
      <div className="px-4 pb-2 space-y-2">
        <button
          onClick={runFinder}
          disabled={finderLoading || !userPos}
          className="w-full py-3 rounded-xl bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.25)] text-[#00d4ff] font-semibold text-sm hover:bg-[rgba(0,212,255,0.16)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {finderLoading ? 'Evaluating centers…' : '📍 Find Nearest Safe Evacuation Center'}
        </button>

        {finderOpen && recommendation && (
          <div className="rounded-2xl border border-[rgba(0,212,255,0.2)] bg-[rgba(0,0,0,0.5)] p-4 space-y-3">
            {isOffline && (
              <div className="text-[11px] text-[#f59e0b] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-lg px-3 py-2">
                ⚠ Offline: showing last synced data ({cacheTime}). Actual conditions may have changed — verify before proceeding.
              </div>
            )}
            {recommendation.top ? (
              <>
                <p className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-wider">Recommended</p>
                <FinderCard center={recommendation.top} onShowRoute={navigateInApp}
                  onMyLocation={goToMyLocation} onNavigate={handleNavigate}
                  isNavigating={isNavigating} activeTargetId={routeTarget?.id} />
                {recommendation.alternatives.length > 0 && (
                  <>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider pt-1">Alternatives</p>
                    {recommendation.alternatives.map(c => (
                      <FinderCard key={c.id} center={c} onShowRoute={navigateInApp}
                        onMyLocation={goToMyLocation} onNavigate={handleNavigate}
                        isNavigating={isNavigating} activeTargetId={routeTarget?.id} compact />
                    ))}
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-[#f59e0b] text-center py-2">No suitable evacuation center found nearby. Contact emergency services immediately.</p>
            )}
            <button onClick={() => setFinderOpen(false)} className="text-[11px] text-slate-500 hover:text-slate-300 w-full text-center pt-1">Dismiss</button>
          </div>
        )}
      </div>

      {/* Center list */}
      <div className="px-4 pb-2 space-y-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">All Evacuation Centers</p>
        {loading
          ? <p className="text-xs text-slate-500">Loading centers…</p>
          : centers.map(c => {
              const isNearest = c.id === nearestId
              const dist = userPos ? haversine(userPos, [c.lat, c.lng]).toFixed(2) : null
              return (
                <div key={c.id} className={`glass rounded-xl p-3 flex items-center gap-3 border ${isNearest ? 'border-[rgba(251,191,36,0.4)]' : 'border-[rgba(34,197,94,0.15)]'}`}>
                  <Tent size={18} className={isNearest ? 'text-[#fbbf24]' : 'text-[#22c55e]'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-400">Brgy. {c.barangay} {dist ? `· ${dist} km` : ''}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    c.status === 'open' ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' :
                    c.status === 'full' ? 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]' :
                                         'bg-[rgba(107,114,128,0.15)] text-[#9ca3af]'
                  }`}>{c.status}</span>
                </div>
              )
            })
        }
      </div>

      </div>{/* end scrollable area */}

      <MobileNavBar items={NAV} />
    </div>
  )
}

const OVERALL_COLOR = {
  'Safe':              '#22c55e',
  'At Risk':           '#f59e0b',
  'Unsafe':            '#ef4444',
  'Full':              '#f97316',
  'Under Maintenance': '#9ca3af',
  'Unverified':        '#60a5fa',
}

function FinderCard({ center, onShowRoute, onMyLocation, onNavigate, isNavigating, activeTargetId, compact = false }) {
  const avail = Math.max(0, (center.capacity ?? 0) - (center.current_occupancy ?? 0))
  const col = OVERALL_COLOR[center.overall_status] ?? '#60a5fa'
  const navActive = isNavigating && activeTargetId === center.id
  return (
    <div className={`rounded-xl p-3 border ${compact ? 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]' : 'border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.04)]'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{center.name}</p>
          <p className="text-[11px] text-slate-400">{center.barangay ? `Brgy. ${center.barangay}` : ''}</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: `${col}18`, color: col }}>
          {center.overall_status ?? 'Unverified'}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] text-slate-400">
        <span>{(center.distKm ?? 0).toFixed(1)} km away</span>
        <span>{center.current_occupancy ?? 0}/{center.capacity ?? '?'} occupied</span>
        <span className="text-[#22c55e]">{avail} available</span>
        {center.accessibility_status && <span>{center.accessibility_status}</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button onClick={() => onShowRoute(center)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-lg bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.2)] text-[#00d4ff] text-[10px] font-semibold hover:bg-[rgba(0,212,255,0.16)] transition-colors">
          <Route size={13} />Show Route
        </button>
        <button onClick={onMyLocation}
          className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-slate-300 text-[10px] font-semibold hover:bg-[rgba(255,255,255,0.1)] transition-colors">
          <LocateFixed size={13} />My Location
        </button>
        <button onClick={() => onNavigate(center)}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-lg border text-[10px] font-semibold transition-colors ${
            navActive
              ? 'bg-[#22c55e] border-[#22c55e] text-white'
              : 'bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.25)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.16)]'
          }`}>
          {navActive ? <Square size={13} /> : <Play size={13} />}
          {navActive ? 'Stop' : 'Navigate'}
        </button>
      </div>
    </div>
  )
}
