import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, MapPin, Users, FileText, Send, Check } from 'lucide-react'
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
  const [lat, setLat] = useState(user?.lat ?? null)
  const [lng, setLng] = useState(user?.lng ?? null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sosError, setSosError] = useState(null)
  const [priorityScore, setPriorityScore] = useState(null)
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      () => {}
    )
    const handler = () => setOffline(!navigator.onLine)
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)
    return () => { window.removeEventListener('online', handler); window.removeEventListener('offline', handler) }
  }, [])

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: typeof v === 'function' ? v(p[k]) : v }))

  const submit = async () => {
    setLoading(true)
    const payload = { ...form, lat, lng }

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

        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Additional Information</p>
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
