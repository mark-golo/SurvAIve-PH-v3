import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, MapPin, Users, FileText, Send, Check, Mic } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassSelect, GlassInput, GlassTextarea } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import { useAuthStore } from '../../store/auth'
import { db } from '../../lib/db'
import { mesh } from '../../lib/mesh'
import api from '../../lib/api'
import { Home, Map, Radio, Settings, MessageSquare } from 'lucide-react'

const NAV = [
  { icon: Home, label: 'Home', path: '/home' },
  { icon: MessageSquare, label: 'SOS', path: '/sos' },
  { icon: Map, label: 'Map', path: '/map' },
  { icon: Radio, label: 'Mesh', path: '/mesh' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export function SOSReport() {
  const navigate = useNavigate()
  const { user, isGuest, token } = useAuthStore()

  const [form, setForm] = useState({
    status: 'trapped',
    people_count: 1,
    notes: '',
    barangay: user?.barangay ?? '',
    municipality: user?.municipality ?? '',
    province: user?.province ?? '',
  })
  const [ageGroup, setAgeGroup]     = useState('adult')
  const [conditions, setConditions] = useState([])
  const [lat, setLat] = useState(user?.lat ?? null)
  const [lng, setLng] = useState(user?.lng ?? null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sosError, setSosError] = useState(null)
  const [priorityScore, setPriorityScore] = useState(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [listening, setListening]           = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [interimText, setInterimText]       = useState('')
  const [voiceDetected, setVoiceDetected]   = useState([])
  const recognitionRef = useRef(null)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      () => {}
    )
    const handler = () => setOffline(!navigator.onLine)
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)
    setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))

    // Sync drain — flush queued offline SOS reports when internet returns
    const drainQueue = async () => {
      try {
        const pending = await db.getPendingSOS()
        for (const item of pending) {
          try {
            const res = await api.post('/sos', item)
            await db.markSOSSynced(item.localId, res?.id ?? null)
          } catch { /* keep in queue if upload fails */ }
        }
      } catch { /* ignore drain errors */ }
    }
    window.addEventListener('online', drainQueue)

    return () => {
      window.removeEventListener('online', handler)
      window.removeEventListener('offline', handler)
      window.removeEventListener('online', drainQueue)
    }
  }, [])

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: typeof v === 'function' ? v(p[k]) : v }))

  const toggleCondition = (key) =>
    setConditions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

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

  const submit = async () => {
    setLoading(true)
    const payload = {
      ...form, lat, lng,
      victim_age_group:   ageGroup,
      special_conditions: conditions.join(','),
    }

    if (offline) {
      await db.queueSOS({ ...payload, isGuest, timestamp: Date.now() })
      mesh.broadcast({ type: 'sos', payload })
      setSubmitted(true)
      setLoading(false)
      return
    }

    try {
      const res = await api.post('/sos', payload)
      setPriorityScore(res.ai_priority_score)
      setSubmitted(true)
    } catch (err) {
      const msg = err?.message ?? String(err)
      console.error('[SOSReport] insert failed:', msg)
      await db.queueSOS({ ...payload, isGuest, timestamp: Date.now() })
      setSosError(`SOS saved offline. (Error: ${msg})`)
      setSubmitted(true)
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="text-center space-y-4 max-w-sm w-full"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[rgba(239,68,68,0.3)] to-[rgba(220,38,38,0.3)]
                          border-2 border-[rgba(239,68,68,0.5)] flex items-center justify-center mx-auto
                          shadow-[0_0_40px_rgba(239,68,68,0.4)]">
            <Check size={36} className="text-white" />
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
              Your SOS has been broadcast via mesh network and queued for rescue teams.
              Stay in place if possible. Keep your phone on.
            </p>
          </div>
          <NeonButton variant="ghost" onClick={() => navigate('/home')} className="w-full">
            Return to Home
          </NeonButton>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar
        title="Send SOS Report"
        subtitle={isGuest ? 'Guest Mode – Unverified' : 'Verified – High Priority'}
        onBack
      />

      <main className="flex-1 p-4 space-y-4">
        {offline && (
          <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.3)]">
            <p className="text-xs text-[#f59e0b] font-medium">📡 Offline Mode</p>
            <p className="text-xs text-slate-400 mt-0.5">SOS will be stored locally and broadcast via mesh</p>
          </div>
        )}

        {/* Trust tag info */}
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

        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Emergency Status</p>
          <GlassSelect label="Current Situation *" value={form.status} onChange={(e) => f('status')(e.target.value)}>
            <option value="trapped">Trapped</option>
            <option value="injured">Injured</option>
            <option value="missing">Missing</option>
            <option value="safe">Safe / Need Supplies</option>
          </GlassSelect>
        </GlassCard>

        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">People &amp; Location</p>
          <div className="space-y-3">
            <GlassInput
              type="number" label="Number of People" min={1} max={99} icon={Users}
              value={form.people_count} onChange={(e) => f('people_count')(+e.target.value)}
            />
            <div className="flex items-center gap-2 px-3 py-2.5 glass rounded-xl border border-[rgba(255,255,255,0.08)]">
              <MapPin size={14} className={lat ? 'text-[#22c55e]' : 'text-slate-500'} />
              <p className="text-xs text-slate-400">
                {lat ? `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Getting GPS location…'}
              </p>
            </div>
            {form.barangay && (
              <p className="text-xs text-slate-500">{[form.barangay, form.municipality, form.province].filter(Boolean).join(', ')}</p>
            )}
          </div>
        </GlassCard>

        {/* Victim age group */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Victim Age Group</p>
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
                className={`glass rounded-xl py-3 flex flex-col items-center gap-1 transition-all border ${
                  ageGroup === opt.value
                    ? 'border-[rgba(0,212,255,0.5)] bg-[rgba(0,212,255,0.08)]'
                    : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]'
                }`}
              >
                <span className="text-sm font-bold" style={{ color: ageGroup === opt.value ? '#00d4ff' : '#94a3b8' }}>
                  {opt.label}
                </span>
                <span className="text-[10px] text-slate-500">{opt.sub}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Special conditions */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">
            Special Conditions <span className="text-slate-600 normal-case font-normal">(select all that apply)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'medical_emergency',   label: 'Medical Emergency', icon: '🏥' },
              { key: 'fire',                label: 'Fire',              icon: '🔥' },
              { key: 'flooding',            label: 'Flooding',          icon: '🌊' },
              { key: 'structural_collapse', label: 'Structural Collapse', icon: '🏚️' },
            ].map(cond => {
              const active = conditions.includes(cond.key)
              return (
                <button
                  key={cond.key}
                  type="button"
                  onClick={() => toggleCondition(cond.key)}
                  className={`glass rounded-xl p-3 flex items-center gap-2 transition-all border ${
                    active
                      ? 'border-[rgba(239,68,68,0.5)] bg-[rgba(239,68,68,0.08)]'
                      : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]'
                  }`}
                >
                  <span className="text-base">{cond.icon}</span>
                  <span className="text-xs font-medium text-left leading-tight" style={{ color: active ? '#ef4444' : '#94a3b8' }}>
                    {cond.label}
                  </span>
                </button>
              )
            })}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">Additional Information</p>
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
              {interimText && <p className="text-xs text-slate-400 truncate flex-1 italic">{interimText}</p>}
            </div>
          )}

          {voiceDetected.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {voiceDetected.map(d => (
                <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,212,255,0.1)] text-[#00d4ff] border border-[rgba(0,212,255,0.2)]">
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

        <NeonButton variant="red" size="lg" onClick={submit} loading={loading} className="w-full">
          <Send size={16} className="mr-2" />
          Send Emergency SOS
        </NeonButton>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
