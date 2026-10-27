import { useState, useEffect, useRef } from 'react'
import { getResponderTheme } from '../../lib/victimTheme'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Home, Map, Radio, Settings, List, RefreshCw, Power, Users, ArrowUpDown } from 'lucide-react'
import { MobileNavBar, TopBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { NeonButton } from '../../components/ui/NeonButton'
import { mesh } from '../../lib/mesh'
import api from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { onMeshSOSAlert } from '../../lib/meshAlerts'
import { getReceivedSOS, onActivityChange } from '../../lib/meshActivityStore'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Relay',    path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

export function ResponderHome() {
  const navigate = useNavigate()
  const { scope } = useAuthStore()
  const [isLight] = useState(() => getResponderTheme() === 'light')
  const muni = scope?.municipality
  const [onDuty, setOnDuty] = useState(false)
  const [sosList, setSosList] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [profile, setProfile] = useState(null)
  const [responderId, setResponderId] = useState(null)
  const responderIdRef = useRef(null)
  const lastGpsUpdateRef = useRef(null)
  const [stats, setStats] = useState({ peersNearby: 0, transport: 'starting', relayEnabled: false })
  const [meshAlert, setMeshAlert] = useState(null)
  // RC-1/RC-2: persistent mesh SOS list — seeded from activity store at mount so
  // SOS packets received while this component was unmounted are not missed.
  const [receivedMeshSOS, setReceivedMeshSOS] = useState(() => getReceivedSOS())

  useEffect(() => {
    const load = async () => { setStats(await mesh.getStats()) }
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    return onMeshSOSAlert((data, rawPacket) => {
      setMeshAlert({ data, rawPacket, time: Date.now() })
    })
  }, [])

  // RC-2: subscribe to meshActivityStore so the persistent list updates whenever
  // a packet is received — regardless of which page was open at receive time.
  useEffect(() => {
    return onActivityChange(() => setReceivedMeshSOS(getReceivedSOS()))
  }, [])

  const activeList    = sosList.filter(r => r.rescue_status !== 'rescued')
  const assignedCount = activeList.length
  const criticalCount = activeList.filter(r => r.priority === 'CRITICAL').length

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) return
      supabase.from('responders').select('id,name,unit_name,assigned_zone,duty_status').eq('contact_number', contact).single()
        .then(({ data }) => {
          if (data) {
            setProfile(data)
            setResponderId(data.id)
            responderIdRef.current = data.id
            setOnDuty(data.duty_status === 'on_duty')
          }
        })
    })
  }, [])

  useEffect(() => { responderIdRef.current = responderId }, [responderId])

  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const id = responderIdRef.current
        if (!id) return
        const now = Date.now()
        const { latitude: lat, longitude: lng } = pos.coords
        const last = lastGpsUpdateRef.current
        if (last) {
          const elapsed = now - last.ts
          // Flat-earth approximation — accurate enough for 10 m threshold
          const dlat = (lat - last.lat) * Math.PI / 180
          const dlng = (lng - last.lng) * Math.PI / 180
          const a = dlat * dlat + Math.cos(last.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * dlng * dlng
          const distM = 6371000 * Math.sqrt(a)
          if (elapsed < 30000 && distM < 10) return
        }
        lastGpsUpdateRef.current = { ts: now, lat, lng }
        supabase.from('responders').update({
          lat,
          lng,
          last_seen_at: new Date().toISOString(),
        }).eq('id', id).then(() => {})
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    )
    return () => { navigator.geolocation.clearWatch(watchId) }
  }, [])

  useEffect(() => {
    const url = muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos'
    api.get(url)
      .then(rows => setSosList(rows))
      .catch(() => setSosList([]))
  }, [muni])

  useEffect(() => {
    const ch = supabase.channel('rh-sos-status')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_reports' },
        payload => {
          const r = payload.new
          if (muni && r.municipality !== muni) return
          setSosList(prev => prev.map(x =>
            x.id === r.id ? { ...x, rescue_status: r.rescue_status, priority: r.priority } : x
          ))
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_reports' },
        payload => {
          const r = payload.new
          if (muni && r.municipality !== null && r.municipality !== muni) return
          setSosList(prev => [r, ...prev])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const syncNow = async () => {
    setSyncing(true)
    try {
      const url = muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos'
      const rows = await api.get(url)
      setSosList(rows)
    } catch {}
    setSyncing(false)
  }

  const toggleDuty = async () => {
    const prev = onDuty
    const newStatus = onDuty ? 'standby' : 'on_duty'
    setOnDuty(!onDuty)
    try {
      if (responderId) {
        await supabase.from('responders').update({ duty_status: newStatus }).eq('id', responderId)
      }
    } catch {
      setOnDuty(prev)
    }
  }

  return (
    <div className={`min-h-screen bg-mesh flex flex-col pb-20${isLight ? ' light-theme' : ''}`}>
      {/* Header */}
      <header className="glass border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-white text-sm">Responder Dashboard</h1>
            <p className="text-[10px] text-slate-500">{profile?.unit_name ?? 'Responder'} · {profile?.assigned_zone ?? '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={onDuty ? 'ACTIVE' : 'STANDBY'} pulse={onDuty} />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {/* Mesh SOS alert card */}
        {meshAlert && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4 border-2 border-[rgba(239,68,68,0.6)] shadow-[0_0_24px_rgba(239,68,68,0.3)]"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-[#ef4444] animate-pulse shrink-0" />
                <p className="text-sm font-black text-[#ef4444]">CRITICAL SOS — RECEIVED VIA MESH</p>
              </div>
              <button
                onClick={() => setMeshAlert(null)}
                className="text-slate-500 hover:text-white text-xs leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-xs font-bold text-white mb-0.5">
              Victim: {'VIC-' + (meshAlert.rawPacket?.originDeviceId ?? '00000').slice(-5).toUpperCase()}
            </p>
            <p className="text-xs text-slate-300 mb-0.5">
              {meshAlert.data.barangay ?? 'Unknown Location'}
              {meshAlert.data.municipality ? ` · ${meshAlert.data.municipality}` : ''}
              {meshAlert.data.status ? ` — ${meshAlert.data.status.toUpperCase()}` : ''}
            </p>
            <p className="text-[11px] text-slate-500 mb-3">
              {meshAlert.data.people_count ? `${meshAlert.data.people_count} person(s) · ` : ''}
              📡 Received via Mesh · 🔗 {5 - (meshAlert.rawPacket?.hopCount ?? 5)} Hop{5 - (meshAlert.rawPacket?.hopCount ?? 5) !== 1 ? 's' : ''}
            </p>
            <NeonButton
              size="sm"
              variant="red"
              onClick={() => navigate('/responder/queue')}
              className="w-full"
            >
              VIEW INCIDENT QUEUE
            </NeonButton>
          </motion.div>
        )}

        {/* Persistent mesh SOS list — RC-3: survives banner dismissal and page navigation */}
        {receivedMeshSOS.length > 0 && (
          <div className="glass rounded-2xl border border-[rgba(239,68,68,0.35)] overflow-hidden">
            <div className="px-4 py-2 flex items-center gap-2 border-b border-[rgba(239,68,68,0.2)]">
              <AlertTriangle size={14} className="text-[#ef4444] shrink-0" />
              <p className="text-[11px] font-black text-[#ef4444] uppercase tracking-wider">
                Offline Mesh SOS ({receivedMeshSOS.length})
              </p>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {receivedMeshSOS.map((entry, i) => (
                <div key={entry.rawPacket?.id ?? i} className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-white truncate">
                      {'VIC-' + (entry.rawPacket?.originDeviceId ?? '00000').slice(-5).toUpperCase()}
                      {entry.data.status ? ` — ${entry.data.status.toUpperCase()}` : ''}
                    </p>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      📡 {5 - (entry.rawPacket?.hopCount ?? 5)} hop{5 - (entry.rawPacket?.hopCount ?? 5) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {entry.data.barangay ?? 'Unknown'}{entry.data.municipality ? ` · ${entry.data.municipality}` : ''}
                    {entry.data.people_count ? ` · ${entry.data.people_count} person(s)` : ''}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-[rgba(239,68,68,0.2)]">
              <button
                onClick={() => navigate('/responder/relay')}
                className="text-[11px] text-[#00d4ff] hover:underline"
              >
                View full relay log →
              </button>
            </div>
          </div>
        )}

        {/* Duty toggle */}
        <GlassCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                onDuty ? 'bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.3)]' : 'bg-[rgba(107,114,128,0.2)] border border-[rgba(107,114,128,0.3)]'
              }`}>
                <Power size={18} className={onDuty ? 'text-[#22c55e]' : 'text-slate-500'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{onDuty ? 'On Duty' : 'Standby'}</p>
                <p className="text-xs text-slate-500">{onDuty ? 'Receiving rescue assignments' : 'Not receiving assignments'}</p>
              </div>
            </div>
            <NeonButton
              size="sm"
              variant={onDuty ? 'ghost' : 'green'}
              onClick={toggleDuty}
            >
              {onDuty ? 'Go Standby' : 'Go On Duty'}
            </NeonButton>
          </div>
        </GlassCard>

        {/* Mesh node indicator */}
        <motion.div
          animate={{ boxShadow: ['0 0 10px rgba(34,197,94,0.2)', '0 0 20px rgba(34,197,94,0.4)', '0 0 10px rgba(34,197,94,0.2)'] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="glass-bright rounded-2xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <Radio size={18} className="text-[#22c55e] animate-pulse" />
            <p className="text-sm font-semibold text-white">Active Mesh Node</p>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[#22c55e]">
              Relaying
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-black text-[#22c55e]">{stats.peersNearby}</p>
              <p className="text-[10px] text-slate-500">Peers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-[#00d4ff]">{stats.transport ?? '—'}</p>
              <p className="text-[10px] text-slate-500">Transport</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-[#8b5cf6]">{stats.relayEnabled ? 'On' : 'Off'}</p>
              <p className="text-[10px] text-slate-500">Relay</p>
            </div>
          </div>
        </motion.div>

        {/* Assignment stats */}
        <div className="grid grid-cols-2 gap-3">
          <GlassCard onClick={() => navigate('/responder/queue')} className="cursor-pointer hover:border-[rgba(0,212,255,0.3)]">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Assigned</p>
            <p className="text-3xl font-black text-[#00d4ff] my-1">{assignedCount}</p>
            <p className="text-xs text-slate-400">victims in queue</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Critical</p>
            <p className="text-3xl font-black text-[#ef4444] my-1">{criticalCount}</p>
            <p className="text-xs text-slate-400">need immediate help</p>
          </GlassCard>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          <NeonButton onClick={() => navigate('/responder/queue')} className="flex-col h-16 !px-2 text-center" size="sm">
            <List size={18} className="mb-1" />
            <span className="text-[10px]">View Queue</span>
          </NeonButton>
          <NeonButton onClick={() => navigate('/responder/map')} variant="violet" className="flex-col h-16 !px-2 text-center" size="sm">
            <Map size={18} className="mb-1" />
            <span className="text-[10px]">Open Map</span>
          </NeonButton>
          <NeonButton onClick={syncNow} variant="ghost" loading={syncing} className="flex-col h-16 !px-2 text-center" size="sm">
            <RefreshCw size={18} className={`mb-1 ${syncing ? 'animate-spin' : ''}`} />
            <span className="text-[10px]">Sync</span>
          </NeonButton>
        </div>

        {/* Critical alerts */}
        {criticalCount > 0 && (
          <div
            onClick={() => navigate('/responder/queue')}
            className="glass rounded-xl p-3 border border-[rgba(239,68,68,0.4)] cursor-pointer hover:border-[rgba(239,68,68,0.7)] transition-all"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#ef4444] animate-pulse shrink-0" />
              <p className="text-sm font-semibold text-[#ef4444]">{criticalCount} Critical Victims Awaiting Rescue</p>
            </div>
            <p className="text-xs text-slate-400 mt-1">Tap to view priority queue →</p>
          </div>
        )}
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
