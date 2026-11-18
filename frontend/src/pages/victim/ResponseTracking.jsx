import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Clock, RefreshCw, AlertOctagon, Home, MessageSquare, Map, Sparkles, Settings, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import api, { logActivity } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { fmtSosId } from '../../lib/format'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  haversineDistance, formatDistance, checkMilestones,
  getMilestoneAnnouncement, speak, fetchETA,
  trackingFreshness, formatLastSeen,
} from '../../lib/tracking'
import { fetchWeather } from '../../lib/weatherService'
import { assessDelay } from '../../lib/ai/erdiEngine'
import { ERDIPanel } from '../../components/ui/ERDIPanel'

const AI_CATEGORY_LABELS = {
  mdrrmo: 'Disaster (MDRRMO)', hospital: 'Medical', bfp: 'Fire (BFP)',
  pnp: 'Crime / Security (PNP)', pcg: 'Maritime (PCG)',
}

const RESCUE_STATUS_LABELS = {
  pending:      { label: 'Awaiting Acknowledgment', color: 'text-slate-400',  bg: 'bg-slate-700'     },
  acknowledged: { label: 'Acknowledged',            color: 'text-amber-400',  bg: 'bg-amber-900/40'  },
  en_route:     { label: 'In Progress',             color: 'text-blue-400',   bg: 'bg-blue-900/40'   },
  on_scene:     { label: 'In Progress',             color: 'text-violet-400', bg: 'bg-violet-900/40' },
  cannot_reach: { label: 'In Progress',             color: 'text-amber-400',  bg: 'bg-amber-900/40'  },
  rescued:      { label: 'Completed',               color: 'text-green-400',  bg: 'bg-green-900/40'  },
}

const PRIORITY_LABELS = {
  CRITICAL: 'bg-red-900/40 text-red-400',
  HIGH:     'bg-orange-900/40 text-orange-400',
  MODERATE: 'bg-amber-900/40 text-amber-400',
  LOW:      'bg-slate-700 text-slate-400',
}

function priorityLabel(score) {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MODERATE'
  return 'LOW'
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const EMERGENCY_LABELS = {
  injured: 'Injured', trapped: 'Trapped', safe: 'Safe', missing: 'Missing', unknown: 'Unknown',
}

const NAV = [
  { icon: Home,          label: 'Home',     path: '/home'     },
  { icon: MessageSquare, label: 'SOS',      path: '/sos'      },
  { icon: Map,           label: 'Map',      path: '/map'      },
  { icon: Sparkles,      label: 'AI',       path: '/assistant' },
  { icon: Settings,      label: 'Settings', path: '/settings' },
]

function fmtTime(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const responderPinIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#00d4ff;border:3px solid white;border-radius:50%;box-shadow:0 0 10px #00d4ff"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
})
const sosPinIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 0 10px #ef4444"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
})

function PanToResponder({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat != null && lng != null) map.flyTo([lat, lng], map.getZoom(), { duration: 1.0 })
  }, [lat, lng])
  return null
}

