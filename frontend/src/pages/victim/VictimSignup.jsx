import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ArrowLeft, Check, UserPlus, Shield, Copy, ChevronRight, Delete } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput, GlassSelect, GlassTextarea } from '../../components/ui/GlassInput'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { PROVINCES, getMunicipalities, getBarangays } from '../../lib/philippineLocations'
import {
  getOrCreateDeviceKey,
  generateVictimId,
  generateSalt,
  hashPIN,
  hashDeviceKey,
  storeLocalCredentials,
} from '../../lib/deviceAuth'

const STEPS = ['details', 'pin', 'activate']
const VULN_OPTIONS = ['Elderly (60+)', 'Person with Disability (PWD)', 'Infant (0–2 years old)', 'Pregnant', 'None']
const RELATIONSHIP_OPTIONS = ['Parent', 'Spouse', 'Sibling', 'Child', 'Neighbor', 'Other']

export function VictimSignup() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const [step, setStep]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // ── Step 0: personal details ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', contact_number: '', province: '', municipality: '', barangay: '', sitio: '',
    household_count: 1, vulnerabilities: [], medical_conditions: '',
    emergency_contact_name: '', emergency_contact_number: '',
    emergency_contact_relationship: 'Parent',
  })

  // ── Step 1: PIN pad ───────────────────────────────────────────────────────────
  const [pin, setPin]         = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinPhase, setPinPhase]     = useState('set') // 'set' | 'confirm'

  // ── Step 2: generated credentials ────────────────────────────────────────────
  const [victimId, setVictimId]   = useState('')
  const [copied, setCopied]       = useState(false)
  const [regPayload, setRegPayload] = useState(null) // holds ready-to-submit object

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: typeof v === 'function' ? v(p[k]) : v }))
  const municipalities = getMunicipalities(form.province)
  const barangays      = getBarangays(form.municipality)

  const toggleVuln = (v) => {
    setForm(p => {
      if (v === 'None') return { ...p, vulnerabilities: ['None'] }
      const without = p.vulnerabilities.filter(x => x !== 'None')
      return { ...p, vulnerabilities: without.includes(v) ? without.filter(x => x !== v) : [...without, v] }
    })
  }

  // ── Step 0 → Step 1 ──────────────────────────────────────────────────────────
  const advanceToPin = () => {
    setError('')
    if (!form.name.trim()) { setError('Full name is required.'); return }
    const cleaned = form.contact_number.replace(/\D/g, '')
    if (cleaned.length < 10) { setError('Enter a valid Philippine mobile number (09XXXXXXXXX).'); return }
    if (!form.province || !form.municipality || !form.barangay) {
      setError('Province, Municipality, and Barangay are required.'); return
    }
    setForm(p => ({ ...p, contact_number: cleaned }))
    setStep(1)
  }

  // ── PIN pad logic ─────────────────────────────────────────────────────────────
  const activePinState = pinPhase === 'set' ? pin : confirmPin
  const setPinState    = pinPhase === 'set' ? setPin : setConfirmPin

  const tapDigit = (d) => {
    if (activePinState.length < 6) setPinState(p => p + d)
  }
  const tapBack = () => setPinState(p => p.slice(0, -1))

  // ── Step 1 → Step 2 (generate credentials) ───────────────────────────────────
  const advanceToReview = async () => {
    setError('')
    if (pinPhase === 'set') {
      if (pin.length < 6) { setError('Please enter a 6-digit PIN.'); return }
      setPinPhase('confirm')
      return
    }
    // Confirm phase
    if (confirmPin !== pin) { setError('PINs do not match. Please try again.'); setConfirmPin(''); return }

    setLoading(true)
    try {
      const deviceKey       = await getOrCreateDeviceKey()
      const salt            = generateSalt()
      const pinHash         = await hashPIN(pin, salt)
      const deviceKeyHash   = await hashDeviceKey(deviceKey)
      const vid             = generateVictimId()

      setVictimId(vid)
      setRegPayload({
        ...form,
        victim_id:        vid,
        pin,                      // raw PIN → PHP bcrypt-hashes it server-side
        pin_hash:         pinHash, // PBKDF2 hash → stored in Supabase pin_hash
        pin_salt:         salt,
        device_key_hash:  deviceKeyHash,
        _deviceKey:       deviceKey,   // kept client-side only, not sent to server
        _pinHash:         pinHash,
        _salt:            salt,
      })
      setStep(2)
    } catch (e) {
      setError('Failed to generate device credentials. Please try again.')
      console.error(e)
    }
    setLoading(false)
  }

  // ── Step 2: Activate account ──────────────────────────────────────────────────
  const activateAccount = async () => {
    setLoading(true); setError('')
    try {
      const { _deviceKey, _pinHash, _salt, ...serverPayload } = regPayload

      const res = await api.post('/auth/register', serverPayload)
      const user = res.user ?? {}

      // Store credentials locally for future offline login
      storeLocalCredentials(
        regPayload.victim_id,
        _pinHash,
        _salt,
        _deviceKey,
        { ...user, victim_id: regPayload.victim_id },
      )

      login(res.token, { ...user, victim_id: regPayload.victim_id })
      navigate('/home')
    } catch (e) {
      setError(e.error ?? e.message ?? 'Registration failed. Please try again.')
    }
    setLoading(false)
  }

  const copyVictimId = () => {
    navigator.clipboard?.writeText(victimId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              if (step === 2) { setStep(1); setPinPhase('set'); setPin(''); setConfirmPin(''); return }
              if (step === 1 && pinPhase === 'confirm') { setPinPhase('set'); setConfirmPin(''); return }
              if (step > 0) { setStep(s => s - 1); return }
              navigate('/')
            }}
            className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              <UserPlus size={18} className="text-[#8b5cf6]" />
              Create Account
            </h2>
            <p className="text-xs text-slate-500">Step {step + 1} of 3</p>
          </div>
        </div>

        {/* Step progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i <= step ? 'bg-[#8b5cf6]' : 'bg-slate-700'
            }`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── STEP 0 — Personal Details ── */}
          {step === 0 && (
            <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              <GlassCard>
                <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-3">Personal Information</p>
                <div className="space-y-3">
                  <GlassInput label="Full Name *" placeholder="Juan Dela Cruz"
                    value={form.name} onChange={(e) => f('name')(e.target.value)} />
                  <GlassInput label="Contact Number *" placeholder="09XXXXXXXXX"
                    icon={Phone} value={form.contact_number}
                    onChange={(e) => f('contact_number')(e.target.value)} />
                </div>
              </GlassCard>

              <GlassCard>
                <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-3">Location</p>
                <div className="space-y-3">
                  <GlassSelect label="Province *" value={form.province}
                    onChange={(e) => { f('province')(e.target.value); f('municipality')(''); f('barangay')('') }}>
                    <option value="">Select Province</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </GlassSelect>
                  <GlassSelect label="Municipality / City *" value={form.municipality}
                    onChange={(e) => { f('municipality')(e.target.value); f('barangay')('') }}
                    disabled={!form.province}>
                    <option value="">Select Municipality</option>
                    {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                  </GlassSelect>
                  <GlassSelect label="Barangay *" value={form.barangay}
                    onChange={(e) => f('barangay')(e.target.value)} disabled={!form.municipality}>
                    <option value="">Select Barangay</option>
                    {barangays.map(b => <option key={b} value={b}>{b}</option>)}
                  </GlassSelect>
                  <GlassInput label="Sitio / Purok (Optional)" placeholder="e.g. Purok 3"
                    value={form.sitio} onChange={(e) => f('sitio')(e.target.value)} />
                </div>
              </GlassCard>

              <GlassCard>
                <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-3">Household</p>
                <div className="space-y-3">
                  <GlassInput type="number" label="Number of Household Members" min={1} max={99}
                    value={form.household_count} onChange={(e) => f('household_count')(+e.target.value)} />
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Vulnerabilities</p>
                    <div className="flex flex-wrap gap-2">
                      {VULN_OPTIONS.map(v => (
                        <button key={v} onClick={() => toggleVuln(v)}
                          className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                            form.vulnerabilities.includes(v)
                              ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.4)] text-[#8b5cf6]'
                              : 'bg-transparent border-[rgba(255,255,255,0.1)] text-slate-400'
                          }`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <GlassTextarea label="Known Medical Conditions (Optional)"
                    placeholder="e.g. diabetes, hypertension" value={form.medical_conditions}
                    onChange={(e) => f('medical_conditions')(e.target.value)} rows={2} />
                </div>
              </GlassCard>

              <GlassCard>
                <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-3">Emergency Contact</p>
                <div className="space-y-3">
                  <GlassInput label="Contact Name" value={form.emergency_contact_name}
                    onChange={(e) => f('emergency_contact_name')(e.target.value)} />
                  <GlassSelect label="Relationship" value={form.emergency_contact_relationship}
                    onChange={(e) => f('emergency_contact_relationship')(e.target.value)}>
                    {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </GlassSelect>
                  <GlassInput label="Contact Number" value={form.emergency_contact_number}
                    onChange={(e) => f('emergency_contact_number')(e.target.value)} />
                </div>
              </GlassCard>

              {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
              <NeonButton onClick={advanceToPin} className="w-full" size="lg"
                style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }}>
                Continue <ChevronRight size={15} className="ml-1" />
              </NeonButton>

              <p className="text-center text-[11px] text-slate-500 mt-1">
                Already have an account?{' '}
                <button onClick={() => navigate('/login')} className="text-[#00d4ff] font-semibold hover:underline">
                  SIGN IN
                </button>
              </p>
            </motion.div>
          )}

          {/* ── STEP 1 — Set PIN ── */}
          {step === 1 && (
            <motion.div key="pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GlassCard className="space-y-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[rgba(139,92,246,0.15)] border border-[rgba(139,92,246,0.3)] flex items-center justify-center mx-auto mb-3">
                    <Shield size={22} className="text-[#8b5cf6]" />
                  </div>
                  <h3 className="font-bold text-white text-base">
                    {pinPhase === 'set' ? 'Set a 6-Digit PIN' : 'Confirm Your PIN'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {pinPhase === 'set'
                      ? 'You will use this PIN every time you log in.'
                      : 'Enter the same PIN again to confirm.'}
                  </p>
                </div>

                {/* PIN dots */}
                <div className="flex justify-center gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      i < activePinState.length
                        ? 'bg-[#8b5cf6] border-[#8b5cf6]'
                        : 'bg-transparent border-slate-600'
                    }`} />
                  ))}
                </div>

                {/* Numeric keypad */}
                <div className="grid grid-cols-3 gap-3">
                  {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => {
                    if (d === '') return <div key={i} />
                    const isBack = d === '⌫'
                    return (
                      <button key={d + i}
                        onClick={() => isBack ? tapBack() : tapDigit(d)}
                        className={`h-14 rounded-2xl text-xl font-semibold transition-all active:scale-95 ${
                          isBack
                            ? 'glass border border-[rgba(255,255,255,0.08)] text-slate-400'
                            : 'glass border border-[rgba(255,255,255,0.08)] text-white hover:bg-[rgba(139,92,246,0.1)] hover:border-[rgba(139,92,246,0.3)]'
                        }`}>
                        {isBack ? <Delete size={18} className="mx-auto" /> : d}
                      </button>
                    )
                  })}
                </div>

                {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}

                <NeonButton
                  onClick={advanceToReview}
                  loading={loading}
                  disabled={activePinState.length < 6}
                  className="w-full"
                  style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }}>
                  {pinPhase === 'set' ? 'Confirm PIN →' : 'Generate Victim ID →'}
                </NeonButton>

                <div className="text-center">
                  <p className="text-[11px] text-slate-600">
                    🔒 No SMS needed — your device is your verification.
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* ── STEP 2 — Review & Activate ── */}
          {step === 2 && (
            <motion.div key="activate" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              {/* Victim ID display — most important UI element */}
              <GlassCard>
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-semibold text-[#8b5cf6] uppercase tracking-widest">Your Victim ID</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl font-black text-white tracking-widest font-mono">{victimId}</span>
                    <button onClick={copyVictimId}
                      className="p-2 rounded-lg glass border border-[rgba(255,255,255,0.1)] text-slate-400 hover:text-[#8b5cf6] transition-all">
                      {copied ? <Check size={15} className="text-[#22c55e]" /> : <Copy size={15} />}
                    </button>
                  </div>
                  <div className="mt-2 px-3 py-2 rounded-lg bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.2)]">
                    <p className="text-[11px] text-[#8b5cf6] font-semibold">⚠ Save this ID — you'll need it to sign in</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Screenshot or write it down before continuing.</p>
                  </div>
                </div>
              </GlassCard>

              {/* Device status */}
              <GlassCard className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-full bg-[rgba(34,197,94,0.15)] flex items-center justify-center shrink-0">
                  <Shield size={15} className="text-[#22c55e]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Device Registered</p>
                  <p className="text-[10px] text-slate-500">This device is now your authentication key.</p>
                </div>
              </GlassCard>

              {/* Summary */}
              <GlassCard>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider">Profile Summary</p>
                  <button onClick={() => { setStep(0); setPinPhase('set'); setPin(''); setConfirmPin('') }}
                    className="text-[11px] text-slate-400 hover:text-white">Edit</button>
                </div>
                <div className="space-y-1.5">
                  <Row label="Name"     value={form.name} />
                  <Row label="Contact"  value={form.contact_number} />
                  <Row label="Province"     value={form.province} />
                  <Row label="Municipality" value={form.municipality} />
                  <Row label="Barangay" value={form.barangay} />
                  {form.sitio && <Row label="Sitio" value={form.sitio} />}
                  <Row label="Household" value={`${form.household_count} member(s)`} />
                  {form.vulnerabilities.length > 0 && (
                    <Row label="Vulnerabilities" value={form.vulnerabilities.join(', ')} />
                  )}
                  {form.emergency_contact_name && (
                    <Row label="Emergency Contact"
                      value={`${form.emergency_contact_name} (${form.emergency_contact_relationship})`} />
                  )}
                </div>
              </GlassCard>

              {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}

              <NeonButton onClick={activateAccount} loading={loading} className="w-full" size="lg"
                style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }}>
                <Check size={16} className="mr-2" />
                Activate Account
              </NeonButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 shrink-0 text-xs">{label}</span>
      <span className="text-slate-200 text-xs text-right">{value || '—'}</span>
    </div>
  )
}
