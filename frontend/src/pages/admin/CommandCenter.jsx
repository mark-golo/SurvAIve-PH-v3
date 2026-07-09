import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Users, AlertTriangle, CheckCircle, Radio, RefreshCw, Shield } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { StatCard } from '../../components/ui/StatCard'
import { NeonButton } from '../../components/ui/NeonButton'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

const DEMO_REPORTS = [
  { id: 1, lat: 9.8610, lng: 126.0780, priority: 'CRITICAL', name: 'Rosa V.',   barangay: 'Caub',      verified: true  },
  { id: 2, lat: 9.8527, lng: 126.0736, priority: 'CRITICAL', name: 'Maria S.',  barangay: 'Del Carmen Poblacion', verified: true  },
  { id: 3, lat: 9.8720, lng: 126.0690, priority: 'HIGH',     name: 'Juan D.C.', barangay: 'Bitoon',    verified: true  },
  { id: 4, lat: 9.8560, lng: 126.0620, priority: 'HIGH',     name: 'Guest',     barangay: 'Cancohoy',  verified: false },
  { id: 5, lat: 9.8450, lng: 126.0680, priority: 'MODERATE', name: 'Guest',     barangay: 'Domoyog',   verified: false },
  { id: 6, lat: 9.8490, lng: 126.0850, priority: 'SAFE',     name: 'Group',     barangay: 'San Jose',     verified: false },
]

const DEMO_CENTERS = [
  { id: 1, name: 'Del Carmen Municipal Gymnasium', barangay: 'Del Carmen Poblacion', lat: 9.8520, lng: 126.0730, capacity: 500, status: 'open' },
  { id: 2, name: 'Bitoon Barangay Hall',           barangay: 'Bitoon',    lat: 9.8715, lng: 126.0685, capacity: 150, status: 'open' },
  { id: 3, name: 'Siargao Island Sports Complex',  barangay: 'San Jose',     lat: 9.8485, lng: 126.0845, capacity: 800, status: 'open' },
]

const COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', SAFE: '#22c55e' }

const pinIcon = (color, verified) => L.divIcon({
  className: '',
  html: `<div style="width:${verified ? 14 : 12}px;height:${verified ? 14 : 12}px;background:${color};
         border:${verified ? '2px solid white' : '2px dashed rgba(255,255,255,0.5)'};border-radius:50%;
         box-shadow:0 0 10px ${color}"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
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

export function CommandCenter() {
  const { scope } = useAuthStore()
  const [stats, setStats] = useState({ total: 6, critical: 2, rescued: 1, nodes: 3, unverified: 3 })
  const [syncing, setSyncing] = useState(false)
  const [reports, setReports] = useState(DEMO_REPORTS)
  const [centers, setCenters] = useState([])

  const muni = scope?.municipality

  useEffect(() => {
    api.get(muni ? `/evacuation_centers?municipality=${encodeURIComponent(muni)}` : '/evacuation_centers')
      .then(rows => setCenters(rows))
      .catch(() => setCenters(DEMO_CENTERS))
  }, [])

  useEffect(() => { sync() }, [])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
      if (res.length) {
        setReports(res)
        setStats(prev => ({
          total: res.length,
          critical: res.filter(r => r.priority === 'CRITICAL').length,
          rescued: res.filter(r => r.rescue_status === 'rescued').length,
          nodes: prev.nodes,
          unverified: res.filter(r => !r.is_verified).length,
        }))
      }
    } catch {}
    setSyncing(false)
  }

  return (
    <AdminLayout title="Command Center">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Map — main content */}
        <div className="flex-1 min-h-[400px]">
          <MapContainer
            center={[9.852, 126.073]}
            zoom={14}
            style={{ height: '100%', background: '#0a1628' }}
            zoomControl={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            {reports.map(r => (
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
            {reports.filter(r => ['CRITICAL', 'HIGH'].includes(r.priority)).map(r => (
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
          </MapContainer>
        </div>

        {/* Sidebar stats */}
        <aside className="w-full lg:w-72 xl:w-80 glass border-t lg:border-t-0 lg:border-l border-[rgba(255,255,255,0.08)] flex flex-col">
          <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Stats</p>
              <NeonButton size="sm" variant="ghost" onClick={sync} loading={syncing}>
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
              </NeonButton>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Total SOS"   value={stats.total}      icon={Users}         color="#00d4ff" />
              <StatCard label="Critical"    value={stats.critical}   icon={AlertTriangle} color="#ef4444" />
              <StatCard label="Rescued"     value={stats.rescued}    icon={CheckCircle}   color="#22c55e" />
              <StatCard label="Mesh Nodes"  value={stats.nodes}      icon={Radio}         color="#8b5cf6" />
            </div>
          </div>

          <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unverified Reports</p>
              <span className="text-xs font-black text-[#f59e0b]">{stats.unverified}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-1.5 rounded-full flex-1 bg-slate-700">
                <div className="h-full rounded-full bg-[#f59e0b]" style={{ width: `${(stats.unverified / stats.total) * 100}%` }} />
              </div>
              <span className="text-[10px] text-slate-500">{Math.round((stats.unverified / stats.total) * 100)}% guest</span>
            </div>
          </div>

          {/* Recent activity */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Reports</p>
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.id} className="glass rounded-xl p-2.5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[r.priority], boxShadow: `0 0 6px ${COLORS[r.priority]}` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{r.name ?? 'Anonymous'}</p>
                    <p className="text-[10px] text-slate-500">{r.barangay}</p>
                  </div>
                  <StatusBadge status={r.priority} className="shrink-0 text-[9px] !py-0.5 !px-1.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Map legend */}
          <div className="p-4 border-t border-[rgba(255,255,255,0.08)]">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-white/50" style={{ background: '#ef4444' }} />
                <span className="text-[10px] text-slate-400">Verified pin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-white/50" style={{ background: '#f97316' }} />
                <span className="text-[10px] text-slate-400">Guest pin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-[#22c55e] flex items-center justify-center text-[9px]">⛺</div>
                <span className="text-[10px] text-slate-400">Evacuation</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
