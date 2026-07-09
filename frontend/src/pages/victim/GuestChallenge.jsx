import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, AlertTriangle, Shield, ArrowLeft, Check } from 'lucide-react'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassSelect } from '../../components/ui/GlassInput'
import { useAuthStore } from '../../store/auth'
import { PROVINCES, getMunicipalities, getBarangays } from '../../lib/philippineLocations'

const CAPTCHA_ICONS = [
  { id: 'ambulance', emoji: '🚑', label: 'Ambulance' },
  { id: 'fire',      emoji: '🔥', label: 'Fire' },
  { id: 'flood',     emoji: '🌊', label: 'Flood' },
  { id: 'police',    emoji: '🚔', label: 'Police Car' },
  { id: 'rescue',    emoji: '⛑️',  label: 'Rescue Helmet' },
  { id: 'heart',     emoji: '❤️',  label: 'Heart' },
]
const CORRECT_ID = 'rescue'

export function GuestChallenge() {
  const navigate = useNavigate()
  const { setGuest } = useAuthStore()

  const [step, setStep] = useState(0)
  const [locMethod, setLocMethod] = useState('gps') // 'gps'|'manual'
  const [gpsStatus, setGpsStatus] = useState('idle') // 'idle'|'loading'|'found'|'error'
  const [coords, setCoords] = useState(null)
  const [province, setProvince] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [barangay, setBarangay] = useState('')
  const [shuffled, setShuffled] = useState([])
  const [selected, setSelected] = useState(null)
  const [captchaError, setCaptchaError] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    setShuffled([...CAPTCHA_ICONS].sort(() => Math.random() - 0.5))
  }, [])

  const detectGPS = () => {
    setGpsStatus('loading')
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setCoords(pos.coords); setGpsStatus('found') },
      () => { setGpsStatus('error'); setLocMethod('manual') },
      { timeout: 8000 }
    )
  }

  useEffect(() => { if (step === 0) detectGPS() }, [step])

  const verifyCaptha = () => {
    if (selected !== CORRECT_ID) { setCaptchaError(true); setSelected(null); return }
    setCaptchaError(false); setStep(2)
  }

  const proceed = () => {
    setGuest({
      mode: 'guest',
      role: 'victim',
      barangay,
      municipality,
      province,
      lat: coords?.latitude ?? null,
      lng: coords?.longitude ?? null,
    })
    navigate('/home')
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/')} className="text-slate-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-white">Send SOS as Guest</h2>
            <p className="text-xs text-slate-500">Step {step + 1} of 3</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {[0,1,2].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-[#f59e0b]' : 'bg-slate-700'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 0 – Location */}
          {step === 0 && (
            <motion.div key="loc" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GlassCard className="space-y-4">
                <p className="text-sm font-semibold text-white">Confirm Your Location</p>

                {locMethod === 'gps' && (
                  <div className="text-center py-4">
                    {gpsStatus === 'loading' && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full border-2 border-[rgba(0,212,255,0.3)] border-t-[#00d4ff] animate-spin" />
                        <p className="text-sm text-slate-400">Detecting your location…</p>
                      </div>
                    )}
                    {gpsStatus === 'found' && coords && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[rgba(34,197,94,0.2)] flex items-center justify-center">
                          <Check size={22} className="text-[#22c55e]" />
                        </div>
                        <p className="text-sm text-[#22c55e] font-medium">GPS Location Detected</p>
                        <p className="text-xs text-slate-500">{coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}</p>
                        <button onClick={() => setLocMethod('manual')} className="text-xs text-slate-500 underline">
                          Set location manually instead
                        </button>
                      </div>
                    )}
                    {gpsStatus === 'error' && (
                      <p className="text-sm text-[#ef4444]">GPS unavailable. Please select manually.</p>
                    )}
                  </div>
                )}

                {(locMethod === 'manual' || gpsStatus !== 'found') && (
                  <div className="space-y-3">
                    <GlassSelect label="Province" value={province}
                      onChange={(e) => { setProvince(e.target.value); setMunicipality(''); setBarangay('') }}>
                      <option value="">Select Province</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </GlassSelect>
                    <GlassSelect label="Municipality" value={municipality}
                      onChange={(e) => { setMunicipality(e.target.value); setBarangay('') }} disabled={!province}>
                      <option value="">Select Municipality</option>
                      {getMunicipalities(province).map(m => <option key={m} value={m}>{m}</option>)}
                    </GlassSelect>
                    <GlassSelect label="Barangay" value={barangay}
                      onChange={(e) => setBarangay(e.target.value)} disabled={!municipality}>
                      <option value="">Select Barangay</option>
                      {getBarangays(municipality).map(b => <option key={b} value={b}>{b}</option>)}
                    </GlassSelect>
                  </div>
                )}

                <NeonButton variant="orange"
                  onClick={() => setStep(1)}
                  disabled={locMethod === 'gps' ? gpsStatus !== 'found' : !barangay}
                  className="w-full">
                  Confirm Location →
                </NeonButton>
              </GlassCard>
            </motion.div>
          )}

          {/* STEP 1 – CAPTCHA */}
          {step === 1 && (
            <motion.div key="captcha" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GlassCard className="space-y-4">
                <div className="text-center">
                  <p className="font-semibold text-white text-sm">Verify you're a real person</p>
                  <p className="text-xs text-slate-400 mt-1">Tap the <strong className="text-white">Rescue Helmet ⛑️</strong></p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {shuffled.map(icon => (
                    <button key={icon.id} onClick={() => setSelected(icon.id)}
                      className={`h-16 rounded-xl text-3xl transition-all border ${
                        selected === icon.id
                          ? 'bg-[rgba(0,212,255,0.15)] border-[rgba(0,212,255,0.5)] shadow-[0_0_12px_rgba(0,212,255,0.3)]'
                          : 'glass border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]'
                      }`}>
                      {icon.emoji}
                    </button>
                  ))}
                </div>
                {captchaError && <p className="text-xs text-[#ef4444] text-center">Incorrect. Please try again.</p>}
                <NeonButton variant="orange" onClick={verifyCaptha} disabled={!selected} className="w-full">
                  Confirm →
                </NeonButton>
              </GlassCard>
            </motion.div>
          )}

          {/* STEP 2 – Disclaimer */}
          {step === 2 && (
            <motion.div key="disclaimer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GlassCard className="space-y-4">
                <div className="flex items-start gap-3">
                  <Shield size={24} className="text-[#ef4444] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white text-sm">Disclaimer</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Submitting a false emergency report is a violation of <strong className="text-slate-300">RA 10173</strong> and
                      local emergency ordinances. This report is <strong className="text-slate-300">logged and traceable</strong>.
                      False alarms waste emergency resources and may delay help for real victims.
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 accent-[#00d4ff]" />
                  <span className="text-xs text-slate-300">I understand and confirm this is a real emergency</span>
                </label>
                <NeonButton variant="orange" onClick={proceed} disabled={!accepted} className="w-full" size="lg">
                  I Understand – Proceed to SOS
                </NeonButton>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
