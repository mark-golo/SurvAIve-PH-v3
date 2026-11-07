import { useState, useEffect, useRef, useMemo } from 'react'
import { getResponderTheme } from '../../lib/victimTheme'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Home, List, Map, Radio, Settings, QrCode, X, CheckCircle, AlertCircle, UserCheck } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { clusterSOS } from '../../lib/kmeans'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Mesh',     path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

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

function FlyTo({ pos }) {
  const map = useMap()
  useEffect(() => { if (pos) map.flyTo(pos, 15, { duration: 1.2 }) }, [pos])
  return null
}

function QRScanPanel({ centers, onClose }) {
  const [scanStage, setScanStage] = useState('scanning') // 'scanning' | 'confirm' | 'done' | 'error'
  const [scanResult, setScanResult] = useState(null)
  const [selCenter, setSelCenter] = useState('')
  const [groupSize, setGroupSize] = useState(1)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (scanStage !== 'scanning') return
    let scanner = null
    const id = 'qr-reader-fm'
    const timer = setTimeout(async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode')
        scanner = new Html5QrcodeScanner(id, { fps: 10, qrbox: 220 }, false)
        scanner.render(
          (text) => {
            scanner.clear().catch(() => {})
            if (text.startsWith('SURVPH:EVACUEE:')) {
              const parts = text.split(':')
              setScanResult({ evacueeId: parts[2] ?? '', evacueeName: parts[3] ?? '' })
              setScanStage('confirm')
            } else {
              setErrorMsg('Invalid QR code — expected an evacuee ID.')
              setScanStage('error')
            }
          },
          () => {}
        )
      } catch { setErrorMsg('Camera not available.'); setScanStage('error') }
    }, 100)
    return () => {
      clearTimeout(timer)
      if (scanner) scanner.clear().catch(() => {})
    }
  }, [scanStage])

  async function submitCheckin() {
    if (!selCenter) { setErrorMsg('Select a center'); return }
    setSaving(true); setErrorMsg('')
    try {
      await api.post('/evacuation_center_checkins', {
        center_id: selCenter,
        evacuee_id: scanResult?.evacueeId || null,
        evacuee_name: scanResult?.evacueeName || null,
        group_size: groupSize,
        checked_in_by: 'responder',
        source: 'QR_SCAN',
      })
      setScanStage('done')
    } catch (e) { setErrorMsg(e?.error ?? 'Failed to record check-in') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.85)] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2">
          <QrCode size={16} className="text-[#00d4ff]" />
          <p className="text-sm font-semibold text-white">Scan Evacuee QR</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.08)]">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {scanStage === 'scanning' && (
          <>
            <p className="text-xs text-slate-400 text-center">Point the camera at the evacuee's QR code</p>
            <div id="qr-reader-fm" className="rounded-xl overflow-hidden" />
          </>
        )}

        {scanStage === 'confirm' && scanResult && (
          <div className="space-y-4">
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <UserCheck size={20} className="text-[#22c55e] shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Evacuee scanned</p>
                <p className="text-sm font-semibold text-white">{scanResult.evacueeName || 'Unknown name'}</p>
                <p className="text-[10px] text-slate-500 font-mono">{scanResult.evacueeId}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1.5">Destination Center</p>
                <select value={selCenter} onChange={e => setSelCenter(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(0,212,255,0.2)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(0,212,255,0.5)]">
                  <option value="">Select center…</option>
                  {centers.filter(c => c.status !== 'closed').map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5">Group Size</p>
                <input type="number" min="1" value={groupSize} onChange={e => setGroupSize(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(0,212,255,0.2)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
              </div>
            </div>
            {errorMsg && <p className="text-xs text-[#ef4444]">{errorMsg}</p>}
            <div className="flex gap-2">
              <button onClick={submitCheckin} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#22c55e] text-white disabled:opacity-50">
                {saving ? 'Recording…' : 'Confirm Arrival'}
              </button>
              <button onClick={() => { setScanStage('scanning'); setScanResult(null) }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[rgba(255,255,255,0.08)] text-slate-300">
                Rescan
              </button>
            </div>
          </div>
        )}

        {scanStage === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle size={48} className="text-[#22c55e]" />
            <p className="text-sm font-semibold text-white">Arrival Recorded</p>
            <p className="text-xs text-slate-400 text-center">The evacuee's check-in has been saved.</p>
            <button onClick={() => { setScanStage('scanning'); setScanResult(null); setSelCenter(''); setGroupSize(1) }}
              className="px-6 py-2 rounded-xl text-sm font-semibold bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)]">
              Scan Another
            </button>
          </div>
        )}

        {scanStage === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle size={48} className="text-[#ef4444]" />
            <p className="text-sm font-semibold text-white">Scan Failed</p>
            <p className="text-xs text-slate-400 text-center">{errorMsg}</p>
            <button onClick={() => { setScanStage('scanning'); setErrorMsg('') }}
              className="px-6 py-2 rounded-xl text-sm font-semibold bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)]">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function FieldMap() {
  const navigate = useNavigate()
  const { scope } = useAuthStore()
  const [isLight] = useState(() => getResponderTheme() === 'light')
  const [centers, setCenters]   = useState([])
  const [assigned, setAssigned] = useState([])
  const [myPos, setMyPos]       = useState(null)
  const [gpsError, setGpsError] = useState(false)
  const [profile, setProfile]   = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const activeAssigned = assigned.filter(v => v.rescue_status !== 'rescued')
  const clusters = useMemo(() => clusterSOS(activeAssigned), [activeAssigned])

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
        ai_priority_score: r.ai_priority_score ?? 50,
        label: String(i + 1),
        name: r.name ?? 'Unknown',
        barangay: r.barangay ?? '',
        status: r.status ?? 'unknown',
        rescue_status: r.rescue_status ?? null,
      }))))
      .catch(() => setAssigned([]))
  }, [])

  useEffect(() => {
    const ch = supabase.channel('fm-sos-status')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_reports' },
        () => {
          api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
            .then(rows => setAssigned(rows.map((r, i) => ({
              id: r.id, lat: r.lat, lng: r.lng,
              priority: r.priority ?? 'LOW',
              ai_priority_score: r.ai_priority_score ?? 50,
              label: String(i + 1),
              name: r.name ?? 'Unknown',
              barangay: r.barangay ?? '',
              status: r.status ?? 'unknown',
              rescue_status: r.rescue_status ?? null,
            }))))
            .catch(() => {})
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_reports' },
        payload => {
          const r = payload.new
          setAssigned(prev => prev.map(x =>
            x.id === r.id ? { ...x, rescue_status: r.rescue_status } : x
          ))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Polling fallback — keeps map markers fresh every 30 s
  useEffect(() => {
    const id = setInterval(() => {
      api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
        .then(rows => setAssigned(rows.map((r, i) => ({
          id: r.id, lat: r.lat, lng: r.lng,
          priority: r.priority ?? 'LOW',
          ai_priority_score: r.ai_priority_score ?? 50,
          label: String(i + 1),
          name: r.name ?? 'Unknown',
          barangay: r.barangay ?? '',
          status: r.status ?? 'unknown',
          rescue_status: r.rescue_status ?? null,
        }))))
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError(true); return }
    let watchId = null
    let active = true
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!active) return
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) return
      supabase.from('responders')
        .select('id,unit_name,assigned_zone')
        .eq('contact_number', contact)
        .single()
        .then(({ data }) => {
          if (!active || !data) return
          setProfile(data)
          watchId = navigator.geolocation.watchPosition(
            pos => {
              setMyPos([pos.coords.latitude, pos.coords.longitude])
              supabase.rpc('update_responder_location', {
                p_contact_number: contact,
                p_lat: pos.coords.latitude,
                p_lng: pos.coords.longitude,
              }).then(() => {})
            },
            () => setGpsError(true),
            { enableHighAccuracy: true, timeout: 10000 }
          )
        })
    })
    return () => {
      active = false
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  return (
    <div className={`min-h-screen bg-mesh flex flex-col pb-nav${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Field Map" subtitle={profile?.assigned_zone ?? 'Field Map'} onBack />

      {/* Map */}
      <div className="flex-1 mx-3 mt-2 mb-2 rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)]" style={{ minHeight: '420px' }}>
        <MapContainer
          center={myPos ?? [9.852, 126.073]}
          zoom={14}
          style={{ height: '100%', minHeight: '420px', background: '#0a1628' }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
          {myPos && <FlyTo pos={myPos} />}

          {/* My position */}
          {myPos && (
            <Marker position={myPos} icon={responderIcon()}>
              <Popup>
                <div className="text-xs bg-[#0f172a] text-white p-2 rounded">
                  <strong>You</strong>{profile?.unit_name ? ` — ${profile.unit_name}` : ''}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Assigned victims (rescued victims are excluded) */}
          {activeAssigned.map((v) => (
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
          {myPos && <Circle center={myPos} radius={300} pathOptions={{ color: 'rgba(0,212,255,0.3)', fillColor: 'rgba(0,212,255,0.05)', fillOpacity: 1 }} />}

          {/* Hotspot cluster overlays */}
          {clusters.map((cl, idx) => {
            const clusterColor = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', LOW: '#22c55e' }[cl.priority]
            return (
              <Circle
                key={`cluster-${idx}`}
                center={cl.centroid}
                radius={600}
                pathOptions={{
                  color: clusterColor,
                  fillColor: clusterColor,
                  fillOpacity: 0.08,
                  weight: 1.5,
                  dashArray: '6 4',
                }}
              >
                <Popup>
                  <div className="bg-[#0f172a] text-white text-xs p-2 rounded min-w-[140px]">
                    <p className="font-bold" style={{ color: clusterColor }}>Hotspot Cluster {idx + 1}</p>
                    <p className="text-slate-400">{cl.count} reports · {cl.priority}</p>
                    {cl.barangays.length > 0 && (
                      <p className="text-slate-500 mt-0.5">{cl.barangays.slice(0, 2).join(', ')}</p>
                    )}
                  </div>
                </Popup>
              </Circle>
            )
          })}
        </MapContainer>
      </div>

      {/* QR Scanner panel */}
      {scannerOpen && <QRScanPanel centers={centers} onClose={() => setScannerOpen(false)} />}

      {/* QR Scan button */}
      <div className="px-3 pb-2">
        <button onClick={() => setScannerOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[rgba(0,212,255,0.12)] text-[#00d4ff] border border-[rgba(0,212,255,0.2)] hover:bg-[rgba(0,212,255,0.2)] transition-colors mb-2">
          <QrCode size={15} />
          Scan Evacuee QR — Record Arrival
        </button>
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
          {clusters.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full border-2 border-[#ef4444] opacity-60" style={{ borderStyle: 'dashed' }} />
              <span className="text-[10px] text-slate-400">Hotspot</span>
            </div>
          )}
          {assigned.length !== activeAssigned.length && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-[#22c55e]" style={{ boxShadow: '0 0 6px #22c55e' }} />
              <span className="text-[10px] text-slate-400">{assigned.length - activeAssigned.length} Rescued</span>
            </div>
          )}
        </div>
      </div>

      <MobileNavBar items={NAV} />
    </div>
  )
}
