import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Radio, MapPin } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const responderMarkerIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#00d4ff;border:3px solid white;border-radius:50%;
         box-shadow:0 0 12px #00d4ff"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
})

export function RespondersView() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality
  const [responders, setResponders] = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [activeOnMap, setActiveOnMap] = useState([])

  useEffect(() => {
    const q = muni ? `/responders?municipality=${encodeURIComponent(muni)}` : '/responders'
    api.get(q).then(setResponders).catch(() => setResponders([])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let q = supabase.from('responders')
      .select('id,name,unit_name,assigned_zone,lat,lng,last_seen_at')
      .eq('duty_status', 'on_duty')
      .not('lat', 'is', null)
    if (muni) q = q.eq('municipality', muni)
    q.then(({ data }) => setActiveOnMap(data ?? []))
  }, [])

  return (
    <AdminLayout title="Responders">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Map — general area view; responders shown in sidebar */}
        <div className="flex-1 min-h-[350px]">
          <MapContainer center={[9.852, 126.073]} zoom={13}
            style={{ height: '100%', background: '#0a1628' }} zoomControl>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            {activeOnMap.map(r => (
              <Marker key={`r-${r.id}`} position={[r.lat, r.lng]} icon={responderMarkerIcon()}>
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

        {/* Sidebar */}
        <aside className="w-full lg:w-72 glass border-t lg:border-t-0 lg:border-l border-[rgba(255,255,255,0.08)] p-4 space-y-3 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rescue Teams</p>

          {loading && <p className="text-sm text-slate-500 text-center py-8">Loading…</p>}

          {!loading && responders.length === 0 && (
            <div className="text-center py-8">
              <Radio size={24} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No responders found</p>
            </div>
          )}

          {responders.map(r => (
            <div key={r.id} onClick={() => setSelected(selected === r.id ? null : r.id)}
              className={`glass rounded-xl p-3 cursor-pointer transition-all border ${
                selected === r.id ? 'border-[rgba(0,212,255,0.4)]' : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]'
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${r.duty_status === 'on_duty' ? 'bg-[#22c55e] animate-pulse' : 'bg-slate-500'}`} />
                <p className="text-sm font-semibold text-white">{r.name}</p>
                <StatusBadge status={r.duty_status === 'on_duty' ? 'ACTIVE' : 'STANDBY'} className="ml-auto" />
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1"><MapPin size={10} /> {r.assigned_zone ?? '—'}</p>
                <p className="flex items-center gap-1">
                  <Radio size={10} className={r.active_mesh_relay ? 'text-[#22c55e]' : ''} />
                  {r.active_mesh_relay ? 'Relay Active' : 'Relay Off'}
                </p>
              </div>
              {selected === r.id && (
                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <p className="text-[10px] text-slate-500 mb-2">Assign to zone:</p>
                  <div className="flex gap-2 flex-wrap">
                    {['Zone 1', 'Zone 2', 'Zone 3'].map(z => (
                      <button key={z} onClick={e => {
                        e.stopPropagation()
                        setResponders(d => d.map(rr => rr.id === r.id ? { ...rr, assigned_zone: z } : rr))
                        api.put('/responders/' + r.id, { assigned_zone: z }).catch(() => {})
                      }}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                          r.assigned_zone === z
                            ? 'bg-[rgba(0,212,255,0.15)] border-[rgba(0,212,255,0.4)] text-[#00d4ff]'
                            : 'border-[rgba(255,255,255,0.1)] text-slate-500'
                        }`}>{z}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {!loading && responders.length > 0 && (
            <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.15)]">
              <p className="text-[11px] text-[#00d4ff] font-semibold mb-1">Mesh Coverage</p>
              <p className="text-xs text-slate-400">
                {responders.filter(r => r.active_mesh_relay).length} responder(s) active as relay nodes
              </p>
            </div>
          )}
        </aside>
      </div>
    </AdminLayout>
  )
}
