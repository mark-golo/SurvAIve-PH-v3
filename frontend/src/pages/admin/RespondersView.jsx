import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Radio, User, MapPin, CheckCircle } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { NeonButton } from '../../components/ui/NeonButton'

const RESPONDERS = [
  { id: 1, name: 'Alpha Unit',   lat: 9.8527, lng: 126.0736, status: 'on_duty', zone: 'Zone 1 – Del Carmen Poblacion', relay: true,  assigned: 2, team: 'TEAM-A' },
  { id: 2, name: 'Bravo Unit',   lat: 9.8720, lng: 126.0690, status: 'on_duty', zone: 'Zone 2 – Bitoon',    relay: false, assigned: 1, team: 'TEAM-B' },
  { id: 3, name: 'Charlie Unit', lat: 9.8490, lng: 126.0850, status: 'standby', zone: 'Zone 3 – San Jose',     relay: true,  assigned: 0, team: 'TEAM-C' },
]

const rIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 0 10px ${color}"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
})

export function RespondersView() {
  const [responders, setResponders] = useState(RESPONDERS)
  const [selected, setSelected] = useState(null)

  return (
    <AdminLayout title="Responders">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Map */}
        <div className="flex-1 min-h-[350px]">
          <MapContainer center={[9.852, 126.073]} zoom={13}
            style={{ height: '100%', background: '#0a1628' }} zoomControl>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            {responders.map(r => (
              <>
                <Marker key={r.id} position={[r.lat, r.lng]}
                  icon={rIcon(r.status === 'on_duty' ? '#00d4ff' : '#9ca3af')}>
                  <Popup>
                    <div className="bg-[#0f172a] text-white text-xs p-3 rounded-xl min-w-[150px]">
                      <p className="font-bold">{r.name}</p>
                      <p className="text-slate-400">{r.zone} · {r.assigned} assigned</p>
                      {r.relay && <p className="text-[#22c55e] mt-1">📡 Relay Active</p>}
                    </div>
                  </Popup>
                </Marker>
                {r.relay && (
                  <Circle key={`zone-${r.id}`} center={[r.lat, r.lng]} radius={250}
                    pathOptions={{ color: 'rgba(0,212,255,0.2)', fillColor: 'rgba(0,212,255,0.04)', fillOpacity: 1, weight: 1 }} />
                )}
              </>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 glass border-t lg:border-t-0 lg:border-l border-[rgba(255,255,255,0.08)] p-4 space-y-3 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rescue Teams</p>
          {responders.map(r => (
            <div key={r.id} onClick={() => setSelected(selected === r.id ? null : r.id)}
              className={`glass rounded-xl p-3 cursor-pointer transition-all border ${
                selected === r.id ? 'border-[rgba(0,212,255,0.4)]' : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]'
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${r.status === 'on_duty' ? 'bg-[#22c55e] animate-pulse' : 'bg-slate-500'}`} />
                <p className="text-sm font-semibold text-white">{r.name}</p>
                <StatusBadge status={r.status === 'on_duty' ? 'ACTIVE' : 'STANDBY'} className="ml-auto" />
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1"><MapPin size={10} /> {r.zone}</p>
                <p className="flex items-center gap-1"><User size={10} /> {r.assigned} victims assigned</p>
                <p className="flex items-center gap-1"><Radio size={10} className={r.relay ? 'text-[#22c55e]' : ''} />
                  {r.relay ? 'Relay Active' : 'Relay Off'}
                </p>
              </div>
              {selected === r.id && (
                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <p className="text-[10px] text-slate-500 mb-2">Assign to zone:</p>
                  <div className="flex gap-2 flex-wrap">
                    {['Zone 1', 'Zone 2', 'Zone 3'].map(z => (
                      <button key={z} onClick={() => setResponders(d => d.map(rr => rr.id === r.id ? { ...rr, zone: z } : rr))}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                          r.zone === z ? 'bg-[rgba(0,212,255,0.15)] border-[rgba(0,212,255,0.4)] text-[#00d4ff]'
                          : 'border-[rgba(255,255,255,0.1)] text-slate-500'
                        }`}>{z}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Coverage summary */}
          <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.15)]">
            <p className="text-[11px] text-[#00d4ff] font-semibold mb-1">Mesh Coverage</p>
            <p className="text-xs text-slate-400">
              {responders.filter(r => r.relay).length} responders active as relay nodes · approx. 3 zones covered
            </p>
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
