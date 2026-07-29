import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polygon, Tooltip as MapTooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, CheckCircle, Building2, Radio } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { StatCard } from '../../components/ui/StatCard'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

// Approximate municipality boundaries — PSGC-coded, Surigao del Norte pilot
const MUNICIPALITY_BOUNDS = [
  // ── Mainland ──────────────────────────────────────────────────────────────
  { name: 'City of Surigao', psgc10: '1606724000', coords: [[9.76,125.46],[9.82,125.46],[9.82,125.52],[9.76,125.52]] },
  { name: 'Tagana-An',       psgc10: '1606725000', coords: [[9.79,125.45],[9.85,125.45],[9.85,125.51],[9.79,125.51]] },
  { name: 'Tubod',           psgc10: '1606727000', coords: [[9.73,125.46],[9.79,125.46],[9.79,125.52],[9.73,125.52]] },
  { name: 'Alegria',         psgc10: '1606701000', coords: [[9.69,125.45],[9.75,125.45],[9.75,125.51],[9.69,125.51]] },
  { name: 'Placer',          psgc10: '1606717000', coords: [[9.61,125.57],[9.67,125.57],[9.67,125.63],[9.61,125.63]] },
  { name: 'Bacuag',          psgc10: '1606702000', coords: [[9.62,125.61],[9.68,125.61],[9.68,125.67],[9.62,125.67]] },
  { name: 'Gigaquit',        psgc10: '1606711000', coords: [[9.54,125.65],[9.60,125.65],[9.60,125.71],[9.54,125.71]] },
  { name: 'Claver',          psgc10: '1606706000', coords: [[9.54,125.69],[9.60,125.69],[9.60,125.75],[9.54,125.75]] },
  { name: 'Sison',           psgc10: '1606722000', coords: [[9.48,125.58],[9.54,125.58],[9.54,125.64],[9.48,125.64]] },
  { name: 'Mainit',          psgc10: '1606714000', coords: [[9.50,125.52],[9.56,125.52],[9.56,125.58],[9.50,125.58]] },
  { name: 'Burgos',          psgc10: '1606704000', coords: [[9.50,125.50],[9.56,125.50],[9.56,125.56],[9.50,125.56]] },
  { name: 'Malimono',        psgc10: '1606715000', coords: [[9.40,125.44],[9.46,125.44],[9.46,125.50],[9.40,125.50]] },
  { name: 'San Benito',      psgc10: '1606718000', coords: [[9.36,125.52],[9.42,125.52],[9.42,125.58],[9.36,125.58]] },
  // ── Socorro + Pilar (Bucas Grande / north island area) ──────────────────
  { name: 'Socorro',         psgc10: '1606723000', coords: [[9.89,125.92],[9.95,125.92],[9.95,125.98],[9.89,125.98]] },
  { name: 'Pilar',           psgc10: '1606716000', coords: [[9.85,125.94],[9.91,125.94],[9.91,126.00],[9.85,126.00]] },
  // ── San Francisco (Anao-aon island, south-east) ──────────────────────────
  { name: 'San Francisco',   psgc10: '1606719000', coords: [[9.41,125.95],[9.47,125.95],[9.47,126.01],[9.41,126.01]] },
  // ── Siargao Island group ─────────────────────────────────────────────────
  { name: 'Santa Monica',    psgc10: '1606721000', coords: [[9.90,126.02],[9.96,126.02],[9.96,126.08],[9.90,126.08]] },
  { name: 'Del Carmen',      psgc10: '1606708000', coords: [[9.82,126.07],[9.88,126.07],[9.88,126.13],[9.82,126.13]] },
  { name: 'Dapa',            psgc10: '1606707000', coords: [[9.73,126.02],[9.79,126.02],[9.79,126.08],[9.73,126.08]] },
  { name: 'General Luna',    psgc10: '1606710000', coords: [[9.77,126.14],[9.83,126.14],[9.83,126.20],[9.77,126.20]] },
  { name: 'San Isidro',      psgc10: '1606720000', coords: [[10.02,126.14],[10.08,126.14],[10.08,126.20],[10.02,126.20]] },
]

const COLORS = {
  RED:   { fill: 'rgba(239,68,68,0.2)',    stroke: 'rgba(239,68,68,0.7)'   },
  AMBER: { fill: 'rgba(245,158,11,0.2)',   stroke: 'rgba(245,158,11,0.7)'  },
  GREEN: { fill: 'rgba(34,197,94,0.2)',    stroke: 'rgba(34,197,94,0.7)'   },
  GRAY:  { fill: 'rgba(107,114,128,0.15)', stroke: 'rgba(107,114,128,0.4)' },
}

export function ProvincialDashboard() {
  const { scope } = useAuthStore()
  const [selected, setSelected] = useState(null)
  const [sosData, setSosData]   = useState([])

  const prov = scope?.province
  useEffect(() => {
    if (!prov) return
    api.get(`/sos?province=${encodeURIComponent(prov)}`)
      .then(rows => setSosData(rows))
      .catch(() => {})
  }, [prov])

  // Merge live SOS counts with known municipality boundaries
  const municipalities = useMemo(() => {
    const map = {}
    // Start all known boundaries at zero
    MUNICIPALITY_BOUNDS.forEach(m => {
      map[m.name] = { name: m.name, coords: m.coords, total: 0, critical: 0, rescued: 0 }
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
      severity: m.critical > 0 ? 'RED' : m.total > 0 ? 'AMBER' : 'GRAY',
    }))
  }, [sosData])

  const totals = municipalities.reduce((acc, m) => ({
    incidents: acc.incidents + m.total,
    critical:  acc.critical  + m.critical,
    rescued:   acc.rescued   + m.rescued,
  }), { incidents: 0, critical: 0, rescued: 0 })

  return (
    <SuperAdminLayout title="Provincial Dashboard">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        <div className="flex-1 min-h-[400px]">
          <MapContainer center={[9.75, 125.85]} zoom={9} style={{ height: '100%', background: '#0a1628' }} zoomControl>
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
              <StatCard label="Incidents"  value={totals.incidents}                                    icon={AlertTriangle} color="#ef4444" />
              <StatCard label="Critical"   value={totals.critical}                                     icon={AlertTriangle} color="#f97316" />
              <StatCard label="Rescued"    value={totals.rescued}                                      icon={CheckCircle}   color="#22c55e" />
              <StatCard label="Reporting"  value={municipalities.filter(m => m.total > 0).length}      icon={Building2}     color="#8b5cf6" />
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
