import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, BookUser, BarChart2, Radio, UserCog, MapPin, LogOut, Menu, ClipboardList, FileBarChart, Settings2, Bell, Layers } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../store/auth'
import { useAlertStore } from '../../store/alertStore'
import { supabase } from '../../lib/supabase'
import api from '../../lib/api'
import { getAdminTheme, saveAdminTheme } from '../../lib/victimTheme'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Command Center',           path: '/admin'                    },
  { icon: Users,           label: 'Victim Status',            path: '/admin/victims'            },
  { icon: Radio,           label: 'Rescue Updates',           path: '/admin/responders'         },
  { icon: BookUser,        label: 'Constituents',             path: '/admin/constituents'       },
  { icon: MapPin,          label: 'Evacuation Centers',       path: '/admin/evacuation-centers' },
  { icon: FileBarChart,    label: 'Emergency Report',         path: '/admin/emergency-report'         },
  { icon: Layers,          label: 'Barangays Comparison',     path: '/admin/barangays-comparison'     },
  { icon: ClipboardList,   label: 'SITREP',                   path: '/admin/sitrep'                   },
  { icon: BarChart2,       label: 'AI Situational Analytics', path: '/admin/analytics'          },
  { icon: UserCog,         label: 'Staff Management',         path: '/admin/staff'              },
]

// ─── Page title lookup (used by single layout instance) ──────────────────────
const PAGE_TITLES = {
  '/admin':                    'Command Center',
  '/admin/victims':            'Affected Person Status',
  '/admin/constituents':       'Constituent Registry',
  '/admin/analytics':          'AI Situational Analytics',
  '/admin/responders':         'Rescue Updates',
  '/admin/staff':              'Staff Management',
  '/admin/evacuation-centers': 'Evacuation Centers',
  '/admin/emergency-report':        'Emergency Report',
  '/admin/barangays-comparison':    'Barangays Comparison',
  '/admin/sitrep':                  'SITREP',
  '/admin/settings':           'Settings',
}

// ─── Web Audio alarm tone (synthesised — no audio file needed) ────────────────
function playAlarmTone(vol, audioCtxRef) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // Keep a reference so we can close it on mute
    audioCtxRef.current = ctx
    let t = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(880, t)
      osc.frequency.setValueAtTime(660, t + 0.15)
      gain.gain.setValueAtTime(vol * 0.55, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
      osc.start(t)
      osc.stop(t + 0.42)
      t += 0.62
    }
  } catch { /* blocked by browser autoplay policy */ }
}

