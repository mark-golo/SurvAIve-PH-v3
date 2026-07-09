import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, ArrowLeft, Check, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput, GlassSelect, GlassTextarea } from '../../components/ui/GlassInput'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { PROVINCES, getMunicipalities, getBarangays } from '../../lib/philippineLocations'

const STEPS = ['credential', 'profile', 'confirm']
const VULN_OPTIONS = ['Elderly (60+)', 'Person with Disability (PWD)', 'Infant (0-2 years old)', 'Pregnant', 'None']
const RELATIONSHIP_OPTIONS = ['Parent', 'Spouse', 'Sibling', 'Child', 'Neighbor', 'Other']

export function ProfileLogin() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const [step, setStep] = useState(0)
  const [method, setMethod] = useState(null) // 'sms' | 'google'
  const [contact, setContact] = useState('')
  const [otp, setOtp] = useState('')
  const [demoOtp, setDemoOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', province: '', municipality: '', barangay: '', sitio: '',
    household_count: 1, vulnerabilities: [], medical_conditions: '',
    emergency_contact_name: '', emergency_contact_number: '', emergency_contact_relationship: 'Parent',
    pin: '',
  })

  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: typeof v === 'function' ? v(p[k]) : v }))

  const municipalities = getMunicipalities(form.province)
  const barangays = getBarangays(form.municipality)

  const toggleVuln = (v) => {
    setForm((p) => {
      if (v === 'None') return { ...p, vulnerabilities: ['None'] }
      const without = p.vulnerabilities.filter((x) => x !== 'None')
      return { ...p, vulnerabilities: without.includes(v) ? without.filter((x) => x !== v) : [...without, v] }
    })
  }

  const sendOtp = async () => {
    setError(''); setLoading(true)
    try {
      const cleaned = contact.replace(/\D/g, '')
      const res = await api.post('/auth/otp', { action: 'send', contact: cleaned })
      setDemoOtp(res.demo_otp ?? '')
      setOtpSent(true)
    } catch (e) { setError(e.error ?? 'Failed to send OTP') }
    setLoading(false)
  }

  const verifyOtp = async () => {
    setError(''); setLoading(true)
    try {
      const cleaned = contact.replace(/\D/g, '')
      const res = await api.post('/auth/otp', { action: 'verify', contact: cleaned, otp })
      if (res.existing_user) {
        login(res.token, res.user)
        navigate('/home')
      } else {
        setStep(1)
      }
    } catch (e) { setError(e.error ?? 'Invalid OTP') }
    setLoading(false)
  }

  const submitProfile = () => {
    if (!form.name || !form.province || !form.municipality || !form.barangay) {
      setError('Please fill all required fields'); return
    }
    setError(''); setStep(2)
  }

  const confirmRegister = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.post('/auth/register', {
        ...form, contact_number: contact.replace(/\D/g, ''),
      })
      login(res.token, res.user)
      navigate('/home')
    } catch (e) { setError(e.error ?? 'Registration failed') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/')}
            className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-white">Sign In with Profile</h2>
            <p className="text-xs text-slate-500">Step {step + 1} of 3</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-[#00d4ff]' : 'bg-slate-700'
            }`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 0 – Credential */}
          {step === 0 && (
            <motion.div key="cred" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GlassCard className="space-y-4">
                <p className="text-sm text-slate-300 font-medium">Choose how to verify your identity</p>

                {/* SMS method */}
                <div className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  method === 'sms' ? 'border-[rgba(0,212,255,0.5)] bg-[rgba(0,212,255,0.05)]' : 'border-[rgba(255,255,255,0.08)]'
                }`} onClick={() => setMethod('sms')}>
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-[#00d4ff]" />
                    <div>
                      <p className="text-sm font-medium text-white">Mobile Number + OTP</p>
                      <p className="text-xs text-slate-500">Receive a 6-digit code via SMS</p>
                    </div>
                    {method === 'sms' && <Check size={16} className="text-[#00d4ff] ml-auto" />}
                  </div>
                </div>

                {method === 'sms' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                    <GlassInput
                      label="Philippine Mobile Number"
                      placeholder="+63 or 09XXXXXXXXX"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      icon={Phone}
                      disabled={otpSent}
                    />
                    {!otpSent ? (
                      <NeonButton onClick={sendOtp} loading={loading} className="w-full">Send OTP</NeonButton>
                    ) : (
                      <>
                        {demoOtp && <p className="text-xs text-[#f59e0b] text-center">Demo OTP: <strong>{demoOtp}</strong></p>}
                        <GlassInput label="6-Digit OTP" placeholder="000000" value={otp}
                          onChange={(e) => setOtp(e.target.value)} maxLength={6} />
                        <NeonButton onClick={verifyOtp} loading={loading} className="w-full">Verify OTP</NeonButton>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Google method (simulated) */}
                <div className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  method === 'google' ? 'border-[rgba(0,212,255,0.5)] bg-[rgba(0,212,255,0.05)]' : 'border-[rgba(255,255,255,0.08)]'
                }`} onClick={() => { setMethod('google'); setStep(1) }}>
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-[#f97316]" />
                    <div>
                      <p className="text-sm font-medium text-white">Continue with Google</p>
                      <p className="text-xs text-slate-500">Sign in using your Gmail account</p>
                    </div>
                    {method === 'google' && <Check size={16} className="text-[#00d4ff] ml-auto" />}
                  </div>
                </div>

                {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
              </GlassCard>
            </motion.div>
          )}

          {/* STEP 1 – Profile form */}
          {step === 1 && (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              <GlassCard>
                <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Personal Information</p>
                <div className="space-y-3">
                  <GlassInput label="Full Name *" placeholder="Juan Dela Cruz" value={form.name}
                    onChange={(e) => f('name')(e.target.value)} />
                  <GlassInput label="Contact Number" value={contact} disabled />
                </div>
              </GlassCard>

              <GlassCard>
                <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Location</p>
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
                <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Household Information</p>
                <div className="space-y-3">
                  <GlassInput type="number" label="Household Members Count" min={1} max={99}
                    value={form.household_count} onChange={(e) => f('household_count')(+e.target.value)} />
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Vulnerabilities</p>
                    <div className="flex flex-wrap gap-2">
                      {VULN_OPTIONS.map(v => (
                        <button key={v} onClick={() => toggleVuln(v)}
                          className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                            form.vulnerabilities.includes(v)
                              ? 'bg-[rgba(0,212,255,0.15)] border-[rgba(0,212,255,0.4)] text-[#00d4ff]'
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
                <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Emergency Contact</p>
                <div className="space-y-3">
                  <GlassInput label="Contact Name *" value={form.emergency_contact_name}
                    onChange={(e) => f('emergency_contact_name')(e.target.value)} />
                  <GlassSelect label="Relationship" value={form.emergency_contact_relationship}
                    onChange={(e) => f('emergency_contact_relationship')(e.target.value)}>
                    {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </GlassSelect>
                  <GlassInput label="Contact Number *" value={form.emergency_contact_number}
                    onChange={(e) => f('emergency_contact_number')(e.target.value)} />
                  <GlassInput type="password" label="4-Digit Offline PIN"
                    placeholder="For offline access" maxLength={4}
                    value={form.pin} onChange={(e) => f('pin')(e.target.value)} />
                </div>
              </GlassCard>

              {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
              <NeonButton onClick={submitProfile} className="w-full" size="lg">Review Profile →</NeonButton>
            </motion.div>
          )}

          {/* STEP 2 – Confirm */}
          {step === 2 && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              <GlassCard>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">Review Your Profile</p>
                  <button onClick={() => setStep(1)} className="text-[11px] text-slate-400 hover:text-white">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Name" value={form.name} />
                  <Row label="Contact" value={contact} />
                  <Row label="Location" value={[form.province, form.municipality, form.barangay, form.sitio].filter(Boolean).join(', ')} />
                  <Row label="Household" value={`${form.household_count} member(s)`} />
                  <Row label="Vulnerabilities" value={form.vulnerabilities.join(', ') || 'None'} />
                  <Row label="Emergency Contact" value={`${form.emergency_contact_name} (${form.emergency_contact_relationship})`} />
                </div>
              </GlassCard>
              {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
              <NeonButton onClick={confirmRegister} loading={loading} className="w-full" size="lg">
                Confirm &amp; Save Profile
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
