import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Home, Map, Radio, Settings, MessageSquare, Navigation, AlertTriangle, Tent } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

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

export function LocalMap() {
  const { scope } = useAuthStore()
  const [userPos, setUserPos]     = useState(null)
  const [gpsError, setGpsError]   = useState(false)
  const [centers, setCenters]     = useState([])
  const [loading, setLoading]     = useState(true)

  const muni = scope?.municipality

  useEffect(() => {
    api.get(muni ? `/evacuation_centers?municipality=${encodeURIComponent(muni)}` : '/evacuation_centers')
      .then(rows => setCenters(rows))
      .catch(() => setCenters([]))
      .finally(() => setLoading(false))
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
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar title="My Location & Evacuation Centers" subtitle="Tap a shelter for details" onBack />

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
      <div className="flex-1 mx-4 mt-2 mb-2 rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)] min-h-[420px]">
        <MapContainer
          center={userPos ?? DEFAULT_POS}
          zoom={14}
          style={{ height: '100%', minHeight: '420px', background: '#0a1628' }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
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

      {/* Center list */}
      <div className="px-4 pb-2 space-y-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Evacuation Centers</p>
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

      <MobileNavBar items={NAV} />
    </div>
  )
}
