import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Map, Radio, Settings, MessageSquare, Battery, Satellite, Home, Wifi, WifiOff, ShieldCheck, ShieldAlert, CheckCircle } from 'lucide-react'
import { SOSButton } from '../../components/ui/SOSButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { MobileNavBar } from '../../components/ui/NavBar'
import { useAuthStore } from '../../store/auth'
import { mesh } from '../../lib/mesh'
import { autoSOS } from '../../lib/autoSOS'
import { useState, useEffect, useRef } from 'react'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline, onNetworkChange } from '../../lib/capacitor'
import { WeatherCard } from '../../components/ui/WeatherCard'
import { supabase } from '../../lib/supabase'

const HOLD_MS = 3000
const SW = 2.5 // SVG stroke width

function HoldStatusButton({ option, onConfirm, disabled }) {
  const [pressing,  setPressing]  = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [saving,    setSaving]    = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error,     setError]     = useState(null)
  const [dims,      setDims]      = useState({ w: 150, h: 88 })
  const [pathLen,   setPathLen]   = useState(0)
  const intervalRef = useRef(null)
  const timeoutRef  = useRef(null)
  const wrapRef     = useRef(null)
  const rectRef     = useRef(null)

  // Measure container + compute SVG path length after mount
  useEffect(() => {
    if (wrapRef.current) {
      const { width, height } = wrapRef.current.getBoundingClientRect()
      setDims({ w: width, h: height })
    }
  }, [])

  useEffect(() => {
    if (rectRef.current && rectRef.current.getTotalLength) {
      setPathLen(rectRef.current.getTotalLength())
    }
  }, [dims])

  useEffect(() => () => {
    clearInterval(intervalRef.current)
    clearTimeout(timeoutRef.current)
  }, [])

  const startPress = (e) => {
    e.preventDefault()
    if (disabled || saving || submitted) return
    setPressing(true)
    setError(null)
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / HOLD_MS) * 100, 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(intervalRef.current)
        setPressing(false)
        setProgress(100)
        setSaving(true)
        onConfirm()
          .then(() => {
            setSubmitted(true)
            setSaving(false)
            timeoutRef.current = setTimeout(() => {
              setSubmitted(false)
              setProgress(0)
            }, 5000)
          })
          .catch(err => {
            setError(err?.message ?? 'Failed to update')
            setSaving(false)
            setProgress(0)
          })
      }
    }, 30)
  }

  const cancelPress = () => {
    if (!pressing) return
    clearInterval(intervalRef.current)
    setPressing(false)
    setProgress(0)
  }

  const isActive = pressing || saving
  const dashOffset = pathLen > 0 ? pathLen * (1 - progress / 100) : 0

  return (
    <div
      ref={wrapRef}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      style={{
        position: 'relative', touchAction: 'none', userSelect: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: submitted ? `linear-gradient(135deg, ${option.colorFrom}, ${option.colorTo})` : undefined,
        transition: 'background 0.3s ease',
      }}
      className={`glass rounded-xl py-3 flex flex-col items-center gap-1.5 transition-all ${
        disabled ? 'opacity-50' : ''
      }`}
      title={submitted ? `${option.label} confirmed` : `Hold 3s to report ${option.label}`}
    >
      {/* SVG animated border overlay */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Background stroke — measurement anchor + dim guide */}
        <rect
          ref={rectRef}
          x={SW / 2} y={SW / 2}
          width={Math.max(dims.w - SW, 1)} height={Math.max(dims.h - SW, 1)}
          rx="12" ry="12"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={SW}
        />
        {/* Progress stroke — always in DOM, strokeOpacity drives visibility */}
        <rect
          x={SW / 2} y={SW / 2}
          width={Math.max(dims.w - SW, 1)} height={Math.max(dims.h - SW, 1)}
          rx="12" ry="12"
          fill="none"
          stroke={option.colorFrom}
          strokeWidth={SW}
          strokeDasharray={pathLen > 0 ? pathLen : 9999}
          strokeDashoffset={submitted ? 0 : (pathLen > 0 ? pathLen * (1 - progress / 100) : 9999)}
          strokeLinecap="round"
          strokeOpacity={isActive && !submitted ? 1 : 0}
          style={{ transition: 'stroke-dashoffset 0.03s linear, stroke-opacity 0.15s ease' }}
        />
      </svg>

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: submitted
            ? 'rgba(255,255,255,0.25)'
            : `linear-gradient(135deg, ${option.colorFrom}, ${option.colorTo})`,
          opacity: saving ? 0.7 : 1,
        }}
      >
        {submitted
          ? <CheckCircle size={20} color="white" strokeWidth={2.5} />
          : <option.Icon size={20} color="white" strokeWidth={2.5} />
        }
      </div>

      {/* Label */}
      <span className="text-xs font-medium transition-colors" style={{ color: submitted ? 'white' : (pressing ? option.colorFrom : '#94a3b8') }}>
        {submitted ? option.label : option.label}
      </span>

      {/* Hint / progress text */}
      <span className="text-[10px] leading-none" style={{ color: submitted ? 'white' : (pressing ? option.colorFrom : error ? '#ef4444' : '#475569') }}>
        {error
          ? 'Error'
          : saving
            ? '…'
            : submitted
              ? '✓ Confirmed'
              : pressing
                ? `${Math.ceil(((100 - progress) / 100) * 3)}s…`
                : 'Hold 3s'
        }
      </span>
    </div>
  )
}

