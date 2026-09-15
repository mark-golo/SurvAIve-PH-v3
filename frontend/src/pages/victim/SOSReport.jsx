import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, MapPin, Users, FileText, Send, Check,
  Mic, Camera, Scan,
} from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassSelect, GlassInput, GlassTextarea } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import { useAuthStore } from '../../store/auth'
import { db } from '../../lib/db'
import { mesh } from '../../lib/mesh'
import api from '../../lib/api'
import { analyzeScene } from '../../lib/yolo11'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline, onNetworkChange } from '../../lib/capacitor'
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
  const { user, isGuest, token } = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')

  // ── Form state ───────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    status:       'trapped',
    people_count: 1,
    notes:        '',
    barangay:     user?.barangay    ?? '',
    municipality: user?.municipality ?? '',
    province:     user?.province    ?? '',
  })
  const [ageGroup,    setAgeGroup]    = useState('adult')
  const [conditions,  setConditions]  = useState([])
  const [lat,  setLat]  = useState(user?.lat ?? null)
  const [lng,  setLng]  = useState(user?.lng ?? null)
  const [loading,     setLoading]     = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [sosError,    setSosError]    = useState(null)
  const [priorityScore, setPriorityScore] = useState(null)
  const [offline,     setOffline]     = useState(!getNetworkOnline())

  // ── Voice state ──────────────────────────────────────────────────────────────
  const [listening,      setListening]      = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [interimText,    setInterimText]    = useState('')
  const [voiceDetected,  setVoiceDetected]  = useState([])
  const recognitionRef = useRef(null)

  // ── Dual-mode SOS state ──────────────────────────────────────────────────────
  const [sosMode,      setSosMode]      = useState('status') // 'status' | 'photo'
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [aiAnalysis,   setAiAnalysis]   = useState(null)
  const [aiLoading,    setAiLoading]    = useState(false)
  // Camera live-view state
  const [showCamera,    setShowCamera]    = useState(false)
  const [cameraStream,  setCameraStream]  = useState(null)
  const [cameraError,   setCameraError]   = useState(null)
  const photoInputRef = useRef(null)
  const videoRef      = useRef(null)

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      () => {}
    )
    const handlePromise = onNetworkChange(connected => setOffline(!connected))
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
      handlePromise.then(h => h.remove()).catch(() => {})
      window.removeEventListener('online', drainQueue)
    }
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────
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

  // ── Photo mode helpers ───────────────────────────────────────────────────────

  // Apply a File object from either camera capture or file picker
  const applyPhotoFile = (file) => {
    if (!file) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setAiAnalysis(null)
  }

  // File-picker fallback (gallery / filesystem)
  const handlePhotoSelect = (e) => applyPhotoFile(e.target.files?.[0])

  // Open live camera via getUserMedia; fall back to file picker if unavailable
  const handleCaptureClick = async () => {
    setCameraError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      photoInputRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      setCameraStream(stream)
      setShowCamera(true)
      // Attach stream to video element after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch {
      // Permission denied or no camera device — fall back to file picker
      photoInputRef.current?.click()
    }
  }

  // Stop camera stream and close live view
  const stopCamera = () => {
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
    setShowCamera(false)
  }

  // Capture current video frame to a File object
  const captureFrame = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `scene_${Date.now()}.jpg`, { type: 'image/jpeg' })
      stopCamera()
      applyPhotoFile(file)
    }, 'image/jpeg', 0.92)
  }

  const runAIAnalysis = async () => {
    if (!photoFile) return
    setAiLoading(true)
    try {
      const result = await analyzeScene(photoFile)
      setAiAnalysis(result)
      // Auto-populate form fields from AI results (user can still adjust)
      const { suggestedFields } = result
      setForm(p => ({
        ...p,
        status:       suggestedFields.status,
        people_count: Math.max(p.people_count, suggestedFields.people_count),
      }))
      setConditions(suggestedFields.special_conditions)
    } catch (err) {
      console.error('[YOLO11] analyzeScene failed:', err)
    } finally {
      setAiLoading(false)
    }
  }

  const switchMode = (mode) => {
    setSosMode(mode)
    // Clear photo state when switching back to status mode
    if (mode === 'status') {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoFile(null)
      setPhotoPreview(null)
      setAiAnalysis(null)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  const submit = async () => {
    setLoading(true)
    const payload = {
      ...form,
      lat,
      lng,
      victim_age_group:    ageGroup,
      special_conditions:  conditions.join(','),
      sos_mode:            sosMode,
      victim_id:           user?.victim_id ?? null,
      name:                user?.name      ?? null,
      // Include YOLO11 analysis results only when Photo Mode was used with analysis
      ...(sosMode === 'photo' && aiAnalysis ? {
        ai_scene_label:       aiAnalysis.classification.label,
        ai_scene_confidence:  aiAnalysis.classification.confidence,
        ai_detected_count:    aiAnalysis.detection.count,
      } : {}),
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

  // ── Success screen ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className={`min-h-screen bg-mesh flex flex-col items-center justify-center p-5${isLight ? ' light-theme' : ''}`}>
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
          {/* YOLO11 AI analysis summary badge (Photo Mode) */}
          {sosMode === 'photo' && aiAnalysis && (
            <div className="glass rounded-xl p-3 border border-[rgba(139,92,246,0.3)]">
              <p className="text-xs text-violet-400 font-semibold mb-1">🤖 YOLO11 Scene Analysis</p>
              <p className="text-sm text-white font-bold">{aiAnalysis.classification.label}</p>
              <p className="text-xs text-slate-400">
                {aiAnalysis.classification.confidence}% confidence · {aiAnalysis.detection.count} detected
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

  // ── Form ──────────────────────────────────────────────────────────────────────
  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar
        title="Send SOS Report"
        subtitle={isGuest ? 'Guest Mode – Unverified' : 'Verified – High Priority'}
        onBack
      />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">

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

        {/* ── Mode Toggle ─────────────────────────────────────────────────────── */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">
            SOS Report Mode
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { mode: 'status', emoji: '📋', label: 'Status Mode',  sub: 'Select your situation manually' },
              { mode: 'photo',  emoji: '📷', label: 'Photo Mode',   sub: 'AI analyzes your scene photo' },
            ].map(opt => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => switchMode(opt.mode)}
                className={`glass rounded-xl py-3 flex flex-col items-center gap-1 transition-all border ${
                  sosMode === opt.mode
                    ? 'border-[rgba(139,92,246,0.5)] bg-[rgba(139,92,246,0.08)]'
                    : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]'
                }`}
              >
                <span className="text-lg">{opt.emoji}</span>
                <span
                  className="text-xs font-bold"
                  style={{ color: sosMode === opt.mode ? '#8b5cf6' : '#94a3b8' }}
                >
                  {opt.label}
                </span>
                <span className="text-[10px] text-slate-500 text-center px-2 leading-tight">
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* ── Photo Mode Panel ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {sosMode === 'photo' && (
            <motion.div
              key="photo-panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <GlassCard>
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">
                  📷 Scene Photo — YOLO11 Analysis
                </p>

                {/* Hidden file input — capture="environment" opens rear camera on Android */}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                {!photoPreview ? (
                  /* Tap-to-capture area — opens live camera via getUserMedia */
                  <button
                    type="button"
                    onClick={handleCaptureClick}
                    className="w-full glass rounded-xl border-2 border-dashed border-[rgba(139,92,246,0.35)]
                               py-8 flex flex-col items-center gap-2
                               hover:border-[rgba(139,92,246,0.65)] transition-all"
                  >
                    <Camera size={28} className="text-violet-400" />
                    <span className="text-sm text-slate-300 font-medium">Tap to open camera</span>
                    <span className="text-xs text-slate-500 text-center px-4">
                      Point at the scene and capture · used for AI analysis only
                    </span>
                  </button>
                ) : (
                  <div className="space-y-3">

                    {/* Preview + Change button */}
                    <div className="relative rounded-xl overflow-hidden border border-[rgba(139,92,246,0.35)]">
                      <img
                        src={photoPreview}
                        alt="Captured scene"
                        className="w-full h-44 object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleCaptureClick}
                        className="absolute top-2 right-2 glass rounded-lg px-2.5 py-1
                                   text-[10px] font-medium text-slate-200 hover:text-white transition-colors"
                      >
                        Retake
                      </button>
                    </div>

                    {/* Analyze button — shown before analysis */}
                    {!aiAnalysis && (
                      <NeonButton
                        variant="violet"
                        onClick={runAIAnalysis}
                        loading={aiLoading}
                        className="w-full"
                      >
                        <Scan size={14} className="mr-2" />
                        {aiLoading ? 'Analyzing with YOLO11…' : 'Analyze Scene with YOLO11'}
                      </NeonButton>
                    )}

                    {/* AI Results — shown after analysis */}
                    <AnimatePresence>
                      {aiAnalysis && (
                        <motion.div
                          key="ai-results"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-2"
                        >
                          {/* YOLO11 Classification */}
                          <div className="glass rounded-xl p-3 border border-[rgba(139,92,246,0.25)]">
                            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-2">
                              YOLO11 Classification
                            </p>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-bold text-white">
                                {aiAnalysis.classification.label}
                              </span>
                              <span className="text-xs font-semibold text-violet-300">
                                {aiAnalysis.classification.confidence}%
                              </span>
                            </div>
                            <div className="w-full bg-[rgba(255,255,255,0.06)] rounded-full h-1.5 overflow-hidden">
                              <div
                                style={{ width: `${aiAnalysis.classification.confidence}%` }}
                                className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all"
                              />
                            </div>
                          </div>

                          {/* YOLO11 Detection */}
                          <div className="glass rounded-xl p-3 border border-[rgba(139,92,246,0.25)]">
                            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-2">
                              YOLO11 Detection
                            </p>
                            <p className="text-sm text-white font-bold mb-1.5">
                              {aiAnalysis.detection.count}{' '}
                              person{aiAnalysis.detection.count !== 1 ? 's' : ''} / object
                              {aiAnalysis.detection.count !== 1 ? 's' : ''} detected
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {[...new Set(aiAnalysis.detection.objects)].map((obj, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-2 py-0.5 rounded-full
                                             bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.3)]
                                             text-violet-300"
                                >
                                  {obj}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Auto-populated notice */}
                          <div className="glass rounded-xl p-2.5 border border-[rgba(0,212,255,0.2)]">
                            <p className="text-[10px] text-[#00d4ff] leading-relaxed">
                              ✓ AI pre-filled status, conditions &amp; people count below.
                              Review and adjust if needed before submitting.
                            </p>
                          </div>

                          {/* Re-analyze option */}
                          <button
                            type="button"
                            onClick={() => { setAiAnalysis(null); setPhotoFile(null); setPhotoPreview(null) }}
                            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors underline"
                          >
                            Take a different photo
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Emergency Status ─────────────────────────────────────────────────── */}
        {/* Shown in both modes; in Photo Mode shows AI-suggested value */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
              Emergency Status
            </p>
            {sosMode === 'photo' && aiAnalysis && (
              <span className="text-[10px] text-violet-400">🤖 AI-suggested</span>
            )}
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
              label={sosMode === 'photo' && aiAnalysis ? 'Number of People (AI-detected)' : 'Number of People'}
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
                className={`glass rounded-xl py-3 flex flex-col items-center gap-1 transition-all border ${
                  ageGroup === opt.value
                    ? 'border-[rgba(0,212,255,0.5)] bg-[rgba(0,212,255,0.08)]'
                    : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]'
                }`}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: ageGroup === opt.value ? '#00d4ff' : '#94a3b8' }}
                >
                  {opt.label}
                </span>
                <span className="text-[10px] text-slate-500">{opt.sub}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* ── Special Conditions ───────────────────────────────────────────────── */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
              Special Conditions{' '}
              <span className="text-slate-600 normal-case font-normal">(select all that apply)</span>
            </p>
            {sosMode === 'photo' && aiAnalysis && conditions.length > 0 && (
              <span className="text-[10px] text-violet-400">🤖 AI-detected</span>
            )}
          </div>
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
                  <span
                    className="text-xs font-medium text-left leading-tight"
                    style={{ color: active ? '#ef4444' : '#94a3b8' }}
                  >
                    {cond.label}
                  </span>
                </button>
              )
            })}
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

        {/* Photo Mode guard — require analysis before allowing submit */}
        {sosMode === 'photo' && !aiAnalysis && photoFile && (
          <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.3)]">
            <p className="text-xs text-[#f59e0b]">
              ⚠ Run YOLO11 analysis before submitting, or switch to Status Mode.
            </p>
          </div>
        )}

        <NeonButton
          variant="red"
          size="lg"
          onClick={submit}
          loading={loading}
          disabled={sosMode === 'photo' && photoFile != null && aiAnalysis == null}
          className="w-full"
        >
          <Send size={16} className="mr-2" />
          Send Emergency SOS
        </NeonButton>

      </main>

      <MobileNavBar items={NAV} />

      {/* ── Live Camera Overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            key="camera-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Viewfinder */}
            <div className="flex-1 relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Crosshair guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/30 rounded-2xl" />
              </div>
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 px-4 pt-safe pb-3
                              bg-gradient-to-b from-black/70 to-transparent flex items-center gap-3">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  ✕
                </button>
                <p className="text-sm font-semibold text-white/90">Point camera at disaster scene</p>
              </div>
              {/* Error message */}
              {cameraError && (
                <div className="absolute bottom-28 left-4 right-4 bg-black/70 rounded-xl p-3">
                  <p className="text-xs text-[#f59e0b] text-center">{cameraError}</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="bg-black/90 px-6 py-8 flex flex-col items-center gap-4">
              {/* Shutter button */}
              <button
                type="button"
                onClick={captureFrame}
                className="w-18 h-18 rounded-full border-4 border-white/80 bg-white/20
                           hover:bg-white/35 active:scale-95 transition-all
                           flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                style={{ width: '72px', height: '72px' }}
              >
                <Camera size={28} className="text-white" />
              </button>
              <p className="text-xs text-white/50">Tap to capture</p>
              {/* File picker fallback */}
              <button
                type="button"
                onClick={() => { stopCamera(); photoInputRef.current?.click() }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors underline"
              >
                Use file from gallery instead
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
