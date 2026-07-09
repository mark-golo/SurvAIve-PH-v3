import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polygon, Tooltip as MapTooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, CheckCircle, Building2, Radio } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { StatCard } from '../../components/ui/StatCard'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

const MUNICIPALITIES = [
  { name: 'Del Carmen',   severity: 'RED',   coords: [[9.83,126.04],[9.88,126.08],[9.87,126.11],[9.82,126.10],[9.80,126.06]], total: 9, critical: 3, rescued: 1 },
  { name: 'Dapa',         severity: 'AMBER', coords: [[9.74,126.02],[9.78,126.06],[9.77,126.09],[9.73,126.08],[9.71,126.04]], total: 4, critical: 1, rescued: 0 },
  { name: 'General Luna', severity: 'GREEN', coords: [[9.78,126.13],[9.83,126.17],[9.82,126.20],[9.77,126.18],[9.75,126.14]], total: 1, critical: 0, rescued: 1 },
  { name: 'Santa Monica', severity: 'GRAY',  coords: [[9.89,126.05],[9.93,126.09],[9.92,126.12],[9.88,126.11],[9.86,126.07]], total: 0, critical: 0, rescued: 0 },
]

const COLORS = {
  RED:   { fill: 'rgba(239,68,68,0.2)',   stroke: 'rgba(239,68,68,0.7)'   },
  AMBER: { fill: 'rgba(245,158,11,0.2)',  stroke: 'rgba(245,158,11,0.7)'  },
  GREEN: { fill: 'rgba(34,197,94,0.2)',   stroke: 'rgba(34,197,94,0.7)'   },
  GRAY:  { fill: 'rgba(107,114,128,0.15)',stroke: 'rgba(107,114,128,0.4)' },
}

export function ProvincialDashboard() {
  const { scope } = useAuthStore()
  const [selected, setSelected] = useState(null)
  const [sosData, setSosData] = useState([])

  const prov = scope?.province
  useEffect(() => {
    if (!prov) return
    api.get(`/sos?province=${encodeURIComponent(prov)}`)
      .then(rows => setSosData(rows))
      .catch(() => {})
  }, [prov])

  // Group live SOS data by municipality
  const liveMunicipalities = useMemo(() => {
    if (!sosData.length) return MUNICIPALITIES
    const map = {}
    sosData.forEach(r => {
      const name = r.municipality ?? 'Unknown'
      if (!map[name]) map[name] = { name, total: 0, critical: 0, rescued: 0 }
      map[name].total++
      if (r.priority === 'CRITICAL') map[name].critical++
      if (r.rescue_status === 'rescued') map[name].rescued++
    })
    return Object.values(map).map(m => ({
      ...m,
      severity: m.critical > 0 ? 'RED' : m.total > 0 ? 'AMBER' : 'GRAY',
      coords: MUNICIPALITIES.find(d => d.name === m.name)?.coords ?? [],
    }))
  }, [sosData])

  const municipalities = liveMunicipalities

  const totals = municipalities.reduce((acc, m) => ({
    incidents: acc.incidents + m.total,
    critical:  acc.critical  + m.critical,
    rescued:   acc.rescued   + m.rescued,
  }), { incidents: 0, critical: 0, rescued: 0 })

  return (
    <SuperAdminLayout title="Provincial Dashboard">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        <div className="flex-1 min-h-[400px]">
          <MapContainer center={[9.820, 126.080]} zoom={11} style={{ height: '100%', background: '#0a1628' }} zoomControl>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            {municipalities.filter(m => m.coords?.length).map(m => {
              const c = COLORS[m.severity]
              return (
                <Polygon
                  key={m.name}
                  positions={m.coords}
                  pathOptions={{ color: c.stroke, fillColor: c.fill, fillOpacity: 1, weight: 2 }}
                  eventHandlers={{ click: () => setSelected(m) }}
                >
                  <MapTooltip sticky>
                    <div className="text-xs font-semibold">{m.name}</div>
                    <div className="text-xs">{m.total} SOS · {m.critical} critical</div>
                  </MapTooltip>
                </Polygon>
              )
            })}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 glass border-t lg:border-t-0 lg:border-l border-[rgba(255,255,255,0.08)] flex flex-col">
          <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Province Summary</p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Incidents" value={totals.incidents} icon={AlertTriangle} color="#ef4444" />
              <StatCard label="Critical"  value={totals.critical}  icon={AlertTriangle} color="#f97316" />
              <StatCard label="Rescued"   value={totals.rescued}   icon={CheckCircle}   color="#22c55e" />
              <StatCard label="Reporting" value={MUNICIPALITIES.filter(m => m.total > 0).length} icon={Building2} color="#8b5cf6" />
            </div>
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
            {Object.entries(COLORS).map(([k, c]) => (
              <div key={k} className="flex items-center gap-2 mb-2">
                <div className="w-4 h-3 rounded" style={{ background: c.fill, border: `1px solid ${c.stroke}` }} />
                <span className="text-xs text-slate-400 capitalize">
                  {k === 'RED' ? 'Active Emergency' : k === 'AMBER' ? 'Moderate Incidents' : k === 'GREEN' ? 'Stable' : 'No Data'}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </SuperAdminLayout>
  )
}