// ─── Main layout ─────────────────────────────────────────────────────────────
export function AdminLayout() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? 'Admin'
  const navigate     = useNavigate()
  const { user, logout, scope } = useAuthStore()
  const muni = scope?.municipality

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminTheme, setAdminTheme] = useState(() => getAdminTheme())

  // Alert settings from persisted store
  const { soundEnabled, visualEnabled, notificationEnabled, volume } = useAlertStore()

  // Transient alert state (not persisted — resets on page reload)
  const [alertQueue,  setAlertQueue]  = useState([])   // { id, name, barangay, municipality, ts }
  const [alertActive, setAlertActive] = useState(false) // visual pulse is running
  const [muteActive,  setMuteActive]  = useState(false) // audio/visual muted for current cycle

  const audioCtxRef     = useRef(null)
  const soundIntervalRef = useRef(null)  // interval that repeats the alarm tone
  const seenIdsRef      = useRef(new Set()) // dedup set for realtime + polling

  // ── Core trigger ─────────────────────────────────────────────────────────
  const triggerAlert = useCallback((entry) => {
    setAlertQueue(q => [...q, entry])
    setMuteActive(prev => {
      if (!prev) {
        // Start continuous visual pulse
        if (visualEnabled) setAlertActive(true)
        // Play audio immediately, then repeat every 2.8s until muted or acknowledged
        if (soundEnabled) {
          playAlarmTone(volume, audioCtxRef)
          if (!soundIntervalRef.current) {
            soundIntervalRef.current = setInterval(() => {
              playAlarmTone(volume, audioCtxRef)
            }, 2800)
          }
        }
      }
      return prev
    })
  }, [visualEnabled, soundEnabled, volume])

  // ── Acknowledge one alert ─────────────────────────────────────────────────
  const acknowledgeAlert = useCallback((id) => {
    setAlertQueue(prev => {
      const next = prev.filter(a => a.id !== id)
      if (next.length === 0) {
        // No more alerts — stop everything
        setAlertActive(false)
        setMuteActive(false)
        if (soundIntervalRef.current) {
          clearInterval(soundIntervalRef.current)
          soundIntervalRef.current = null
        }
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {})
          audioCtxRef.current = null
        }
      }
      return next
    })
  }, [])

  // ── Mute current cycle (audio + visual stop; card remains for acknowledge) ─
  const muteCurrentAlert = useCallback(() => {
    setMuteActive(true)
    setAlertActive(false)
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current)
      soundIntervalRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [])

  // ── Expose to Settings page via window refs ───────────────────────────────
  useEffect(() => {
    window.__triggerTestAlert = () => triggerAlert({
      id:           'test-' + Date.now(),
      name:         'Test Alert',
      barangay:     'Test Barangay',
      municipality: '',
      ts:           new Date().toLocaleTimeString(),
    })
    window.__muteCurrentAlert = muteCurrentAlert
    return () => {
      delete window.__triggerTestAlert
      delete window.__muteCurrentAlert
    }
  }, [triggerAlert, muteCurrentAlert])

  // ── Expose theme setter to Settings page ─────────────────────────────────
  useEffect(() => {
    window.__setAdminTheme = (t) => {
      saveAdminTheme(t)
      setAdminTheme(t)
    }
    return () => { delete window.__setAdminTheme }
  }, [])

  // ── Supabase realtime — immediate notification for verified SOS ───────────
  useEffect(() => {
    const ch = supabase.channel('admin-sos-alert')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_reports' },
        payload => {
          const r = payload.new
          // FIX: Only filter by municipality when the SOS record itself has one set
          // (guest SOS often arrives with null municipality — don't drop it)
          if (muni && r.municipality && r.municipality !== muni) return
          // Dedup: if polling already alerted this ID, skip
          if (seenIdsRef.current.has(r.id)) return
          seenIdsRef.current.add(r.id)
          triggerAlert({
            id:           r.id,
            name:         r.name ?? 'Unknown',
            barangay:     r.barangay ?? '—',
            municipality: r.municipality ?? '',
            ts:           new Date().toLocaleTimeString(),
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [muni, triggerAlert])

  // ── Polling fallback — catches guest SOS that bypass Supabase realtime ────
  // Seeds seenIdsRef on mount (prevents historic records from alerting),
  // then checks every 30s for new SOS < 2 minutes old.
  useEffect(() => {
    const endpoint = muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos'

    // Seed: pre-populate seen IDs so we don't alert on records that existed before page load
    api.get(endpoint)
      .then(rows => {
        ;(Array.isArray(rows) ? rows : []).forEach(r => seenIdsRef.current.add(r.id))
      })
      .catch(() => {})

    const poll = setInterval(async () => {
      try {
        const rows = await api.get(endpoint)
        ;(Array.isArray(rows) ? rows : []).forEach(r => {
          if (seenIdsRef.current.has(r.id)) return
          seenIdsRef.current.add(r.id)
          // Only fire for SOS that arrived within the last 2 minutes
          const ts  = r.created_at ?? r.timestamp ?? null
          const age = ts ? Date.now() - new Date(ts).getTime() : Infinity
          if (age < 120_000) {
            triggerAlert({
              id:           r.id,
              name:         r.name ?? 'Unknown',
              barangay:     r.barangay ?? '—',
              municipality: r.municipality ?? '',
              ts:           new Date().toLocaleTimeString(),
            })
          }
        })
      } catch { /* ignore polling errors */ }
    }, 30_000)

    return () => clearInterval(poll)
  }, [muni, triggerAlert])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`h-screen overflow-hidden bg-mesh flex relative${adminTheme === 'light' ? ' light-theme' : ''}`}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 glass border-r border-[rgba(255,255,255,0.08)]
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[rgba(0,212,255,0.3)] to-[rgba(139,92,246,0.3)] flex items-center justify-center">
              <span className="text-[10px] font-black text-[#00d4ff]">SP</span>
            </div>
            <div>
              <p className="text-xs font-black text-white">SurvAIve PH</p>
              <p className="text-[9px] text-slate-500">DRRM Admin</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 truncate">{user?.name ?? 'Admin'}</p>
          <p className="text-[10px] text-slate-600 truncate">{user?.municipality ?? 'Municipality'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
            const active = pathname === path
            return (
              <button key={path} onClick={() => { navigate(path); setSidebarOpen(false) }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-[rgba(0,212,255,0.12)] text-[#00d4ff] border border-[rgba(0,212,255,0.2)]'
                    : 'text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)] border border-transparent'
                }`}>
                <Icon size={16} className="shrink-0 mt-0.5" />
                <span className="leading-snug text-left">{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Sidebar bottom — Settings + Sign Out */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.08)] space-y-1">
          {/* Unacknowledged alert badge */}
          {alertQueue.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] mb-1">
              <Bell size={13} className="text-[#ef4444] animate-pulse shrink-0" />
              <span className="text-xs text-[#ef4444] font-semibold">
                {alertQueue.length} active SOS alert{alertQueue.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <button
            onClick={() => { navigate('/admin/settings'); setSidebarOpen(false) }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
              pathname === '/admin/settings'
                ? 'text-[#00d4ff] bg-[rgba(0,212,255,0.08)]'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            <Settings2 size={15} />
            Settings
          </button>

          <button onClick={() => { logout(); navigate('/') }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-white transition-all">
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass border-b border-[rgba(255,255,255,0.08)] px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(v => !v)}
            className="lg:hidden text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <h1 className="font-bold text-white text-sm">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            {/* Alert count badge in header */}
            {alertQueue.length > 0 && (
              <button
                onClick={() => alertQueue[0] && acknowledgeAlert(alertQueue[0].id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.35)] text-[#ef4444] text-[10px] font-bold animate-pulse"
              >
                <Bell size={11} />
                {alertQueue.length} SOS
              </button>
            )}
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-xs text-slate-500 hidden sm:block">Live</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>

      {/* ── Red screen pulse overlay — continuous blink until acknowledged ── */}
      {/* FIX: z-[9998] ensures it renders above Leaflet map (z-index 400+)   */}
      <AnimatePresence>
        {alertActive && visualEnabled && (
          <motion.div
            key="sos-pulse"
            className="fixed inset-0 z-[9998] pointer-events-none"
            style={{ background: 'rgba(239,68,68,0.18)' }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* ── Notification cards — always above map and sidebar ────────────── */}
      {/* FIX: z-[9999] ensures cards render above Leaflet map               */}
      <AnimatePresence>
        {notificationEnabled && alertQueue.length > 0 && (
          <div className="fixed top-4 right-4 z-[9999] space-y-2 w-80 pointer-events-none">
            {alertQueue.slice(0, 3).map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -8 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto rounded-2xl border border-[rgba(239,68,68,0.45)] bg-[rgba(12,3,3,0.93)] backdrop-blur-xl shadow-2xl p-4"
                style={{ boxShadow: '0 0 36px rgba(239,68,68,0.22), 0 8px 32px rgba(0,0,0,0.6)' }}
              >
                {/* Title row */}
                <div className="flex items-center gap-2 mb-1.5">
                  <Bell size={13} className="text-[#ef4444] animate-bounce shrink-0" />
                  <p className="text-[11px] font-black text-[#ef4444] uppercase tracking-widest">New SOS Alert</p>
                  {i === 0 && alertQueue.length > 1 && (
                    <span className="ml-auto text-[10px] font-bold text-[#f97316] shrink-0">
                      +{alertQueue.length - 1} queued
                    </span>
                  )}
                </div>

                {/* Body */}
                <p className="text-[11px] text-slate-300 mb-0.5">Critical emergency request received.</p>
                <p className="text-[11px] text-slate-400">
                  <span className="text-white font-semibold">{alert.name}</span>
                  {' · '}{alert.barangay}
                  {alert.municipality ? ` · ${alert.municipality}` : ''}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">{alert.ts}</p>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="flex-1 py-1.5 rounded-xl text-[11px] font-bold bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white hover:opacity-90 transition-all"
                  >
                    Acknowledge SOS
                  </button>
                  <button
                    onClick={muteCurrentAlert}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-400 border border-[rgba(255,255,255,0.1)] hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all"
                  >
                    Mute
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
