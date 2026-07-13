import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { List, Map, Radio, Settings } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

const NAV = [
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Relay',    path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

const RESPONDER_POS = [9.852, 126.073]

const priorityColor = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', SAFE: '#22c55e' }

const numberedIcon = (num, color) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:${color};border:2px solid white;border-radius:50%;
         display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:12px;
         box-shadow:0 0 10px ${color}">${num}</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
})

const responderIcon = () => L.divIcon({
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

export function FieldMap() {
  const navigate = useNavigate()
  const { scope } = useAuthStore()
  const [centers, setCenters]   = useState([])
  const [assigned, setAssigned] = useState([])

  const muni = scope?.municipality
  useEffect(() => {
    api.get(muni ? `/evacuation_centers?municipality=${encodeURIComponent(muni)}` : '/evacuation_centers')
      .then(rows => setCenters(rows))
      .catch(() => setCenters([]))
  }, [])

  useEffect(() => {
    api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
      .then(rows => setAssigned(rows.map((r, i) => ({
        id: r.id, lat: r.lat, lng: r.lng,
        priority: r.priority ?? 'LOW',
        label: String(i + 1),
        name: r.name ?? 'Unknown',
        barangay: r.barangay ?? '',
        status: r.status ?? 'unknown',
      }))))
      .catch(() => setAssigned([]))
  }, [])

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar title="Field Map" subtitle="Assigned zone · Zone 1" onBack />

      {/* Map */}
      <div className="flex-1 mx-3 mt-2 mb-2 rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)]" style={{ minHeight: '420px' }}>
        <MapContainer
          center={RESPONDER_POS}
          zoom={14}
          style={{ height: '100%', minHeight: '420px', background: '#0a1628' }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />

          {/* My position */}
          <Marker position={RESPONDER_POS} icon={responderIcon()}>
            <Popup>
              <div className="text-xs bg-[#0f172a] text-white p-2 rounded">
                <strong>You</strong> — Alpha Unit
              </div>
            </Popup>
          </Marker>

          {/* Assigned victims */}
          {assigned.map((v) => (
            <Marker key={v.id} position={[v.lat, v.lng]} icon={numberedIcon(v.label, priorityColor[v.priority])}>
              <Popup>
                <div className="bg-[#0f172a] text-white text-xs p-2 rounded min-w-[140px]">
                  <p className="font-bold">{v.name}</p>
                  <p className="text-slate-400">{v.barangay} · {v.status}</p>
                  <button
                    onClick={() => navigate(`/responder/rescue/${v.id}`)}
                    className="mt-1.5 text-[#00d4ff] text-[10px] hover:underline"
                  >View Details →</button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Evacuation centers */}
          {centers.map(c => (
            <Marker key={`ec-${c.id}`} position={[c.lat, c.lng]} icon={shelterIcon(c.status)}>
              <Popup>
                <div className="bg-[#0f172a] text-white text-xs p-3 rounded-xl min-w-[170px]">
                  <p className="font-bold text-[#22c55e] mb-1">⛺ {c.name}</p>
                  <p className="text-slate-400 mb-0.5">Brgy. {c.barangay}</p>
                  {c.capacity && <p className="text-slate-400 mb-0.5">Capacity: {c.capacity}</p>}
                  {c.contact_number && <p className="text-slate-400 mb-0.5">{c.contact_number}</p>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    c.status === 'open' ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' :
                    c.status === 'full' ? 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]' :
                                         'bg-[rgba(107,114,128,0.15)] text-[#9ca3af]'
                  }`}>{c.status.toUpperCase()}</span>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Range indicator */}
          <Circle center={RESPONDER_POS} radius={300} pathOptions={{ color: 'rgba(0,212,255,0.3)', fillColor: 'rgba(0,212,255,0.05)', fillOpacity: 1 }} />
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="px-3 pb-2">
        <div className="glass rounded-xl p-3 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-[#00d4ff]" style={{ boxShadow: '0 0 6px #00d4ff' }} />
            <span className="text-[10px] text-slate-400">You</span>
          </div>
          {Object.entries(priorityColor).slice(0, 3).map(([k, c]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
              <span className="text-[10px] text-slate-400 capitalize">{k.toLowerCase()}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-[#22c55e] flex items-center justify-center text-[9px]">⛺</div>
            <span className="text-[10px] text-slate-400">Evacuation</span>
          </div>
        </div>
      </div>

      <MobileNavBar items={NAV} />
    </div>
  )
}
