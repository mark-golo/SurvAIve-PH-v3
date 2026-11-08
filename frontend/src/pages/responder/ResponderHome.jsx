import { useState, useEffect, useRef, useCallback } from 'react'
import { getResponderTheme } from '../../lib/victimTheme'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Home, Map, Radio, Settings, List, RefreshCw, Power,
  Star, WifiOff, QrCode, ChevronRight, CheckCircle, XCircle,
  Users, Shield, Zap,
} from 'lucide-react'
import { MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { NeonButton } from '../../components/ui/NeonButton'
import { mesh } from '../../lib/mesh'
import api, { logActivity } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { getNetworkOnline } from '../../lib/capacitor'
import { onMeshSOSAlert } from '../../lib/meshAlerts'
import { getReceivedSOS, onActivityChange } from '../../lib/meshActivityStore'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Mesh',     path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatLastSync(date) {
  if (!date) return null
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Ratings summary ───────────────────────────────────────────────────────────
function MyRatingsSummary({ responderId }) {
  const [ratings, setRatings] = useState(null)
  useEffect(() => {
    if (!responderId) return
    supabase
      .from('response_feedback')
      .select('rating,comments,created_at')
      .eq('target_type', 'responder')
      .eq('target_id', String(responderId))
      .eq('moderation_status', 'visible')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data || data.length === 0) { setRatings({ count: 0, avg: 0 }); return }
        const avg = data.reduce((s, r) => s + r.rating, 0) / data.length
        setRatings({ count: data.length, avg: avg.toFixed(1), recent: data.slice(0, 2) })
      })
      .catch(() => {})
  }, [responderId])

  if (!ratings || ratings.count === 0) return null

  return (
    <div className="glass rounded-2xl p-4 border border-[rgba(245,158,11,0.2)] space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-amber-400" />
          <p className="text-sm font-semibold text-white">My Response Ratings</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-base font-black text-amber-400">{ratings.avg}</span>
          <span className="text-xs text-slate-500"> / 5 · {ratings.count} review{ratings.count !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {ratings.recent?.filter(r => r.comments).slice(0, 1).map((r, i) => (
        <p key={i} className="text-xs text-slate-400 border-l-2 border-amber-700 pl-3 italic">"{r.comments}"</p>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ResponderHome() {
  const navigate  = useNavigate()
  const { scope } = useAuthStore()
  const [isLight] = useState(() => getResponderTheme() === 'light')
  const muni = scope?.municipality

  // Core state
  const [onDuty,       setOnDuty]       = useState(false)
  const [sosList,      setSosList]      = useState([])
  const [syncing,      setSyncing]      = useState(false)
  const [lastSync,     setLastSync]     = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [responderId,  setResponderId]  = useState(null)
  const responderIdRef  = useRef(null)
  const lastGpsUpdateRef = useRef(null)
  const dutyChangingRef  = useRef(false)

  // Mesh / network state
  const [stats,        setStats]        = useState({ peersNearby: 0, transport: 'starting', relayEnabled: false })
  const [networkOnline, setNetworkOnline] = useState(() => getNetworkOnline())
  const [meshAlert,    setMeshAlert]    = useState(null)
  const [receivedMeshSOS, setReceivedMeshSOS] = useState(() => getReceivedSOS())

  // UI state
  const [showStandbyConfirm, setShowStandbyConfirm] = useState(false)
  const [showQRScanner,      setShowQRScanner]      = useState(false)
  const [qrResult,           setQrResult]           = useState(null) // { id, name } | 'scanning' | 'error'
  const qrRef = useRef(null)

  // ── Derived stats ─────────────────────────────────────────────────────────
  const activeList    = sosList.filter(r => r.rescue_status !== 'rescued')
  const assignedCount = activeList.length
  const criticalCount = activeList.filter(r => r.priority === 'CRITICAL').length
  const pendingCount  = activeList.filter(r => !r.rescue_status || r.rescue_status === 'pending').length
  const rescuedCount  = sosList.filter(r => r.rescue_status === 'rescued').length

  // ── Mesh stats polling ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => setStats(await mesh.getStats())
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  // Network state polling
  useEffect(() => {
    const t = setInterval(() => setNetworkOnline(getNetworkOnline()), 5000)
    return () => clearInterval(t)
  }, [])

  // Mesh SOS alert banner
  useEffect(() => {
    return onMeshSOSAlert((data, rawPacket) => setMeshAlert({ data, rawPacket, time: Date.now() }))
  }, [])

  // Persistent mesh SOS list
  useEffect(() => {
    return onActivityChange(() => setReceivedMeshSOS(getReceivedSOS()))
  }, [])

  // ── Load responder profile ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) return
      supabase
        .from('responders')
        .select('id,name,unit_name,assigned_zone,duty_status,municipality,province')
        .eq('contact_number', contact)
        .single()
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

  // ── GPS location tracking ─────────────────────────────────────────────────
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
          const dlat = (lat - last.lat) * Math.PI / 180
          const dlng = (lng - last.lng) * Math.PI / 180
          const a = dlat * dlat + Math.cos(last.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * dlng * dlng
          const distM = 6371000 * Math.sqrt(a)
          if (elapsed < 30000 && distM < 10) return
        }
        lastGpsUpdateRef.current = { ts: now, lat, lng }
        supabase.from('responders').update({ lat, lng, last_seen_at: new Date().toISOString() })
          .eq('id', id).then(() => {})
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ── Load SOS list ─────────────────────────────────────────────────────────
  useEffect(() => {
    const url = muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos'
    api.get(url)
      .then(rows => { setSosList(rows); setLastSync(new Date()) })
      .catch(() => {})
  }, [muni])

  // ── Supabase real-time SOS updates ────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('rh-sos-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sos_reports' }, payload => {
        const r = payload.new
        if (muni && r.municipality !== muni) return
        setSosList(prev => prev.map(x => x.id === r.id ? { ...x, rescue_status: r.rescue_status, priority: r.priority } : x))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_reports' }, payload => {
        const r = payload.new
        if (muni && r.municipality !== null && r.municipality !== muni) return
        setSosList(prev => [r, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [muni])

  // ── Actions ───────────────────────────────────────────────────────────────
  const syncNow = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const url = muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos'
      const rows = await api.get(url)
      setSosList(rows)
      setLastSync(new Date())
    } catch {}
    setSyncing(false)
  }

  const handleDutyToggle = () => {
    if (dutyChangingRef.current) return
    if (onDuty) {
      setShowStandbyConfirm(true)
    } else {
      goOnDuty()
    }
  }

  const goOnDuty = useCallback(async () => {
    if (dutyChangingRef.current) return
    dutyChangingRef.current = true
    const prev = onDuty
    setOnDuty(true)
    try {
      if (responderId) {
        await supabase.from('responders').update({ duty_status: 'on_duty' }).eq('id', responderId)
        logActivity('PUT', 'responders', 'responders', responderId, { duty_status: 'on_duty', previous_duty_status: 'standby' })
      }
    } catch { setOnDuty(prev) }
    finally { dutyChangingRef.current = false }
  }, [onDuty, responderId])

  const confirmGoStandby = useCallback(async () => {
    setShowStandbyConfirm(false)
    if (dutyChangingRef.current) return
    dutyChangingRef.current = true
    const prev = onDuty
    setOnDuty(false)
    try {
      if (responderId) {
        await supabase.from('responders').update({ duty_status: 'standby' }).eq('id', responderId)
        logActivity('PUT', 'responders', 'responders', responderId, { duty_status: 'standby', previous_duty_status: 'on_duty' })
      }
    } catch { setOnDuty(prev) }
    finally { dutyChangingRef.current = false }
  }, [onDuty, responderId])

  // ── QR Scanner ────────────────────────────────────────────────────────────
  const openQRScanner = () => { setQrResult('scanning'); setShowQRScanner(true) }
  const closeQRScanner = useCallback(() => {
    setShowQRScanner(false)
    setQrResult(null)
    if (qrRef.current) { qrRef.current.stop().catch(() => {}); qrRef.current = null }
  }, [])

  useEffect(() => {
    if (!showQRScanner || qrResult !== 'scanning') return
    let mounted = true
    const timer = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const qr = new Html5Qrcode('qr-responder-scan')
        if (!mounted) return
        qrRef.current = qr
        await qr.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 220, height: 220 } },
          async (text) => {
            if (!text.startsWith('SURVPH:EVACUEE:')) { setQrResult('error'); return }
            const parts = text.split(':')
            const eid   = parts[2] ?? ''
            const ename = parts[3] ? decodeURIComponent(parts[3]) : ''
            if (!eid || eid === 'null') { setQrResult('error'); return }
            if (qrRef.current) { qrRef.current.stop().catch(() => {}); qrRef.current = null }
            // Try to resolve name from DB
            let resolvedName = ename
            try {
              const rows = await api.get(`/victims?victim_id=${encodeURIComponent(eid)}`)
              if (Array.isArray(rows) && rows[0]?.name) resolvedName = rows[0].name
            } catch {}
            if (mounted) setQrResult({ id: eid, name: resolvedName || eid })
          },
          () => {}
        )
      } catch { if (mounted) setQrResult('error') }
    }, 150)
    return () => {
      mounted = false
      clearTimeout(timer)
      if (qrRef.current) { qrRef.current.stop().catch(() => {}); qrRef.current = null }
    }
  }, [showQRScanner, qrResult])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const name = profile?.name || 'Responder'
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

  // Connectivity display helpers
  const transportLabel = (() => {
    const t = stats.transport ?? ''
    if (!t || t === 'starting') return 'Starting…'
    if (t === 'not started' || t === 'start_failed' || t === 'error') return 'Unavailable'
    return t.toUpperCase()
  })()
  const meshColor = stats.peersNearby > 0 ? '#22c55e' : '#6b7280'

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="glass border-b border-[rgba(255,255,255,0.08)] px-4 py-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500">{getGreeting()},</p>
            <h1 className="font-bold text-white text-sm leading-tight truncate">{name}</h1>
            <p className="text-[10px] text-slate-500 truncate">
              {profile?.unit_name ?? 'Unit —'} · {profile?.assigned_zone ?? 'Zone —'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!networkOnline && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)]">
                <WifiOff size={10} className="text-[#ef4444]" />
                <span className="text-[9px] font-bold text-[#ef4444]">OFFLINE</span>
              </div>
            )}
            <StatusBadge status={onDuty ? 'ACTIVE' : 'STANDBY'} pulse={onDuty} />
          </div>
        </div>
        <p className="text-[10px] text-slate-600 mt-0.5">{today}</p>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-nav">

        {/* ── Mesh SOS alert banner ───────────────────────────────────── */}
        <AnimatePresence>
          {meshAlert && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="glass rounded-2xl p-4 border-2 border-[rgba(239,68,68,0.6)] shadow-[0_0_24px_rgba(239,68,68,0.3)]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[#ef4444] animate-pulse shrink-0" />
                  <p className="text-sm font-black text-[#ef4444]">CRITICAL SOS — MESH</p>
                </div>
                <button onClick={() => setMeshAlert(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
              </div>
              <p className="text-xs font-bold text-white mb-0.5">
                VIC-{(meshAlert.rawPacket?.originDeviceId ?? '00000').slice(-5).toUpperCase()}
              </p>
              <p className="text-xs text-slate-300 mb-2">
                {meshAlert.data.barangay ?? 'Unknown Location'}
                {meshAlert.data.municipality ? ` · ${meshAlert.data.municipality}` : ''}
                {meshAlert.data.status ? ` — ${meshAlert.data.status.toUpperCase()}` : ''}
                {meshAlert.data.people_count ? ` · ${meshAlert.data.people_count} person(s)` : ''}
              </p>
              <NeonButton size="sm" variant="red" onClick={() => navigate('/responder/queue')} className="w-full">
                VIEW INCIDENT QUEUE
              </NeonButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Persistent offline mesh SOS list ───────────────────────── */}
        {receivedMeshSOS.length > 0 && (
          <div className="glass rounded-2xl border border-[rgba(239,68,68,0.35)] overflow-hidden">
            <div className="px-4 py-2 flex items-center gap-2 border-b border-[rgba(239,68,68,0.2)]">
              <AlertTriangle size={13} className="text-[#ef4444] shrink-0" />
              <p className="text-[11px] font-black text-[#ef4444] uppercase tracking-wider">
                Offline Mesh SOS ({receivedMeshSOS.length})
              </p>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {receivedMeshSOS.map((entry, i) => (
                <div key={entry.rawPacket?.id ?? i} className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-white truncate">
                      VIC-{(entry.rawPacket?.originDeviceId ?? '00000').slice(-5).toUpperCase()}
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
            <button onClick={() => navigate('/responder/relay')}
              className="w-full px-4 py-2 border-t border-[rgba(239,68,68,0.2)] text-[11px] text-[#00d4ff] hover:underline text-left">
              View full relay log →
            </button>
          </div>
        )}

        {/* ── 1. Duty Status card ─────────────────────────────────────── */}
        <GlassCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                onDuty
                  ? 'bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.3)]'
                  : 'bg-[rgba(107,114,128,0.2)] border border-[rgba(107,114,128,0.3)]'
              }`}>
                <Power size={18} className={onDuty ? 'text-[#22c55e]' : 'text-slate-500'} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{onDuty ? 'ON DUTY' : 'ON STANDBY'}</p>
                <p className="text-xs text-slate-500">
                  {onDuty ? 'Ready to receive rescue assignments' : 'Temporarily unavailable for new assignments'}
                </p>
              </div>
            </div>
            <NeonButton
              size="sm"
              variant={onDuty ? 'ghost' : 'green'}
              onClick={handleDutyToggle}
              className="shrink-0"
            >
              {onDuty ? 'Go Standby' : 'Go On Duty'}
            </NeonButton>
          </div>
        </GlassCard>

        {/* ── 2. Critical Rescue Alerts (Priority!) ───────────────────── */}
        {criticalCount > 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => navigate('/responder/queue')}
            className="glass rounded-xl p-4 border border-[rgba(239,68,68,0.5)] cursor-pointer hover:border-[rgba(239,68,68,0.8)] transition-all shadow-[0_0_16px_rgba(239,68,68,0.15)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-[#ef4444] animate-pulse shrink-0" />
              <p className="text-sm font-black text-[#ef4444] uppercase tracking-wide">CRITICAL RESCUE ALERTS</p>
            </div>
            <p className="text-2xl font-black text-[#ef4444] leading-none mb-1">{criticalCount}</p>
            <p className="text-xs text-slate-400">victim{criticalCount !== 1 ? 's' : ''} requiring immediate attention</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-[#ef4444] font-semibold">
              View Priority Queue <ChevronRight size={13} />
            </div>
          </motion.div>
        ) : (
          <div className="glass rounded-xl px-4 py-3 border border-[rgba(34,197,94,0.2)] flex items-center gap-3">
            <CheckCircle size={15} className="text-[#22c55e] shrink-0" />
            <p className="text-xs text-slate-400">No critical alerts at this time</p>
          </div>
        )}

        {/* ── 3. Rescue Statistics ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => navigate('/responder/queue')}
            className="glass rounded-xl p-3.5 border border-[rgba(255,255,255,0.08)] cursor-pointer hover:border-[rgba(0,212,255,0.3)] transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Assigned</span>
              <Users size={12} className="text-[#00d4ff] opacity-70" />
            </div>
            <p className="text-3xl font-black text-[#00d4ff]">{assignedCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">victims in queue</p>
          </div>
          <div
            onClick={criticalCount > 0 ? () => navigate('/responder/queue') : undefined}
            className={`glass rounded-xl p-3.5 border border-[rgba(255,255,255,0.08)] transition-all ${criticalCount > 0 ? 'cursor-pointer hover:border-[rgba(239,68,68,0.3)]' : ''}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Critical</span>
              <AlertTriangle size={12} className="text-[#ef4444] opacity-70" />
            </div>
            <p className={`text-3xl font-black ${criticalCount > 0 ? 'text-[#ef4444]' : 'text-slate-500'}`}>{criticalCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">need immediate help</p>
          </div>
          <div className="glass rounded-xl p-3.5 border border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Pending</span>
              <Zap size={12} className="text-[#f97316] opacity-70" />
            </div>
            <p className="text-3xl font-black text-[#f97316]">{pendingCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">awaiting action</p>
          </div>
          <div className="glass rounded-xl p-3.5 border border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Rescued</span>
              <Shield size={12} className="text-[#22c55e] opacity-70" />
            </div>
            <p className="text-3xl font-black text-[#22c55e]">{rescuedCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">confirmed rescued</p>
          </div>
        </div>

        {/* ── 4. Quick Actions ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {/* View Queue — cyan fill, white icon + label */}
          <button
            onClick={() => navigate('/responder/queue')}
            className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#0ea5e9] shadow-[0_0_18px_rgba(0,212,255,0.4)] hover:shadow-[0_0_28px_rgba(0,212,255,0.7)] active:scale-95 transition-all"
          >
            <List size={18} className="text-white" />
            <span className="text-[11px] font-bold text-white">View Queue</span>
          </button>
          {/* Open Map — purple fill, white icon + label */}
          <button
            onClick={() => navigate('/responder/map')}
            className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] shadow-[0_0_18px_rgba(139,92,246,0.4)] hover:shadow-[0_0_28px_rgba(139,92,246,0.7)] active:scale-95 transition-all"
          >
            <Map size={18} className="text-white" />
            <span className="text-[11px] font-bold text-white">Open Map</span>
          </button>
          {/* Sync Data — ghost/dark, cyan icon + label */}
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-transparent border border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.08)] hover:border-[rgba(0,212,255,0.6)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={`text-[#00d4ff] ${syncing ? 'animate-spin' : ''}`} />
            <span className="text-[11px] font-bold text-[#00d4ff]">{syncing ? 'Syncing…' : 'Sync Data'}</span>
          </button>
        </div>
        {lastSync && (
          <p className="text-center text-[10px] text-slate-600">
            Last synced {formatLastSync(lastSync)}
            {!networkOnline && ' · Offline mode'}
          </p>
        )}

        {/* ── 5. Active Mesh Node / Connectivity ──────────────────────── */}
        <div
          onClick={() => navigate('/responder/relay')}
          className="glass rounded-2xl p-4 border border-[rgba(34,197,94,0.2)] cursor-pointer hover:border-[rgba(34,197,94,0.4)] transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio size={15} className={stats.peersNearby > 0 ? 'text-[#22c55e] animate-pulse' : 'text-slate-500'} />
              <p className="text-sm font-semibold text-white">Active Mesh Node</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                stats.relayEnabled
                  ? 'bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.3)] text-[#22c55e]'
                  : 'bg-[rgba(107,114,128,0.1)] border-[rgba(107,114,128,0.2)] text-slate-500'
              }`}>
                RELAY {stats.relayEnabled ? 'ON' : 'OFF'}
              </span>
              <ChevronRight size={13} className="text-slate-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <ConnRow label="Connected Peers" value={String(stats.peersNearby)} accent={meshColor} />
            <ConnRow label="Active Transport" value={transportLabel} accent="#00d4ff" />
            <ConnRow label="Internet"
              value={networkOnline ? 'Available' : 'Offline'}
              accent={networkOnline ? '#22c55e' : '#ef4444'} />
            <ConnRow label="Relay Status"
              value={stats.relayEnabled ? 'ON' : 'OFF'}
              accent={stats.relayEnabled ? '#22c55e' : '#6b7280'} />
          </div>

          <p className="text-[10px] text-slate-600 mt-2 text-right">Tap for mesh diagnostics →</p>
        </div>

        {/* ── 6. My Response Ratings ──────────────────────────────────── */}
        <MyRatingsSummary responderId={responderId} />

        {/* ── 7. Scan Evacuee QR ──────────────────────────────────────── */}
        <GlassCard
          onClick={openQRScanner}
          className="cursor-pointer hover:border-[rgba(0,212,255,0.3)] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center shrink-0">
              <QrCode size={18} className="text-[#00d4ff]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Scan Evacuee QR</p>
              <p className="text-xs text-slate-500">Record and verify evacuee arrival at evacuation centers</p>
            </div>
            <ChevronRight size={15} className="text-slate-500 shrink-0" />
          </div>
        </GlassCard>

      </main>

      <MobileNavBar items={NAV} />

      {/* ── Standby Confirmation Dialog ─────────────────────────────── */}
      <AnimatePresence>
        {showStandbyConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-5 max-w-sm w-full border border-[rgba(255,255,255,0.1)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <Power size={18} className="text-slate-400" />
                <p className="font-bold text-white">Go Standby?</p>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                You will not receive new rescue assignments while on Standby.
                Your existing assignments will not be removed.
              </p>
              {!networkOnline && (
                <p className="text-xs text-[#f59e0b] mb-3">
                  ⚠ You are offline — this change will sync when connectivity is restored.
                </p>
              )}
              <div className="flex gap-3">
                <NeonButton variant="ghost" onClick={() => setShowStandbyConfirm(false)} className="flex-1">
                  Cancel
                </NeonButton>
                <NeonButton variant="red" onClick={confirmGoStandby} className="flex-1">
                  Go Standby
                </NeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QR Scanner Overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {showQRScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-[#00d4ff]" />
                <p className="text-sm font-bold text-white">Scan Evacuee QR</p>
              </div>
              <button onClick={closeQRScanner} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            {/* Scanner / Result */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
              {qrResult === 'scanning' && (
                <>
                  {/* Camera viewport */}
                  <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-black border-2 border-[rgba(0,212,255,0.4)]">
                    <div id="qr-responder-scan" className="w-full h-full" />
                    {/* Scan beam */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-4 right-4 h-0.5 bg-[#00d4ff] opacity-70 animate-[scanBeam_2s_ease-in-out_infinite]" />
                      {/* Corner marks */}
                      {[['top-2 left-2', 'border-t-2 border-l-2'],['top-2 right-2', 'border-t-2 border-r-2'],
                        ['bottom-2 left-2', 'border-b-2 border-l-2'],['bottom-2 right-2', 'border-b-2 border-r-2']].map(([pos, border], i) => (
                        <div key={i} className={`absolute ${pos} w-6 h-6 ${border} border-[#00d4ff] rounded-sm`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">Point the camera at an evacuee's QR code</p>
                </>
              )}

              {typeof qrResult === 'object' && qrResult !== null && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full max-w-sm glass rounded-2xl p-5 border border-[rgba(34,197,94,0.4)] space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-[#22c55e]" />
                    <p className="font-bold text-white">Evacuee Verified</p>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    <p className="text-sm text-white font-semibold">{qrResult.name}</p>
                    <p className="text-xs text-slate-500">Victim ID: {qrResult.id}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    QR code is valid. Use the Admin Evacuation Centers module to record an official check-in.
                  </p>
                  <div className="flex gap-3 pt-1">
                    <NeonButton variant="ghost" onClick={closeQRScanner} className="flex-1">Close</NeonButton>
                    <NeonButton onClick={() => { closeQRScanner(); setQrResult('scanning'); openQRScanner() }} className="flex-1">Scan Again</NeonButton>
                  </div>
                </motion.div>
              )}

              {qrResult === 'error' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full max-w-sm glass rounded-2xl p-5 border border-[rgba(239,68,68,0.4)] space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <XCircle size={18} className="text-[#ef4444]" />
                    <p className="font-bold text-white">Invalid QR Code</p>
                  </div>
                  <p className="text-xs text-slate-400">This QR code is not a valid SurvAIve PH evacuee code. Please try again.</p>
                  <div className="flex gap-3">
                    <NeonButton variant="ghost" onClick={closeQRScanner} className="flex-1">Cancel</NeonButton>
                    <NeonButton variant="red" onClick={() => setQrResult('scanning')} className="flex-1">Retry</NeonButton>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Helper sub-components ─────────────────────────────────────────────────────
function ConnRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-[11px] font-bold" style={{ color: accent }}>{value}</span>
    </div>
  )
}
