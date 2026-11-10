import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, MapPin, Users, FileText, Check,
  Mic,
  CloudLightning, HeartPulse, Flame, Shield, Anchor,
} from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassSelect, GlassInput, GlassTextarea } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import { useAuthStore } from '../../store/auth'
import { db } from '../../lib/db'
import { mesh, onBroadcastStatus } from '../../lib/mesh'
import api from '../../lib/api'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline, onNetworkChange } from '../../lib/capacitor'
import { setActiveSOS, updateACKState, clearActiveSOS, getActiveSOS, onActivityChange, logMeshEvent, setBroadcastSubState } from '../../lib/meshActivityStore'
import { Home, Map, Radio, Settings, MessageSquare } from 'lucide-react'

const NAV = [
  { icon: Home,          label: 'Home',     path: '/home' },
  { icon: MessageSquare, label: 'SOS',      path: '/sos' },
  { icon: Map,           label: 'Map',      path: '/map' },
  { icon: Radio,         label: 'Mesh',     path: '/mesh' },
  { icon: Settings,      label: 'Settings', path: '/settings' },
]

export function SOSReport() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isGuest, token } = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = e => setIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Form state ───────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    status:       location.state?.status ?? 'trapped',
    people_count: 1,
    notes:        '',
    barangay:     user?.barangay    ?? '',
    municipality: user?.municipality ?? '',
    province:     user?.province    ?? '',
    service_type: [],
  })
  const [ageGroup,    setAgeGroup]    = useState('adult')
  const [conditions,  setConditions]  = useState([])
  const [lat,  setLat]  = useState(user?.lat ?? null)
  const [lng,  setLng]  = useState(user?.lng ?? null)
  const [loading,       setLoading]       = useState(false)
  const [submitted,     setSubmitted]     = useState(false)
  const [sosError,      setSosError]      = useState(null)
  const [priorityScore, setPriorityScore] = useState(null)
  const [offline,       setOffline]       = useState(!getNetworkOnline())
  const [onlineDelivered, setOnlineDelivered] = useState(false)
  const [newSosId,        setNewSosId]        = useState(null)

  // ── Mesh ACK state (shared via meshActivityStore) ────────────────────────────
  const [ackState, setAckState] = useState(getActiveSOS)

  // ── Voice state ──────────────────────────────────────────────────────────────
  const [listening,      setListening]      = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [interimText,    setInterimText]    = useState('')
  const [voiceDetected,  setVoiceDetected]  = useState([])
  const recognitionRef = useRef(null)

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      () => {}
    )
    const handlePromise = onNetworkChange(connected => setOffline(!connected))
    setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))

    return () => {
      handlePromise.then(h => h.remove()).catch(() => {})
    }
  }, [])

  // Sync ackState from store whenever store changes
  useEffect(() => onActivityChange(() => setAckState(getActiveSOS())), [])

  // Subscribe to native BLE advertising status — update sub-state display AND activity log
  useEffect(() => {
    return onBroadcastStatus(({ status, errorCode }) => {
      if (status === 'advertising_started') {
        setBroadcastSubState('advertising')
        logMeshEvent('broadcast_started', { status: 'advertising' })
      } else if (status === 'advertising_failed') {
        setBroadcastSubState('retrying')
        logMeshEvent('broadcast_failed', { errorCode: errorCode ?? 0 })
      } else if (status === 'awaiting_peers') {
        setBroadcastSubState('awaiting_peers')
        logMeshEvent('broadcast_started', { status: 'awaiting_peers' })
      } else if (status === 'connecting') {
        setBroadcastSubState('connecting')
      } else if (status === 'sos_transmitted') {
        setBroadcastSubState('transmitted')
      }
    })
  }, [])

  // ACK updates are handled by meshSync.js → updateACKState → onActivityChange (line 93 above)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: typeof v === 'function' ? v(p[k]) : v }))

  const applyKeywords = (text) => {
    const t = text.toLowerCase()
    const detected = []

    if (/trapped|stuck|cannot move|can't move|hindi makalabas/.test(t)) {
      setForm(p => ({ ...p, status: 'trapped' })); detected.push('Trapped')
    } else if (/injur|hurt|bleeding|broken|wound|sugat|nasaktan/.test(t)) {
      setForm(p => ({ ...p, status: 'injured' })); detected.push('Injured')
    } else if (/missing|nawala/.test(t)) {
      setForm(p => ({ ...p, status: 'missing' })); detected.push('Missing')
    }

    setConditions(prev => {
      const next = [...prev]
      if (/fire|burning|flames|nasusunog|sunog/.test(t) && !next.includes('fire')) {
        next.push('fire'); detected.push('Fire')
      }
      if (/flood|baha|submerged|water rising/.test(t) && !next.includes('flooding')) {
        next.push('flooding'); detected.push('Flooding')
      }
      if (/medical|heart|seizure|unconscious|breathing|stroke|diabetic/.test(t) && !next.includes('medical_emergency')) {
        next.push('medical_emergency'); detected.push('Medical Emergency')
      }
      if (/collaps|debris|rubble|building fell|gusali/.test(t) && !next.includes('structural_collapse')) {
        next.push('structural_collapse'); detected.push('Structural Collapse')
      }
      return next
    })

    if (/child|bata|baby|infant|kid/.test(t)) { setAgeGroup('child'); detected.push('Child') }
    else if (/senior|elderly|matanda|lolo|lola|old/.test(t)) { setAgeGroup('senior'); detected.push('Senior') }

    if (detected.length > 0) {
      setVoiceDetected(detected)
      setTimeout(() => setVoiceDetected([]), 4000)
    }
  }

  // ── Voice recognition ────────────────────────────────────────────────────────
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-PH'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript
        if (e.results[i].isFinal) final += txt
        else interim += txt
      }
      setInterimText(interim)
      if (final) {
        setForm(p => ({ ...p, notes: (p.notes ? p.notes + ' ' : '') + final.trim() }))
        setInterimText('')
        applyKeywords(final)
      }
    }
    rec.onend   = () => { setListening(false); setInterimText('') }
    rec.onerror = () => { setListening(false); setInterimText('') }

    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  const stopVoice = () => { recognitionRef.current?.stop(); setListening(false) }

  // ── Submit ────────────────────────────────────────────────────────────────────
  const submit = async () => {
    const svcArr = Array.isArray(form.service_type) ? form.service_type : [form.service_type]
    if (svcArr.length === 0) return
    setLoading(true)
    const payload = {
      ...form,
      lat,
      lng,
      victim_age_group:    ageGroup,
      special_conditions:  conditions.join(','),
      victim_id:           user?.victim_id ?? null,
      name:                user?.name      ?? null,
    }
    // realPacketId is set below after generation — attached to payload before online submission

    // Always broadcast over mesh — fires regardless of internet state.
    // Generate the display ID and record state immediately so the Activity tab
    // shows it even if the user navigates away before the async broadcast resolves.
    const sosDisplayId   = 'SOS-' + String(Math.floor(10000 + Math.random() * 90000))
    const realPacketId   = (() => {
      try { return crypto.randomUUID() } catch {}
      const b = new Uint8Array(16)
      crypto.getRandomValues(b)
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
      return [...b].map((x, i) => ([3,5,7,9].includes(i)?'-':'') + x.toString(16).padStart(2,'0')).join('')
    })()
    setActiveSOS(realPacketId, sosDisplayId)
    logMeshEvent('sos_broadcast', {
      sosDisplayId, packetId: realPacketId,
      status: payload.status, barangay: payload.barangay, peopleCount: payload.people_count,
    })
    const _sosPayload = {
      t:   'sos',
      _id: realPacketId,
      la:  payload.lat,
      lo:  payload.lng,
      s:   payload.status,
      n:   payload.people_count,
      b:   payload.barangay,
      m:   payload.municipality,
      sv:  payload.service_type,
    }
    const _payloadBytes = JSON.stringify(_sosPayload).length

    if (offline || !getNetworkOnline()) {
      // OFFLINE — broadcast via mesh first, then queue to IndexedDB
      mesh.broadcast(_sosPayload)
        .then(r   => logMeshEvent('broadcast_dispatched', { packetId: realPacketId, payloadBytes: _payloadBytes, success: r?.success, transport: r?.transport }))
        .catch(err => logMeshEvent('broadcast_error',     { packetId: realPacketId, payloadBytes: _payloadBytes, error: String(err) }))
      await db.queueSOS({ ...payload, isGuest, timestamp: Date.now() })
      setSubmitted(true)
      setLoading(false)
      return
    }

    // Attach packet ID to online payload for idempotency
    payload.mesh_packet_id = realPacketId

    // ONLINE — attempt internet delivery first; only fall back to mesh if it fails
    try {
      const res = await api.post('/sos', payload)
      setPriorityScore(res.ai_priority_score)
      if (res.id) setNewSosId(res.id)
      // Do NOT call updateACKState here — online delivery is transport confirmation only,
      // not agency acknowledgment. ACK level is driven by meshSync.js for mesh paths.
      // Cache locally so SOSCenter can show it immediately without Supabase SELECT access.
      db.addConfirmedSOS({
        ...payload,
        id:                res.id ?? null,
        rescue_status:     'pending',
        ai_priority_score: res.ai_priority_score ?? 50,
        created_at:        new Date().toISOString(),
        timestamp:         Date.now(),
      }).catch(() => {})
      setOnlineDelivered(true)
      setSubmitted(true)
    } catch (err) {
      console.error('[SOSReport] insert failed:', err?.message ?? String(err))
      // Internet delivery failed — fall back to mesh + offline queue
      mesh.broadcast(_sosPayload)
        .then(r   => logMeshEvent('broadcast_dispatched', { packetId: realPacketId, payloadBytes: _payloadBytes, success: r?.success, transport: r?.transport }))
        .catch(err2 => logMeshEvent('broadcast_error',    { packetId: realPacketId, payloadBytes: _payloadBytes, error: String(err2) }))
      await db.queueSOS({ ...payload, isGuest, timestamp: Date.now() })
      setSosError('Server unreachable — broadcasting via mesh. Will sync when reconnected.')
      setSubmitted(true)
    }
    setLoading(false)
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (submitted) {
    const MESH_STEPS = [
      { n: 1, label: ackState.broadcastSubState === 'awaiting_peers'
          ? 'AWAITING NEARBY DEVICE — BEACON ACTIVE'
          : ackState.broadcastSubState === 'retrying'
          ? 'RETRYING — ADVERTISING FAILED, QUEUED'
          : ackState.broadcastSubState === 'connecting'
          ? 'CONNECTING TO NEARBY DEVICE…'
          : ackState.broadcastSubState === 'transmitted'
          ? 'SOS TRANSMITTED — AWAITING RECEIVER ACK ✓'
          : ackState.broadcastSubState === 'requesting'
          ? 'REQUESTING BROADCAST…'
          : 'SOS ADVERTISING',                                                                          color: '#f59e0b' },
      { n: 2, label: 'SOS RECEIVED BY NEARBY DEVICE',                                                color: '#22c55e' },
      { n: 3, label: `SOS RELAYED — ${ackState.ackMaxHops || '?'} HOP${(ackState.ackMaxHops ?? 1) !== 1 ? 'S' : ''}`, color: '#00d4ff' },
      { n: 4, label: 'RESPONDER RECEIVED YOUR SOS',                                                  color: '#22c55e' },
    ]

    return (
      <div className={`min-h-screen bg-mesh flex flex-col items-center justify-center p-5${isLight ? ' light-theme' : ''}`}>
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="text-center space-y-4 max-w-sm w-full"
        >
          {onlineDelivered ? (
            /* ── Online delivery confirmed ─────────────────────────────────── */
            <>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[rgba(34,197,94,0.3)] to-[rgba(22,163,74,0.3)]
                              border-2 border-[rgba(34,197,94,0.5)] flex items-center justify-center mx-auto
                              shadow-[0_0_32px_rgba(34,197,94,0.4)]">
                <Check size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white">SOS Delivered</h2>
              <div className="glass rounded-xl p-3 border border-[rgba(34,197,94,0.3)]">
                <p className="text-xs text-[#22c55e] font-semibold mb-1 tracking-wider">REPORT TRANSMITTED TO SYSTEM</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your SOS has been delivered to the emergency response system.
                  A responder will be assigned shortly. Stay in place if possible.
                </p>
              </div>
              {priorityScore && (
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-slate-500">AI Priority Score</p>
                  <p className="text-3xl font-black text-[#ef4444]">{priorityScore}</p>
                  <p className="text-xs text-slate-400">
                    {priorityScore >= 80 ? 'CRITICAL – Rescue teams alerted' :
                     priorityScore >= 60 ? 'HIGH – Added to priority queue' :
                     priorityScore >= 40 ? 'MODERATE – In rescue queue' : 'LOW – Queued for response'}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* ── Mesh / offline path ────────────────────────────────────────── */
            <>
              {/* 4-level SOS propagation checklist */}
              <div className="rounded-2xl px-5 py-4 glass border-2 mx-auto w-full border-[rgba(255,255,255,0.1)]">
                <p className="text-[10px] text-slate-500 text-center mb-3 font-mono tracking-wider">
                  {ackState.sosDisplayId ?? 'SOS-XXXXX'}
                </p>
                <div className="space-y-2.5">
                  {MESH_STEPS.map(({ n, label, color }) => {
                    const done    = ackState.ackLevel > n
                    const active  = ackState.ackLevel === n
                    const pending = ackState.ackLevel < n
                    return (
                      <div key={n} className="flex items-center gap-2.5">
                        {done ? (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                               style={{ background: color }}>
                            <Check size={9} className="text-black" strokeWidth={3} />
                          </div>
                        ) : active ? (
                          <div className="w-4 h-4 rounded-full shrink-0 animate-pulse"
                               style={{ background: color }} />
                        ) : (
                          <div className="w-4 h-4 rounded-full shrink-0 border border-slate-700" />
                        )}
                        <p className={`text-[11px] font-bold tracking-wider${pending ? ' text-slate-600' : ''}`}
                           style={pending ? {} : { color }}>
                          {label}
                        </p>
                      </div>
                    )
                  })}
                </div>
                {ackState.ackDevices.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                    <p className="text-[10px] text-slate-500">
                      Mesh nodes reached: {ackState.ackDevices.length}
                      {ackState.ackMaxHops > 0 ? ` · Max hops: ${ackState.ackMaxHops}` : ''}
                    </p>
                  </div>
                )}
              </div>

              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[rgba(239,68,68,0.3)] to-[rgba(220,38,38,0.3)]
                              border-2 border-[rgba(239,68,68,0.5)] flex items-center justify-center mx-auto
                              shadow-[0_0_32px_rgba(239,68,68,0.4)]">
                <Check size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white">SOS Sent!</h2>
              {offline && <p className="text-sm text-[#f59e0b]">Saved offline — will sync when signal returns</p>}
              {sosError && <p className="text-sm text-[#f59e0b]">{sosError}</p>}
              {priorityScore && (
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-slate-500">AI Priority Score</p>
                  <p className="text-3xl font-black text-[#ef4444]">{priorityScore}</p>
                  <p className="text-xs text-slate-400">
                    {priorityScore >= 80 ? 'CRITICAL – Rescue teams alerted' :
                     priorityScore >= 60 ? 'HIGH – Added to priority queue' :
                     priorityScore >= 40 ? 'MODERATE – In rescue queue' : 'LOW – Queued for response'}
                  </p>
                </div>
              )}
              <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.2)]">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your SOS is broadcast via mesh. Status updates above as nearby devices acknowledge it.
                  Stay in place if possible. Keep your phone on.
                </p>
              </div>
            </>
          )}
          <div className="space-y-2 w-full">
            {newSosId && (
              <NeonButton variant="primary" onClick={() => navigate(`/sos/${newSosId}`)} className="w-full">
                Track Response
              </NeonButton>
            )}
            <NeonButton variant="secondary" onClick={() => navigate('/sos/history')} className="w-full">
              View My Reports
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => navigate('/home')} className="w-full">
              Return to Home
            </NeonButton>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────────
  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar
        title="Send SOS Report"
        subtitle={isGuest ? 'Guest Mode – Unverified' : 'Verified – High Priority'}
        onBack
      />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-nav">

        {/* Offline banner */}
        {offline && (
          <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.3)]">
            <p className="text-xs text-[#f59e0b] font-medium">📡 Offline Mode</p>
            <p className="text-xs text-slate-400 mt-0.5">SOS will be stored locally and broadcast via mesh</p>
          </div>
        )}

        {/* Trust tag */}
        <div className={`glass rounded-xl p-3 border ${isGuest ? 'border-[rgba(245,158,11,0.3)]' : 'border-[rgba(0,212,255,0.3)]'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className={isGuest ? 'text-[#f59e0b]' : 'text-[#00d4ff]'} />
            <p className={`text-xs font-semibold ${isGuest ? 'text-[#f59e0b]' : 'text-[#00d4ff]'}`}>
              {isGuest ? 'Guest Report – Trust: LOW' : 'Verified Report – Trust: HIGH'}
            </p>
          </div>
          {!isGuest && (
            <p className="text-xs text-slate-400 mt-0.5">Profile auto-filled from your account</p>
          )}
        </div>

        {/* ── Emergency Service ────────────────────────────────────────────────── */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-2">
            Emergency Service
          </p>
          <p className="text-[11px] text-slate-400 mb-3">Select all that apply</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { value: 'mdrrmo',   label: 'Disaster',         gradient: 'linear-gradient(145deg,#1565C0,#42A5F5)', color: '#2196F3', Icon: CloudLightning },
              { value: 'hospital', label: 'Medical',           gradient: 'linear-gradient(145deg,#006064,#26C6DA)', color: '#00ACC1', Icon: HeartPulse     },
              { value: 'bfp',      label: 'Fire',              gradient: 'linear-gradient(145deg,#B71C1C,#EF5350)', color: '#F44336', Icon: Flame           },
              { value: 'pnp',      label: 'Crime /\nSecurity', gradient: 'linear-gradient(145deg,#311B92,#7E57C2)', color: '#673AB7', Icon: Shield          },
              { value: 'pcg',      label: 'Maritime',          gradient: 'linear-gradient(145deg,#0D47A1,#1E88E5)', color: '#1565C0', Icon: Anchor          },
            ].map(s => {
              const active = Array.isArray(form.service_type)
                ? form.service_type.includes(s.value)
                : form.service_type === s.value
              return (
                <motion.button
                  key={s.value}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setForm(p => {
                    const cur = Array.isArray(p.service_type) ? p.service_type : [p.service_type]
                    return {
                      ...p,
                      service_type: cur.includes(s.value)
                        ? cur.filter(v => v !== s.value)
                        : [...cur, s.value],
                    }
                  })}
                  className="relative flex flex-col items-center justify-center rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  style={{
                    height: '78px',
                    background: active
                      ? s.gradient
                      : isDark
                        ? `linear-gradient(rgba(5,10,24,0.85),rgba(5,10,24,0.85)) padding-box, ${s.gradient} border-box`
                        : `linear-gradient(rgba(255,255,255,0.88),rgba(255,255,255,0.88)) padding-box, ${s.gradient} border-box`,
                    border: active ? '1.5px solid rgba(255,255,255,0.25)' : '1.5px solid transparent',
                    boxShadow: active ? `0 4px 14px ${s.color}55` : 'none',
                  }}
                >
                  <s.Icon
                    size={22}
                    className="mb-1.5 transition-colors"
                    style={{ color: active ? 'white' : s.color }}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span
                    className="text-[8.5px] font-bold leading-tight text-center px-0.5 uppercase tracking-wide whitespace-pre-line"
                    style={{ color: active ? 'rgba(255,255,255,0.95)' : isDark ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.75)' }}
                  >
                    {s.label}
                  </span>
                </motion.button>
              )
            })}
          </div>
          {Array.isArray(form.service_type) && form.service_type.length === 0 && (
            <p className="text-xs text-[#ef4444] mt-2">Select at least one service</p>
          )}
        </GlassCard>

        {/* ── Emergency Status ─────────────────────────────────────────────────── */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
              Emergency Status
            </p>
          </div>
          <GlassSelect
            label="Current Situation *"
            value={form.status}
            onChange={(e) => f('status')(e.target.value)}
          >
            <option value="trapped">Trapped</option>
            <option value="injured">Injured</option>
            <option value="missing">Missing</option>
            <option value="safe">Safe / Need Supplies</option>
          </GlassSelect>
        </GlassCard>

        {/* ── People & Location ────────────────────────────────────────────────── */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">
            People &amp; Location
          </p>
          <div className="space-y-3">
            <GlassInput
              type="number"
              label="Number of People"
              min={1}
              max={99}
              icon={Users}
              value={form.people_count}
              onChange={(e) => f('people_count')(+e.target.value)}
            />
            <div className="flex items-center gap-2 px-3 py-2.5 glass rounded-xl border border-[rgba(255,255,255,0.08)]">
              <MapPin size={14} className={lat ? 'text-[#22c55e]' : 'text-slate-500'} />
              <p className="text-xs text-slate-400">
                {lat ? `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Getting GPS location…'}
              </p>
            </div>
            {form.barangay && (
              <p className="text-xs text-slate-500">
                {[form.barangay, form.municipality, form.province].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </GlassCard>

        {/* ── Victim Age Group ─────────────────────────────────────────────────── */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">
            Victim Age Group
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'child',  label: 'Child',  sub: 'Under 18' },
              { value: 'adult',  label: 'Adult',  sub: '18–59' },
              { value: 'senior', label: 'Senior', sub: '60+' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAgeGroup(opt.value)}
                className={`rounded-xl py-3 flex flex-col items-center gap-1 transition-all border ${
                  ageGroup === opt.value
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#0ea5e9] border-[#00d4ff]'
                    : 'glass border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]'
                }`}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: ageGroup === opt.value ? '#050a18' : '#94a3b8' }}
                >
                  {opt.label}
                </span>
                <span className={`text-[10px] ${ageGroup === opt.value ? 'text-[#1e293b]' : 'text-slate-500'}`}>{opt.sub}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* ── Additional Information / Voice ───────────────────────────────────── */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
              Additional Information
            </p>
            {voiceSupported && (
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all border ${
                  listening
                    ? 'bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.4)] text-[#ef4444]'
                    : 'glass border-[rgba(255,255,255,0.12)] text-slate-400 hover:text-white hover:border-[rgba(255,255,255,0.25)]'
                }`}
              >
                <Mic size={13} className={listening ? 'animate-pulse' : ''} />
                {listening ? 'Stop' : 'Speak'}
              </button>
            )}
          </div>

          {listening && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 glass rounded-xl border border-[rgba(239,68,68,0.3)]">
              <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse shrink-0" />
              <p className="text-xs text-[#ef4444] font-medium shrink-0">Listening…</p>
              {interimText && (
                <p className="text-xs text-slate-400 truncate flex-1 italic">{interimText}</p>
              )}
            </div>
          )}

          {voiceDetected.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {voiceDetected.map(d => (
                <span
                  key={d}
                  className="text-[10px] px-2 py-0.5 rounded-full
                             bg-[rgba(0,212,255,0.1)] text-[#00d4ff] border border-[rgba(0,212,255,0.2)]"
                >
                  ✓ {d}
                </span>
              ))}
            </div>
          )}

          <GlassTextarea
            label="Notes (Optional)"
            placeholder="Describe your situation, landmarks, injuries, special needs…"
            icon={FileText}
            value={form.notes}
            onChange={(e) => f('notes')(e.target.value)}
            rows={4}
          />
        </GlassCard>

        <NeonButton
          variant="red"
          size="lg"
          onClick={submit}
          loading={loading}
          className="w-full"
        >
          Send Emergency SOS
        </NeonButton>

      </main>

      <MobileNavBar items={NAV} />

    </div>
  )
}