const STATUS_OPTIONS = [
  { label: 'SAFE',   colorFrom: 'rgb(34,197,94)',  colorTo: 'rgb(21,128,61)',  Icon: ShieldCheck, value: 'safe'   },
  { label: 'UNSAFE', colorFrom: 'rgb(239,68,68)',  colorTo: 'rgb(185,28,28)', Icon: ShieldAlert, value: 'unsafe' },
]

const NAV = [
  { icon: Home,            label: 'Home',   path: '/home'     },
  { icon: MessageSquare,   label: 'SOS',    path: '/sos'      },
  { icon: Map,             label: 'Map',    path: '/map'      },
  { icon: Radio,           label: 'Mesh',   path: '/mesh'     },
  { icon: Settings,        label: 'Settings',path: '/settings' },
]

export function HomeScreen() {
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [quickStatus, setQuickStatus] = useState(null)
  const [peerCount, setPeerCount] = useState(0)
  const [isOnline, setIsOnline] = useState(getNetworkOnline())
  const [gpsState, setGpsState] = useState('unknown') // 'active' | 'denied' | 'unknown'
  const [battery, setBattery]   = useState(null)      // null = API not available

  useEffect(() => {
    const loadPeers = async () => {
      const s = await mesh.getStats()
      setPeerCount(s.peersNearby ?? 0)
    }
    loadPeers()
    const t = setInterval(loadPeers, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    document.title = 'SurvAIve PH – Home'
    autoSOS.init()

    const handlePromise = onNetworkChange(connected => setIsOnline(connected))

    if (navigator.permissions) {
      const stateMap = { granted: 'active', denied: 'denied', prompt: 'unknown' }
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setGpsState(stateMap[result.state] ?? 'unknown')
        result.addEventListener('change', () => setGpsState(stateMap[result.state] ?? 'unknown'))
      }).catch(() => {})
    }

    if (navigator.getBattery) {
      navigator.getBattery().then(bat => {
        const update = () => setBattery(Math.round(bat.level * 100))
        update()
        bat.addEventListener('levelchange', update)
      }).catch(() => {})
    }

    return () => { handlePromise.then(h => h.remove()).catch(() => {}) }
  }, [])

  const handleSOS = () => navigate('/sos/new')

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      {/* Top bar */}
      <header
        className="border-b border-[rgba(0,0,0,0.12)] px-4 pb-3"
        style={{ background: 'var(--nav-bg)', paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[rgba(0,212,255,0.3)] to-[rgba(139,92,246,0.3)] flex items-center justify-center">
              <span className="text-[10px] font-black text-[#00d4ff]">SP</span>
            </div>
            <div>
              <p className="text-xs font-bold text-white">{user?.name ?? 'Anonymous'}</p>
              <p className="text-[10px] text-slate-500">{user?.barangay ?? user?.municipality ?? 'Location unknown'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isGuest ? (
              <StatusBadge status="GUEST" />
            ) : (
              <StatusBadge status="VERIFIED" />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-5 space-y-5 pb-nav">
        {/* Status indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Internet */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-[rgba(255,255,255,0.08)]">
            {isOnline
              ? <><Wifi size={12} className="text-[#22c55e]" /><span className="text-[11px] text-[#22c55e] font-medium">Online</span></>
              : <><WifiOff size={12} className="text-slate-500" /><span className="text-[11px] text-slate-500 font-medium">Offline</span></>
            }
          </div>
          {/* GPS */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-[rgba(255,255,255,0.08)]">
            <Satellite size={12} className={gpsState === 'active' ? 'text-[#00d4ff]' : gpsState === 'denied' ? 'text-[#ef4444]' : 'text-slate-500'} />
            <span className={`text-[11px] font-medium ${gpsState === 'active' ? 'text-[#00d4ff]' : gpsState === 'denied' ? 'text-[#ef4444]' : 'text-slate-500'}`}>
              {gpsState === 'active' ? 'GPS Active' : gpsState === 'denied' ? 'GPS Denied' : 'GPS Unknown'}
            </span>
          </div>
          {/* Battery — hidden if API not available */}
          {battery !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-[rgba(255,255,255,0.08)]">
              <Battery size={12} className={battery > 20 ? 'text-[#22c55e]' : 'text-[#ef4444]'} />
              <span className={`text-[11px] font-medium ${battery > 20 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{battery}%</span>
            </div>
          )}
        </div>

        {/* SOS Button — center piece */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center py-4"
        >
          <SOSButton onTrigger={handleSOS} />
        </motion.div>

        {/* Weather */}
        <WeatherCard user={user} isGuest={isGuest} />

        {/* Quick Safety Status — only for registered (non-guest) victims */}
        {!isGuest && user?.victim_id && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Quick Safety Status</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(s => (
                <HoldStatusButton
                  key={s.value}
                  option={s}
                  onConfirm={async () => {
                    const dbStatus = s.value === 'safe' ? 'rescued' : 'sos_sent'
                    const { error } = await supabase.from('victims').update({ status: dbStatus }).eq('victim_id', user.victim_id)
                    if (error) throw error
                    setQuickStatus(s.value)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/map')}
            className="glass rounded-2xl p-4 cursor-pointer hover:border-[rgba(0,212,255,0.3)] transition-all border border-[rgba(255,255,255,0.08)]"
          >
            <Map size={20} className="text-[#00d4ff] mb-2" />
            <p className="text-sm font-semibold text-white">Local Map</p>
            <p className="text-xs text-slate-500 mt-0.5">Nearby incidents</p>
          </motion.div>
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/mesh')}
            className="glass rounded-2xl p-4 cursor-pointer hover:border-[rgba(34,197,94,0.3)] transition-all border border-[rgba(255,255,255,0.08)]"
          >
            <Radio size={20} className={peerCount > 0 ? 'text-[#22c55e] animate-pulse mb-2' : 'text-slate-500 mb-2'} />
            <p className="text-sm font-semibold text-white">Mesh Network</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {peerCount > 0 ? `${peerCount} peer(s) found` : 'No peers nearby'}
            </p>
          </motion.div>
        </div>

        {/* Emergency tip */}
        <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.2)]">
          <p className="text-[11px] text-[#f59e0b] font-semibold mb-1">⚡ Emergency Tip</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Stay calm. Move to higher ground if flooding. Keep phone charged.
            This app works without internet via mesh networking.
          </p>
        </div>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
