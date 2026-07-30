import { useState, useEffect, useRef } from 'react'
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
  const muni = scope?.municipality
  const [onDuty, setOnDuty] = useState(false)
  const [sosList, setSosList] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [profile, setProfile] = useState(null)
  const [responderId, setResponderId] = useState(null)
  const responderIdRef = useRef(null)
  const stats = mesh.getStats()

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
    let watchId = null
    let active = true
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!active) return
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) return
      supabase.from('responders').select('id').eq('contact_number', contact).single()
        .then(({ data }) => {
          if (!active || !data) return
          responderIdRef.current = data.id
          setResponderId(data.id)
          watchId = navigator.geolocation.watchPosition(
            pos => {
              supabase.rpc('update_responder_location', {
                p_contact_number: contact,
                p_lat: pos.coords.latitude,
                p_lng: pos.coords.longitude,
              }).then(() => {})
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000 }
          )
        })
    })
    return () => {
      active = false
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
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
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const syncNow = async () => {
    setSyncing(true)
    await new Promise(r => setTimeout(r, 1200))
    setSyncing(false)
  }

  const toggleDuty = async () => {
    const newStatus = onDuty ? 'standby' : 'on_duty'
    setOnDuty(!onDuty)
    try {
      if (responderId) {
        await supabase.from('responders').update({ duty_status: newStatus }).eq('id', responderId)
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
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
              <p className="text-lg font-black text-[#22c55e]">{stats.peersConnected}</p>
              <p className="text-[10px] text-slate-500">Peers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-[#00d4ff]">{stats.messagesForwarded}</p>
              <p className="text-[10px] text-slate-500">Forwarded</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-[#8b5cf6]">{stats.dataRelayed}</p>
              <p className="text-[10px] text-slate-500">Relayed</p>
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
