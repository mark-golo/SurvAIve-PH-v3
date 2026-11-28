import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { buildStructuredSOS } from '../../lib/ai/emergencyIntelligence'
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
import api from '../../lib/api'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline, onNetworkChange, probeBackend } from '../../lib/capacitor'
import { sendEmergencySMS, openSMSApp, isSMSCapable } from '../../lib/smsPlugin'
import { PHILSMS_RECEIVING_NUMBER } from '../../lib/smsConfig'
import { Home, Map, Sparkles, Settings, MessageSquare } from 'lucide-react'

const NAV = [
  { icon: Home,          label: 'Home',     path: '/home' },
  { icon: MessageSquare, label: 'SOS',      path: '/sos' },
  { icon: Map,           label: 'Map',      path: '/map' },
  { icon: Sparkles,      label: 'AI',       path: '/assistant' },
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

  // ── AI Assistant prefill — user reviewed it there; everything stays editable here
  const aiPrefill = location.state?.aiPrefill ?? null
  const [showAiBanner, setShowAiBanner] = useState(!!aiPrefill)

  // ── AI completeness hints — only shown on direct entry (not when aiPrefill already active)
  const [sosHint,         setSosHint]         = useState(null)
  const [hintDismissed,   setHintDismissed]   = useState(false)

  // ── Form state ───────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    status:       aiPrefill?.form?.status ?? location.state?.status ?? 'trapped',
    people_count: aiPrefill?.form?.people_count ?? 1,
    notes:        aiPrefill?.form?.notes ?? '',
    barangay:     user?.barangay    ?? '',
    municipality: user?.municipality ?? '',
    province:     user?.province    ?? '',
    service_type: aiPrefill?.form?.service_type ?? [],
  })
  const [ageGroup,    setAgeGroup]    = useState(aiPrefill?.ageGroup ?? 'adult')
  const [conditions,  setConditions]  = useState(aiPrefill?.conditions ?? [])
  const [lat,  setLat]  = useState(user?.lat ?? null)
  const [lng,  setLng]  = useState(user?.lng ?? null)
  const [locationStatus, setLocationStatus] = useState('acquiring') // 'acquiring' | 'found' | 'unavailable'
  const [loading,       setLoading]       = useState(false)
  const [submitted,     setSubmitted]     = useState(false)
  const [sosError,      setSosError]      = useState(null)
  const [priorityScore, setPriorityScore] = useState(null)
  const [offline,       setOffline]       = useState(!getNetworkOnline())
  const [onlineDelivered, setOnlineDelivered] = useState(false)
  const [newSosId,        setNewSosId]        = useState(null)
  // 'submitted' | 'failed' | 'queued' | null
  const [smsDelivery,     setSmsDelivery]     = useState(null)
  const [smsFailReason,   setSmsFailReason]   = useState(null)
  const [smsFallbackParams, setSmsFallbackParams] = useState(null)

  // ── Voice state ──────────────────────────────────────────────────────────────
  const [listening,      setListening]      = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [interimText,    setInterimText]    = useState('')
  const [voiceDetected,  setVoiceDetected]  = useState([])
  const recognitionRef = useRef(null)
  const submittingRef  = useRef(false)

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocationStatus('found') },
      () => { setLocationStatus('unavailable') }
    )
    const handlePromise = onNetworkChange(connected => setOffline(!connected))
    setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))

    return () => {
      handlePromise.then(h => h.remove()).catch(() => {})
    }
  }, [])

  // ── AI completeness hint — debounced, only on direct entry (not aiPrefill path)
  useEffect(() => {
    if (aiPrefill || hintDismissed) return
    if (form.notes.length < 25) { setSosHint(null); return }
    const timer = setTimeout(() => {
      try {
        const result = buildStructuredSOS(form.notes, { isVerified: !isGuest })
        setSosHint(result)
      } catch { setSosHint(null) }
    }, 500)
    return () => clearTimeout(timer)
  }, [form.notes, aiPrefill, hintDismissed, isGuest])

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

  // ── Intent fallback — called from PERMISSION_DENIED error screen ─────────────
  const openIntentFallback = async () => {
    if (!smsFallbackParams) return
    try {
      await openSMSApp({
        reportId:  smsFallbackParams.reportId,
        recipient: smsFallbackParams.recipient,
        message:   smsFallbackParams.message,
      })
      await db.markSMSLaunched(smsFallbackParams.localId)
      setSmsDelivery('launched')
    } catch {
      // Intent also failed — stay on failed screen
    }
  }

  // ── SMS message builder ───────────────────────────────────────────────────────
  const buildSMSMessage = ({ meshPacketId, service_type, status, barangay, municipality, lat, lng, notes }) => {
    const id   = (meshPacketId ?? '').slice(0, 8).toUpperCase()
    const type = Array.isArray(service_type) && service_type.length > 0
      ? service_type.map(s => s?.toUpperCase()).filter(Boolean).join('+')
      : 'GENERAL'
    const loc  = [barangay, municipality].filter(Boolean).join(', ') || 'UNKNOWN'
    const lines = [
      'SURVAIvePH SOS',
      `ID: SVP-${id}`,
      `TYPE: ${type}`,
      `STATUS: ${(status ?? 'unknown').toUpperCase()}`,
      `LOC: ${loc}`,
    ]
    if (lat && lng) lines.push(`GPS: ${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`)
    if (notes)      lines.push(`MSG: ${String(notes).slice(0, 80)}`)
    return lines.join('\n')
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  // useSMS=true: attempt native Android SMS after queuing to IndexedDB
  const submit = async (useSMS = false) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSosError(null)
    const svcArr = Array.isArray(form.service_type) ? form.service_type : [form.service_type]
    if (svcArr.length === 0) {
      setSosError('Please select at least one emergency service.')
      submittingRef.current = false
      return
    }
    if (!form.people_count || !Number.isInteger(Number(form.people_count))
        || Number(form.people_count) < 1 || Number(form.people_count) > 99) {
      setSosError('Number of people affected must be a whole number between 1 and 99.')
      submittingRef.current = false
      return
    }
    setLoading(true)
    const payload = {
      ...form,
      service_type:        svcArr,
      lat,
      lng,
      victim_age_group:    ageGroup,
      special_conditions:  conditions.join(','),
      victim_id:           user?.victim_id ?? null,
      name:                user?.name      ?? null,
    }
    // Client-generated dedup UUID — kept under its legacy column name mesh_packet_id.
    // The backend's UNIQUE constraint uses it to reject duplicate submissions, and
    // guest victims use it to look up their own SOS after syncing.
    const realPacketId = (() => {
      try { return crypto.randomUUID() } catch {}
      const b = new Uint8Array(16)
      crypto.getRandomValues(b)
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
      return [...b].map((x, i) => ([4,6,8,10].includes(i)?'-':'') + x.toString(16).padStart(2,'0')).join('')
    })()
    payload.mesh_packet_id = realPacketId

    if (offline || !getNetworkOnline()) {
      try {
        const queuePayload = {
          ...payload,
          meshPacketId: realPacketId,
          isGuest,
          timestamp:    Date.now(),
          smsStatus:    useSMS ? 'pending' : null,
          source:       useSMS ? 'sms'     : 'queue_sync',
        }
        const localId = await db.queueSOS(queuePayload)

        // If the user chose SMS and the device has native SMS capability, send it now.
        if (useSMS && isSMSCapable()) {
          const smsMessage = buildSMSMessage({ ...payload, meshPacketId: realPacketId })
          try {
            const smsResult = await sendEmergencySMS({
              reportId:  realPacketId,
              recipient: PHILSMS_RECEIVING_NUMBER,
              message:   smsMessage,
            })
            if (smsResult?.status === 'submitted') {
              await db.markSMSSent(localId)
              setSmsDelivery('submitted')
            } else {
              await db.markSMSLaunched(localId)
              setSmsDelivery('launched')
            }
          } catch (smsErr) {
            console.warn('[SOSReport] SMS send failed:', smsErr?.message)
            await db.markSMSFailed(localId, smsErr?.message ?? 'SMS send failed').catch(() => {})
            setSmsFailReason(smsErr?.message ?? 'unknown')
            if (String(smsErr?.message).includes('PERMISSION_DENIED')) {
              setSmsFallbackParams({ reportId: realPacketId, recipient: PHILSMS_RECEIVING_NUMBER, message: smsMessage, localId })
            }
            setSmsDelivery('failed')
          }
        } else if (useSMS) {
          // User chose SMS but device cannot send it (no Android native capability)
          await db.markSMSFailed(localId, 'SMS not available on this device').catch(() => {})
          setSmsFailReason('NO_CAPABILITY')
          setSmsDelivery('failed')
        } else {
          setSmsDelivery('queued')
        }

        setSubmitted(true)
      } catch (offlineErr) {
        console.error('[SOSReport] offline queue failed:', offlineErr?.message)
        setSosError('Could not save your report. Storage may be full — please free space and retry.')
        submittingRef.current = false
        setLoading(false)
        return
      }
      setLoading(false)
      submittingRef.current = false
      return
    }

    // Probe actual backend reachability — catches captive portals and no-WAN Wi-Fi where
    // the OS reports "connected" but Supabase is unreachable. If the probe fails, switch
    // to the offline UI so the victim can choose SMS (which works on cellular).
    const backendUp = await probeBackend()
    if (!backendUp) {
      setOffline(true)
      setLoading(false)
      submittingRef.current = false
      return
    }

    // ONLINE — attempt internet delivery first; fall back to the offline queue if it fails
    try {
      const res = await api.post('/sos', payload)
      setPriorityScore(res.ai_priority_score)
      if (res.id != null) setNewSosId(res.id)
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
      // Internet delivery failed — fall back to the offline queue.
      // Wrapped in its own try/catch so a queueSOS failure doesn't lock the form.
      try {
        await db.queueSOS({ ...payload, meshPacketId: realPacketId, isGuest, timestamp: Date.now(), smsStatus: null, source: 'queue_sync' })
        setSosError('Server unreachable — saved on this device. It will send automatically when connection returns.')
        setSubmitted(true)
      } catch {
        setSosError('Could not save report — please retry.')
        submittingRef.current = false
        setLoading(false)
        return
      }
    }
    setLoading(false)
    submittingRef.current = false
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (submitted) {
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
              {priorityScore != null && (
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-slate-500">AI Priority Score</p>
                  <p className={`text-3xl font-black ${
                    priorityScore >= 80 ? 'text-[#ef4444]' :
                    priorityScore >= 60 ? 'text-[#f97316]' :
                    priorityScore >= 40 ? 'text-[#f59e0b]' : 'text-[#22c55e]'
                  }`}>{priorityScore}</p>
                  <p className="text-xs text-slate-400">
                    {priorityScore >= 80 ? 'CRITICAL – Rescue teams alerted' :
                     priorityScore >= 60 ? 'HIGH – Added to priority queue' :
                     priorityScore >= 40 ? 'MODERATE – In rescue queue' : 'LOW – Queued for response'}
                  </p>
                </div>
              )}
            </>
          ) : smsDelivery === 'submitted' ? (
            /* ── SMS submitted ─────────────────────────────────────────────── */
            <>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[rgba(0,212,255,0.3)] to-[rgba(14,165,233,0.3)]
                              border-2 border-[rgba(0,212,255,0.5)] flex items-center justify-center mx-auto
                              shadow-[0_0_32px_rgba(0,212,255,0.4)]">
                <Check size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white">SMS Sent</h2>
              <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.3)]">
                <p className="text-xs text-[#00d4ff] font-semibold mb-1 tracking-wider">
                  SENT DIRECTLY — NO ACTION NEEDED
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your emergency report was sent directly from this app via SMS.
                  Standard SMS charges may apply. When internet becomes available,
                  your report will also sync automatically.
                </p>
              </div>
              <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.2)]">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Stay in place if possible. If you do not receive an acknowledgment
                  shortly, move to an area with better cellular signal.
                </p>
              </div>
            </>
          ) : smsDelivery === 'launched' ? (
            /* ── SMS app opened — user must complete send ───────────────────── */
            <>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[rgba(0,212,255,0.3)] to-[rgba(0,153,255,0.3)]
                              border-2 border-[rgba(0,212,255,0.5)] flex items-center justify-center mx-auto
                              shadow-[0_0_32px_rgba(0,212,255,0.4)]">
                <Check size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white">SMS App Opened</h2>
              <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.3)]">
                <p className="text-xs text-[#00d4ff] font-semibold mb-1 tracking-wider">
                  COMPLETE SENDING IN YOUR SMS APP
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your emergency report has been loaded into your SMS app.
                  Please complete sending it, then return here.
                </p>
              </div>
              <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.2)]">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your report is also saved on this device. If the SMS is not sent,
                  it will sync automatically when internet is available.
                </p>
              </div>
            </>
          ) : smsDelivery === 'failed' ? (
            /* ── SMS failed — still saved locally ──────────────────────────── */
            <>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[rgba(239,68,68,0.3)] to-[rgba(220,38,38,0.3)]
                              border-2 border-[rgba(239,68,68,0.5)] flex items-center justify-center mx-auto
                              shadow-[0_0_32px_rgba(239,68,68,0.4)]">
                <Check size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white">SMS Failed — Saved</h2>
              {(() => {
                const r = smsFailReason ?? ''
                let body, hint, showIntentFallback = false
                if (r === 'NO_CAPABILITY') {
                  body = 'This device cannot send SMS. Your report is saved and will sync automatically when internet is available.'
                  hint = 'Connect to Wi-Fi or mobile data to sync your report.'
                } else if (r.includes('PERMISSION_DENIED')) {
                  body = 'SurvAIve PH needs SMS permission to send emergency reports. Your report is safely saved on this device.'
                  hint = 'Go to Settings → Apps → SurvAIve PH → Permissions → SMS, enable it, then retry.'
                  showIntentFallback = !!smsFallbackParams
                } else if (r.includes('NO_SIM')) {
                  body = 'No SIM card detected or no default SMS app is configured. Your report is safely saved on this device.'
                  hint = 'Insert a SIM card or set a default SMS app in Settings, then retry.'
                } else if (r.includes('RADIO_OFF') || r.includes('NO_SERVICE')) {
                  body = 'No cellular service available. Your report is safely saved on this device.'
                  hint = 'Move to an area with cellular or Wi-Fi signal to send your report.'
                } else if (r.includes('NO_APP')) {
                  body = 'No SMS app is installed on this device. Your report is safely saved on this device.'
                  hint = 'Install an SMS app or connect to Wi-Fi/mobile data to sync your report.'
                } else if (r.includes('timed out') || r.includes('timeout')) {
                  body = 'The SMS took too long to send. Your report is safely saved on this device.'
                  hint = 'The report will sync automatically when internet is available.'
                } else {
                  body = 'SMS could not be sent. Your report is safely saved on this device.'
                  hint = 'The report will sync automatically when internet is available.'
                }
                return (
                  <>
                    <div className="glass rounded-xl p-3 border border-[rgba(239,68,68,0.3)]">
                      <p className="text-xs text-[#ef4444] font-semibold mb-1 tracking-wider">
                        SMS FAILED — SAVED ON DEVICE
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
                    </div>
                    <div className="glass rounded-xl p-3 border border-[rgba(239,68,68,0.2)]">
                      <p className="text-xs text-slate-400 leading-relaxed">{hint}</p>
                    </div>
                    {showIntentFallback && (
                      <NeonButton variant="secondary" onClick={openIntentFallback} className="w-full">
                        Open SMS App Instead
                      </NeonButton>
                    )}
                  </>
                )
              })()}
            </>
          ) : (
            /* ── Queue-only / no SMS path ───────────────────────────────────── */
            <>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[rgba(245,158,11,0.3)] to-[rgba(217,119,6,0.3)]
                              border-2 border-[rgba(245,158,11,0.5)] flex items-center justify-center mx-auto
                              shadow-[0_0_32px_rgba(245,158,11,0.4)]">
                <Check size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white">SOS Saved</h2>
              <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.3)]">
                <p className="text-xs text-[#f59e0b] font-semibold mb-1 tracking-wider">
                  SAVED LOCALLY — PENDING SYNC
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your SOS is stored on this device and will be sent automatically the moment
                  a connection becomes available. It has NOT yet reached responders.
                </p>
              </div>
              {sosError && <p className="text-sm text-[#f59e0b]">{sosError}</p>}
              <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.2)]">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Stay in place if possible and keep your phone on. If you can reach an area
                  with signal or Wi-Fi, the report will send on its own.
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
          <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.3)] space-y-1">
            <p className="text-xs text-[#f59e0b] font-medium">📡 Offline Mode</p>
            <p className="text-xs text-slate-400">No internet connection detected.</p>
            {isSMSCapable() ? (
              <p className="text-xs text-slate-400">
                SMS can be sent if cellular signal is available. Standard charges may apply.
                If there is no signal, your report will be saved and retried automatically.
              </p>
            ) : (
              <p className="text-xs text-slate-400">Your SOS will be saved on this device and sent automatically when connection returns.</p>
            )}
          </div>
        )}

        {/* AI prefill banner */}
        {showAiBanner && (
          <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.3)] flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-[#00d4ff] font-medium">✨ Pre-filled by AI Assistant</p>
              <p className="text-xs text-slate-400 mt-0.5">Please review every field before sending.</p>
            </div>
            <button onClick={() => setShowAiBanner(false)} className="text-slate-500 hover:text-white text-xs shrink-0">✕</button>
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
              <MapPin size={14} className={lat ? 'text-[#22c55e]' : locationStatus === 'unavailable' ? 'text-[#ef4444]' : 'text-slate-500'} />
              <p className="text-xs text-slate-400">
                {lat && lng
                  ? `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
                  : locationStatus === 'unavailable'
                    ? 'Location unavailable — coordinates will not be included'
                    : 'Getting GPS location…'}
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

        {/* AI completeness hints — only shown on direct entry */}
        {sosHint && !hintDismissed && (
          <div className="glass rounded-2xl p-3 border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.04)] space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-wider">AI Analysis</p>
              <button onClick={() => setHintDismissed(true)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sosHint.classification.serviceTypes.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,212,255,0.12)] border border-[rgba(0,212,255,0.3)] text-[#00d4ff] font-medium capitalize">
                  {s === 'mdrrmo' ? 'Disaster' : s === 'hospital' ? 'Medical' : s === 'bfp' ? 'Fire' : s === 'pnp' ? 'Security' : s === 'pcg' ? 'Maritime' : s}
                </span>
              ))}
              {sosHint.entities.victimCount != null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.12)] border border-[rgba(139,92,246,0.3)] text-[#a78bfa] font-medium">
                  {sosHint.entities.victimCount} {sosHint.entities.victimCount === 1 ? 'person' : 'people'}
                </span>
              )}
              {sosHint.entities.conditions.map(c => (
                <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] font-medium capitalize">
                  {c.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            {sosHint.missingFields.length > 0 && (
              <div className="space-y-0.5">
                {sosHint.missingFields.map(mf => (
                  <p key={mf.field} className="text-[10px] text-amber-400">⚠ {mf.prompt}</p>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-600">AI analysis — tap Use in SOS or type to refine.</p>
          </div>
        )}

        {offline ? (
          <div className="space-y-2">
            {isSMSCapable() && (
              <NeonButton
                variant="red"
                size="lg"
                onClick={() => submit(true)}
                loading={loading}
                className="w-full"
              >
                SEND EMERGENCY VIA SMS
              </NeonButton>
            )}
            <NeonButton
              variant={isSMSCapable() ? 'ghost' : 'red'}
              size="lg"
              onClick={() => submit(false)}
              loading={loading}
              className="w-full"
            >
              {isSMSCapable() ? 'Save Only (Sync When Online)' : 'Save & Send When Online'}
            </NeonButton>
          </div>
        ) : (
          <NeonButton
            variant="red"
            size="lg"
            onClick={() => submit(false)}
            loading={loading}
            className="w-full"
          >
            Send Emergency SOS
          </NeonButton>
        )}

      </main>

      <MobileNavBar items={NAV} />

    </div>
  )
}
