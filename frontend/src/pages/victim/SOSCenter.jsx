import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertOctagon, Clock, Activity, CheckCircle, ChevronRight, WifiOff, Map, Radio, Settings, Home, MessageSquare } from 'lucide-react'
import { MobileNavBar } from '../../components/ui/NavBar'
import { TopBar } from '../../components/ui/NavBar'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import api from '../../lib/api'
import { db } from '../../lib/db'
import { supabase } from '../../lib/supabase'

const NAV = [
  { icon: Home,          label: 'Home',    path: '/home'     },
  { icon: MessageSquare, label: 'SOS',     path: '/sos'      },
  { icon: Map,           label: 'Map',     path: '/map'      },
  { icon: Radio,         label: 'Mesh',    path: '/mesh'     },
  { icon: Settings,      label: 'Settings',path: '/settings' },
]

export function SOSCenter() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [isOnline]= useState(getNetworkOnline)
  const [reports, setReports]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [hasPending, setHasPending] = useState(false)
  // reloadKey triggers the load effect when incremented (e.g. from Realtime subscription)
  const [reloadKey, setReloadKey] = useState(0)
  // victimId for Realtime subscription filter — computed once from localStorage on mount
  const [victimIdForSub] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('survAIve-auth') ?? '{}')
      return stored?.state?.user?.victim_id ?? null
    } catch { return null }
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Read victim_id fresh from localStorage to avoid stale closure issues.
      let victimId = null
      try {
        const stored = JSON.parse(localStorage.getItem('survAIve-auth') ?? '{}')
        victimId = stored?.state?.user?.victim_id ?? null
      } catch { /* ignore */ }

      // 1. Always read from IndexedDB — both confirmed (synced) and pending records.
      //    No victimId guard: guest victims (no victim_id) and registered victims both
      //    get their records. Filter: exact match OR null victim_id (guest/old submissions).
      let local = []
      try {
        const all = await db.getAllSOS()
        local = all
          .filter(item => !victimId || item.victim_id === victimId || item.victim_id == null)
          .map(item => ({
            ...item,
            rescue_status: item.rescue_status ?? 'pending',
            created_at:    item.timestamp
              ? new Date(item.timestamp).toISOString()
              : new Date(item.createdAt ?? Date.now()).toISOString(),
            _fromQueue: true,
          }))
      } catch { /* IndexedDB unavailable */ }

      // 2. Also try Supabase / PHP for live status updates (responder assigned, etc.)
      //    Confirmed records take precedence over local cache for deduplication.
      let confirmed = []
      if (isOnline && victimId) {
        try {
          const data = await api.get('/sos/mine')
          confirmed = Array.isArray(data) ? data : []
        } catch { /* RPC not deployed or network error — show local only */ }
      }

      // Guest path: no victim_id but local SOS records exist → check live status in Supabase
      // by mesh_packet_id. The 15-second poll re-runs load() so the tile updates within 15 s.
      if (isOnline && !victimId && local.length > 0) {
        try {
          const meshIds = local
            .map(r => r.mesh_packet_id ?? r.meshPacketId)
            .filter(Boolean)
          if (meshIds.length > 0) {
            const { data } = await supabase
              .from('sos_reports')
              .select('id, mesh_packet_id, rescue_status, confirmed_by_name, confirmed_at, notes, assigned_responder_id')
              .in('mesh_packet_id', meshIds)
            if (Array.isArray(data) && data.length > 0) {
              confirmed = data.map(r => ({
                ...r,
                rescue_status: (r.rescue_status === 'pending' && r.confirmed_by_name && !r.confirmed_at)
                  ? 'acknowledged'
                  : r.rescue_status,
              }))
            }
          }
        } catch { /* Supabase not reachable — keep local data */ }
      }

      // Merge: Supabase/server records take precedence (have live status updates).
      // Deduplicate by both id and mesh_packet_id so synced local records don't
      // appear alongside their confirmed server counterpart.
      const confirmedIds     = new Set(confirmed.map(r => r.id).filter(Boolean))
      const confirmedPackets = new Set(confirmed.map(r => r.mesh_packet_id).filter(Boolean))
      const localOnly = local.filter(p =>
        !confirmedIds.has(p.id) &&
        !confirmedPackets.has(p.mesh_packet_id ?? p.meshPacketId)
      )

      if (!cancelled) {
        // Only show the amber banner for records that haven't reached the server (synced:false).
        setHasPending(localOnly.some(p => !p.synced) && confirmed.length === 0)
        setReports([...confirmed, ...localOnly])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isOnline, reloadKey])

  // Supabase Realtime subscription — auto-refresh when a responder updates this victim's SOS.
  useEffect(() => {
    if (!victimIdForSub || !isOnline) return
    const ch = supabase.channel('victim-sos-updates')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_reports',
          filter: `victim_device_id=eq.${victimIdForSub}` },
        () => { setReloadKey(k => k + 1) }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [victimIdForSub, isOnline])

  // Polling fallback — re-check tile counts every 15 s even if Realtime doesn't fire
  useEffect(() => {
    if (!isOnline) return
    const interval = setInterval(() => setReloadKey(k => k + 1), 15_000)
    return () => clearInterval(interval)
  }, [isOnline])

  const active    = reports.filter(r => r.rescue_status !== 'rescued' && !r.dismissed)
  const awaiting  = reports.filter(r => r.rescue_status === 'acknowledged')
  const inprog    = reports.filter(r => ['en_route','on_scene','cannot_reach'].includes(r.rescue_status))
  const completed = reports.filter(r => r.rescue_status === 'rescued' || r.dismissed)

  function goToTracking() {
    navigate('/sos/tracking')
  }

  const stats = [
    { label: 'Active',           value: active.length,    icon: AlertOctagon, color: 'text-red-400',   bg: 'from-red-900/30 to-red-800/20' },
    { label: 'Acknowledged',      value: awaiting.length,  icon: Clock,        color: 'text-amber-400', bg: 'from-amber-900/30 to-amber-800/20' },
    { label: 'In Progress',      value: inprog.length,    icon: Activity,     color: 'text-blue-400',  bg: 'from-blue-900/30 to-blue-800/20' },
    { label: 'Completed',        value: completed.length, icon: CheckCircle,  color: 'text-green-400', bg: 'from-green-900/30 to-green-800/20' },
  ]

  const mgmt = [
    {
      label: 'Response Tracking',
      sub: 'Track your active SOS incidents',
      icon: Activity,
      badge: active.length > 0
        ? { text: `${active.length} Active SOS`, cls: 'bg-green-900/40 text-green-400' }
        : null,
      onClick: goToTracking,
    },
    {
      label: 'Incident History',
      sub: 'View all your SOS records',
      icon: Clock,
      badge: reports.length > 0
        ? { text: `${reports.length} Records`, cls: 'bg-blue-900/40 text-blue-400' }
        : null,
      onClick: () => navigate('/sos/history'),
    },
    {
      label: 'Post-Rescue Feedback',
      sub: 'Rate completed responses',
      icon: CheckCircle,
      badge: completed.length > 0
        ? { text: `${completed.length} Pending Reviews`, cls: 'bg-amber-900/40 text-amber-400' }
        : null,
      onClick: () => navigate('/sos/history', {
        state: { overrideTitle: 'Post-Rescue Feedback', overrideTab: 'completed' }
      }),
    },
  ]

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="SOS Center" subtitle={user?.name ?? 'Emergency Services'} />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-nav">

        {/* Emergency SOS button */}
        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/sos/new')}
          className="w-full py-5 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 border border-red-500/40
                     shadow-[0_0_32px_rgba(239,68,68,0.3)] flex items-center justify-center gap-3 active:opacity-90">
          <AlertOctagon size={24} className="text-white" />
          <span className="text-white text-lg font-black tracking-wide">Send Emergency SOS</span>
        </motion.button>

        {/* Overview tiles */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Emergency Overview</p>
          {!isOnline ? (
            <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-amber-500/20">
              <WifiOff size={18} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400">Offline — overview unavailable. Connect to see your SOS history.</p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="glass rounded-2xl p-4 h-20 animate-pulse bg-[rgba(255,255,255,0.03)]" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {stats.map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`glass rounded-2xl p-4 bg-gradient-to-br ${bg} border border-[rgba(255,255,255,0.06)]`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={14} className={color} />
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>
                    </div>
                    <p className={`text-3xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              {hasPending && (
                <div className="mt-2 rounded-xl px-3 py-2 flex items-center gap-2 border border-amber-500/30 bg-amber-900/20">
                  <Clock size={13} className="text-amber-400 shrink-0" />
                  <p className="text-[11px] text-amber-400">SOS queued locally — awaiting server sync</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* SOS Management cards */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">SOS Management</p>
          <div className="space-y-2">
            {mgmt.map(({ label, sub, icon: Icon, badge, onClick }) => (
              <button key={label} onClick={onClick}
                className="w-full glass rounded-2xl p-4 flex items-center gap-4 border border-[rgba(255,255,255,0.06)]
                           hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] transition-all text-left">
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)]
                                flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-[#00d4ff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                </div>
                {badge && !loading && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${badge.cls}`}>
                    {badge.text}
                  </span>
                )}
                <ChevronRight size={16} className="text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>

      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