// v2 — IncidentHistory card style
export function ResponseTracking() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const location  = useLocation()
  const pageTitle  = location.state?.fromSection ?? 'Response Tracking'
  const [isReviewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('survAIve-reviewed-sos') || '[]').includes(Number(id)) }
    catch { return false }
  })
  const { user }  = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [isOnline]= useState(getNetworkOnline)
  const [report,    setReport]  = useState(null)
  const [events,    setEvents]  = useState([])
  const [loading,   setLoading] = useState(true)
  const [lastSync,  setLastSync]= useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [responder, setResponder] = useState(null)
  const prevStatusRef = useRef(undefined)

  // ── Live tracking state ───────────────────────────────────────────────────
  const [dist,          setDist]          = useState(null)   // metres
  const [eta,           setEta]           = useState(null)   // { minutes, roadKm, routeCoords } | null
  const [routeCoords,   setRouteCoords]   = useState([])     // [[lat,lng], ...] from OSRM
  const [mapExpanded,   setMapExpanded]   = useState(false)
  const [voiceOn,       setVoiceOn]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('survAIve-voice-prefs'))?.on ?? true } catch { return true }
  })
  const [voiceLang,     setVoiceLang]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('survAIve-voice-prefs'))?.lang ?? 'en' } catch { return 'en' }
  })
  const [lastAnnouncement, setLastAnnouncement] = useState(null)
  const announcedRef     = useRef(new Set())
  const prevDistRef      = useRef(null)
  const prevErdiTierRef  = useRef(null)

  // ── ERDI state ───────────────────────────────────────────────────────────
  const [weatherRisk,     setWeatherRisk]     = useState(null)
  const [weatherChecked,  setWeatherChecked]  = useState(false)
  const [agencyContext,   setAgencyContext]   = useState(null)
  const [erdiAssessment,  setErdiAssessment]  = useState(null)

  async function load() {
    setLoading(true)
    try {
      // Try Supabase/PHP first
      const all = await api.get('/sos/mine')
      let r = Array.isArray(all) ? all.find(x => String(x.id) === String(id)) : null

      // Mine list didn't include this record (guest victims have no victimId so the list
      // is empty; registered victims may also miss it on Vercel). Fetch directly by id —
      // api.get('/sos/:id') queries Supabase SELECT * with normalizeSos, deriving
      // 'acknowledged' from confirmed_by_name without needing victim auth.
      if (!r && isOnline) {
        try { r = await api.get(`/sos/${id}`) } catch { /* id not found in Supabase */ }
      }

      // Fallback to IndexedDB when API didn't return the record
      if (!r) {
        try {
          const local = await db.getAllSOS()
          const match = local.find(x => String(x.id) === String(id))
          if (match) r = { ...match, rescue_status: match.rescue_status ?? 'pending' }
        } catch {}
      }

      setReport(r ?? null)

      // Fire a local notification if rescue_status changed since last load (native only)
      if (
        r?.rescue_status &&
        prevStatusRef.current !== undefined &&
        r.rescue_status !== prevStatusRef.current &&
        window.Capacitor?.isNativePlatform?.()
      ) {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications')
          const label = RESCUE_STATUS_LABELS[r.rescue_status]?.label ?? r.rescue_status
          await LocalNotifications.schedule({
            notifications: [{
              id: Math.abs(Number(r.id) * 10 + Object.keys(RESCUE_STATUS_LABELS).indexOf(r.rescue_status) + 1),
              title: 'Rescue Status Update',
              body: `Your rescue status changed to: ${label}`,
              schedule: { at: new Date(Date.now() + 100) },
            }],
          })
        } catch {}
      }
      prevStatusRef.current = r?.rescue_status ?? null

      // Fetch status events from Supabase (graceful fail when offline)
      if (r) {
        try {
          const { data } = await supabase
            .from('sos_status_events')
            .select('id,event_type,old_status,new_status,message,created_at,actor_role,actor_name_snapshot')
            .eq('sos_id', id)
            .order('created_at', { ascending: true })
          setEvents(data ?? [])
        } catch {}
      }

      // Fetch assigned responder's current GPS location
      if (r?.assigned_responder_id && isOnline) {
        try {
          const { data } = await supabase
            .rpc('get_responder_location_for_sos', { p_sos_id: Number(id) })
          setResponder(data?.[0] ?? null)
        } catch {}
      }
      setLastSync(new Date())
    } catch (err) {
      console.error('[ResponseTracking] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id, reloadKey])

  // Auto-refresh when responder updates this SOS's rescue_status via Realtime
  useEffect(() => {
    if (!isOnline) return
    const ch = supabase.channel(`rt-sos-${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_reports',
          filter: `id=eq.${id}` },
        () => { setReloadKey(k => k + 1) }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, isOnline])

  // Polling fallback — catches status updates when Realtime is unavailable
  useEffect(() => {
    if (!isOnline) return
    const poll = setInterval(() => setReloadKey(k => k + 1), 10_000)
    return () => clearInterval(poll)
  }, [isOnline, id])

  // Live responder location updates via Realtime
  useEffect(() => {
    if (!isOnline || !report?.assigned_responder_id) return
    const ch = supabase.channel(`rt-rsp-${report.assigned_responder_id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'responders',
          filter: `id=eq.${report.assigned_responder_id}` },
        payload => setResponder(prev => prev ? { ...prev, ...payload.new } : payload.new)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [report?.assigned_responder_id, isOnline])

  // Seed announced milestones from localStorage (persist across page navigations)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`survAIve-ann-${id}`) || '[]')
      announcedRef.current = new Set(stored)
    } catch {}
  }, [id])

  // Persist voice preferences
  useEffect(() => {
    try { localStorage.setItem('survAIve-voice-prefs', JSON.stringify({ on: voiceOn, lang: voiceLang })) } catch {}
  }, [voiceOn, voiceLang])

  // Distance + milestone announcements + ETA — fires when responder coords change
  useEffect(() => {
    if (!responder?.lat || !responder?.lng || !report?.lat || !report?.lng) return
    const d = haversineDistance(responder.lat, responder.lng, report.lat, report.lng)

    const hits = checkMilestones(prevDistRef.current, d, announcedRef.current)
    if (hits.length > 0) {
      hits.forEach(m => announcedRef.current.add(m))
      try { localStorage.setItem(`survAIve-ann-${id}`, JSON.stringify([...announcedRef.current])) } catch {}
      const closest = Math.min(...hits)
      const text = getMilestoneAnnouncement(closest, voiceLang)
      setLastAnnouncement(text)
      if (voiceOn) speak(text, voiceLang)
    }
    prevDistRef.current = d
    setDist(d)

    fetchETA(responder.lat, responder.lng, report.lat, report.lng).then(result => {
      setEta(result)
      setRouteCoords(result?.routeCoords ?? [])
    })
  }, [responder?.lat, responder?.lng, report?.lat, report?.lng])

  // Fetch weather risk for ERDI (non-blocking; graceful fail when offline)
  useEffect(() => {
    if (!report?.lat || !report?.lng) return
    fetchWeather(report.lat, report.lng)
      .then(w => { setWeatherRisk(w); setWeatherChecked(true) })
      .catch(() => { setWeatherChecked(true) })
  }, [report?.lat, report?.lng])

  // Fetch agency workload context for ERDI (once per municipality)
  useEffect(() => {
    const muni = report?.municipality
    if (!muni) return
    Promise.all([
      supabase.from('responders').select('id', { count: 'exact', head: true }).eq('duty_status', 'on_duty').eq('municipality', muni),
      supabase.from('sos_reports').select('id', { count: 'exact', head: true }).neq('rescue_status', 'rescued').neq('rescue_status', 'cannot_reach').eq('municipality', muni),
    ]).then(([{ count: onDutyCount }, { count: activeLoad }]) => {
      setAgencyContext({ onDutyCount: onDutyCount ?? 0, activeLoad: activeLoad ?? 0 })
    }).catch(() => {})
  }, [report?.municipality])

  // Recompute ERDI assessment whenever key inputs change
  useEffect(() => {
    if (!report) return
    setErdiAssessment(assessDelay(report, events, responder, weatherRisk, agencyContext))
  }, [report?.rescue_status, report?.ai_priority_score, events.length, responder?.lat, responder?.lng, responder?.last_seen_at, weatherRisk, agencyContext])

  // Log ERDI assessments on tier change (all tiers) — blueprint §16 AC 8
  useEffect(() => {
    if (!erdiAssessment) return
    if (erdiAssessment.tier === prevErdiTierRef.current) return
    prevErdiTierRef.current = erdiAssessment.tier
    logActivity('POST', 'erdi', 'erdi_assessment', report?.id, {
      tier: erdiAssessment.tier,
      confidence: erdiAssessment.confidence,
      factorCount: erdiAssessment.factors?.length ?? 0,
      topFactor: erdiAssessment.factors?.[0]?.label ?? null,
      recommendation: erdiAssessment.recommendations?.victim ?? null,
      role: 'victim',
    })
  }, [erdiAssessment?.tier])

  // Arrival announcement — triggered by rescue_status reaching on_scene
  useEffect(() => {
    if (report?.rescue_status !== 'on_scene') return
    if (announcedRef.current.has(0)) return
    announcedRef.current.add(0)
    try { localStorage.setItem(`survAIve-ann-${id}`, JSON.stringify([...announcedRef.current])) } catch {}
    const text = getMilestoneAnnouncement(0, voiceLang)
    setLastAnnouncement(text)
    if (voiceOn) speak(text, voiceLang)
  }, [report?.rescue_status])

  // Build timeline steps — merge system events with derived steps
  function buildTimeline(r, evts) {
    const statusAt = (targetStatus) => {
      const ev = evts.find(e => e.new_status === targetStatus)
      return ev?.created_at ?? null
    }
    return [
      { label: 'SOS Submitted',           done: true,                                  ts: r?.created_at },
      { label: 'Report Received by System',done: !!r?.id,                               ts: r?.created_at },
      { label: 'Agency Acknowledged',      done: !['pending'].includes(r?.rescue_status) || evts.some(e => e.event_type?.includes('acknowledge')), ts: statusAt('acknowledged') },
      { label: 'Responder Assigned',       done: !!r?.assigned_responder_id,            ts: statusAt('assigned') },
      { label: 'Responder En Route',       done: ['en_route','on_scene','rescued','cannot_reach'].includes(r?.rescue_status), ts: statusAt('en_route') },
      { label: 'Responder On Scene',       done: ['on_scene','rescued','cannot_reach'].includes(r?.rescue_status), ts: statusAt('on_scene') },
      { label: 'Rescue / Assistance Completed', done: r?.rescue_status === 'rescued',  ts: r?.confirmed_at ?? statusAt('rescued') },
    ]
  }

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title={pageTitle} onBack />

      <main className="flex-1 overflow-y-auto p-4 pb-nav space-y-4">

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#00d4ff] border-t-transparent animate-spin" />
          </div>
        ) : !report ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
            <AlertOctagon size={28} />
            <p className="text-sm">SOS report not found or not accessible.</p>
            <button onClick={() => navigate('/sos/history')} className="text-xs text-[#00d4ff] underline">
              View My Reports
            </button>
          </div>
        ) : (
          <>
            {/* Summary card */}
            <div className="w-full glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-slate-500">{fmtSosId(report.id)}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_LABELS[priorityLabel(report.ai_priority_score ?? 50)]}`}>
                  {priorityLabel(report.ai_priority_score ?? 50)}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">
                  {EMERGENCY_LABELS[report.status] ?? report.status}
                </span>
                {report.barangay && <span className="text-xs text-slate-500">· {report.barangay}</span>}
              </div>
              {(report.ai_classification || report.ai_review_status) && (
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {report.ai_classification && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.2)] text-[#00d4ff]">
                      {AI_CATEGORY_LABELS[report.ai_classification] ?? report.ai_classification}
                    </span>
                  )}
                  {report.ai_review_status && (
                    <span className={`text-[9px] ${
                      report.ai_review_status === 'confirmed' ? 'text-green-400' :
                      report.ai_review_status === 'corrected' ? 'text-blue-400' :
                      report.ai_review_status === 'rejected'  ? 'text-red-400'  : 'text-slate-400'
                    }`}>
                      {report.ai_review_status === 'unreviewed' ? 'Pending Review' : report.ai_review_status}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {(() => {
                    const st = RESCUE_STATUS_LABELS[report.rescue_status] ?? { label: report.rescue_status, color: 'text-slate-400', bg: 'bg-slate-700' }
                    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.color}`}>{st.label}</span>
                  })()}
                  {pageTitle === 'Post-Rescue Feedback' && report.rescue_status === 'rescued' && (
                    isReviewed
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 font-semibold">Reviewed</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 font-semibold">Rate Response</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={11} />
                  {fmtDate(report.created_at)}
                </div>
              </div>
            </div>

            {/* ERDI — delay intelligence (hidden after rescue) */}
            {erdiAssessment && report?.rescue_status !== 'rescued' && (
              <>
                <ERDIPanel assessment={erdiAssessment} role="victim" isOnline={isOnline} />
                {weatherChecked && weatherRisk === null && (
                  <p className="text-xs text-slate-500 text-center -mt-2 mb-1 px-2">
                    Weather data unavailable — delay estimate based on incident and location data only.
                  </p>
                )}
              </>
            )}

            {/* Responder Location — enhanced with distance, freshness, ETA, voice */}
            {responder?.lat != null && responder?.lng != null && report?.rescue_status !== 'rescued' && (
              <div className="glass rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.06)]">

                {/* Header row */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Track My Responder</p>
                  <div className="flex items-center gap-2">
                    {/* Freshness indicator */}
                    {(() => {
                      const f = trackingFreshness(responder.last_seen_at)
                      return (
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${
                          f === 'live'         ? 'text-green-400'  :
                          f === 'reconnecting' ? 'text-amber-400'  : 'text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            f === 'live'         ? 'bg-green-400 animate-pulse' :
                            f === 'reconnecting' ? 'bg-amber-400'               : 'bg-slate-500'
                          }`} />
                          {f === 'live'         ? 'Live'          :
                           f === 'reconnecting' ? 'Reconnecting'  :
                           `Last Known · ${formatLastSeen(responder.last_seen_at)}`}
                        </span>
                      )
                    })()}
                    {/* Expand / collapse toggle */}
                    <button
                      onClick={() => setMapExpanded(e => !e)}
                      className="text-slate-500 hover:text-[#00d4ff] transition-colors"
                      aria-label={mapExpanded ? 'Collapse map' : 'Expand map'}
                    >
                      {mapExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                  </div>
                </div>

                {/* Map */}
                <div style={{ height: mapExpanded ? '280px' : '160px', transition: 'height 0.3s ease' }}>
                  <MapContainer
                    key={`tracking-map-${id}`}
                    center={[responder.lat, responder.lng]}
                    zoom={14}
                    style={{ height: '100%', background: '#0a1628' }}
                    zoomControl={mapExpanded}
                    dragging={mapExpanded}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                  >
                    <PanToResponder lat={responder?.lat} lng={responder?.lng} />
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                    <Marker position={[responder.lat, responder.lng]} icon={responderPinIcon()}>
                      <Popup><div className="text-xs">{responder.unit_name ?? 'Responder'}</div></Popup>
                    </Marker>
                    {report?.lat != null && report?.lng != null && (
                      <Marker position={[report.lat, report.lng]} icon={sosPinIcon()}>
                        <Popup><div className="text-xs">Your SOS Location</div></Popup>
                      </Marker>
                    )}
                    {routeCoords.length > 1 && (
                      <Polyline
                        positions={routeCoords}
                        pathOptions={{ color: '#00d4ff', weight: 3, dashArray: '6 4', opacity: 0.7 }}
                      />
                    )}
                  </MapContainer>
                </div>

                {/* Distance + ETA + voice controls */}
                <div className="px-4 pt-3 pb-3 space-y-2">

                  {/* Arrival banner */}
                  {report?.rescue_status === 'on_scene' ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={14} />
                      <span className="text-sm font-bold">Responder has arrived</span>
                    </div>
                  ) : dist != null ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-white">{formatDistance(dist)}</span>
                        <span className="text-[10px] text-slate-500">straight-line</span>
                      </div>
                      {eta ? (
                        <span className="text-xs text-slate-400">~{eta.minutes} min · {eta.roadKm} km by road</span>
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">Calculating ETA…</span>
                      )}
                    </div>
                  ) : null}

                  {/* Unit name */}
                  <p className="text-xs text-slate-400">{responder.unit_name ?? 'Assigned Responder'}</p>

                  {/* Voice controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.06)]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setVoiceOn(v => !v)}
                        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                          voiceOn
                            ? 'border-[#00d4ff]/40 text-[#00d4ff] bg-[rgba(0,212,255,0.08)]'
                            : 'border-slate-700 text-slate-500'
                        }`}
                      >
                        {voiceOn ? <Volume2 size={11} /> : <VolumeX size={11} />}
                        {voiceOn ? 'Voice On' : 'Voice Off'}
                      </button>
                      {voiceOn && (
                        <div className="flex gap-1">
                          {[
                            { key: 'en',  label: 'EN'     },
                            { key: 'fil', label: 'FIL'    },
                            { key: 'bis', label: 'Bisaya' },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => setVoiceLang(key)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                voiceLang === key
                                  ? 'border-[#00d4ff]/40 text-[#00d4ff] bg-[rgba(0,212,255,0.08)]'
                                  : 'border-slate-700 text-slate-500'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {lastAnnouncement && voiceOn && (
                      <button
                        onClick={() => speak(lastAnnouncement, voiceLang)}
                        className="text-[10px] text-slate-500 hover:text-[#00d4ff] transition-colors"
                      >
                        ↺ Replay
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Response Timeline</p>
                  <button onClick={load} className="text-slate-500 hover:text-[#00d4ff] transition-colors">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
                <div className="space-y-3">
                  {buildTimeline(report, events).map(({ label, done, ts }, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center mt-0.5">
                        {done ? (
                          <div className="w-5 h-5 rounded-full bg-[rgba(34,197,94,0.2)] border-2 border-green-500 flex items-center justify-center">
                            <CheckCircle size={12} className="text-green-400" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-700 bg-[rgba(255,255,255,0.03)]" />
                        )}
                        {i < 6 && <div className={`w-0.5 h-5 mt-1 ${done ? 'bg-green-800' : 'bg-slate-800'}`} />}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className={`text-sm font-medium ${done ? 'text-white' : 'text-slate-600'}`}>{label}</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {ts ? fmtTime(ts) : (done ? null : <span className="italic">Pending</span>)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            {/* CTA — only shown when arriving from Post-Rescue Feedback */}
            {pageTitle === 'Post-Rescue Feedback' && report.rescue_status === 'rescued' && (
              isReviewed ? (
                <div className="glass rounded-2xl p-3 border border-green-500/30 bg-green-900/10 flex items-center gap-3">
                  <CheckCircle size={16} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-green-400">Feedback Submitted</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">You've already reviewed this incident</p>
                  </div>
                </div>
              ) : (
                <div className="glass rounded-2xl p-3 border border-green-500/30 bg-green-900/10">
                  <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Tell Us About Your Experience</span>
                  <p className="text-[10px] text-slate-400 mt-1">Share your experience to improve emergency response</p>
                  <div className="flex gap-2 mt-2.5">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate(`/sos/${report.id}/feedback`)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600
                                 border border-amber-400/60 text-black text-xs font-bold
                                 shadow-[0_0_16px_rgba(245,158,11,0.25)]">
                      REVIEW NOW
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate('/sos/history', { state: { overrideTitle: 'Post-Rescue Feedback' } })}
                      className="flex-1 py-2.5 rounded-xl border border-[rgba(255,255,255,0.12)]
                                 text-slate-300 text-xs font-semibold hover:bg-[rgba(255,255,255,0.05)]">
                      MAYBE LATER
                    </motion.button>
                  </div>
                </div>
              )
            )}

            {/* Last sync footer */}
            {lastSync && (
              <p className="text-[10px] text-slate-600 text-center">
                Last synced: {fmtTime(lastSync.toISOString())}
              </p>
            )}
          </>
        )}
      </main>
      <MobileNavBar items={NAV} />
    </div>
  )
}
