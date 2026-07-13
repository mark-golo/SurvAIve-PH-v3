import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, ArrowLeft, Check } from 'lucide-react'
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
  const [method, setMethod] = useState(null)    // 'phone' | 'email'
  const [identifier, setIdentifier] = useState('') // raw phone or email typed in Step 0
  const [contact, setContact] = useState('')       // phone number used for DB (pre-filled or user-entered)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', province: '', municipality: '', barangay: '', sitio: '',
    household_count: 1, vulnerabilities: [], medical_conditions: '',
    emergency_contact_name: '', emergency_contact_number: '', emergency_contact_relationship: 'Parent',
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

  const switchMethod = (m) => {
    setMethod(m)
    setIdentifier('')
    setOtp('')
    setOtpSent(false)
    setError('')
  }

  const sendOtp = async () => {
    setError(''); setLoading(true)
    try {
      if (method === 'phone') {
        const cleaned = identifier.replace(/\D/g, '')
        if (cleaned.length < 10) { setError('Enter a valid Philippine mobile number (09XXXXXXXXX)'); setLoading(false); return }
        await api.post('/auth/otp', { action: 'send', method: 'phone', contact: cleaned })
      } else {
        if (!identifier.includes('@')) { setError('Enter a valid email address'); setLoading(false); return }
        await api.post('/auth/otp', { action: 'send', method: 'email', email: identifier })
      }
      setOtpSent(true)
    } catch (e) { setError(e.error ?? e.message ?? 'Failed to send OTP') }
    setLoading(false)
  }

  const verifyOtp = async () => {
    setError(''); setLoading(true)
    try {
      const payload = method === 'phone'
        ? { action: 'verify', method: 'phone', contact: identifier.replace(/\D/g, ''), otp }
        : { action: 'verify', method: 'email', email: identifier, otp }
      const res = await api.post('/auth/otp', payload)
      if (res.existing_user) {
        login(res.token, res.user)
        navigate('/home')
      } else {
        if (method === 'phone') setContact(identifier.replace(/\D/g, ''))
        setStep(1)
      }
    } catch (e) { setError(e.error ?? e.message ?? 'Invalid OTP') }
    setLoading(false)
  }

  const submitProfile = () => {
    if (!form.name || !form.province || !form.municipality || !form.barangay) {
      setError('Please fill all required fields (*)'); return
    }
    if (method === 'email') {
      const cleaned = contact.replace(/\D/g, '')
      if (cleaned.length < 10) { setError('Enter a valid Philippine mobile number'); return }
    }
    setError(''); setStep(2)
  }

  const confirmRegister = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.post('/auth/register', {
        ...form,
        contact_number: contact.replace(/\D/g, ''),
      })
      login(res.token, res.user)
      navigate('/home')
    } catch (e) { setError(e.error ?? e.message ?? 'Registration failed. Please try again.') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => step > 0 ? setStep((s) => s - 1) : navigate('/')}
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
          {/* ── STEP 0 — Method chooser ── */}
          {step === 0 && (
            <motion.div key="cred" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GlassCard className="space-y-4">
                <p className="text-sm text-slate-300 font-medium">Choose how to verify your identity</p>

                {/* Phone method */}
                <div
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${
                    method === 'phone' ? 'border-[rgba(0,212,255,0.5)] bg-[rgba(0,212,255,0.05)]' : 'border-[rgba(255,255,255,0.08)]'
                  }`}
                  onClick={() => switchMethod('phone')}
                >
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-[#00d4ff]" />
                    <div>
                      <p className="text-sm font-medium text-white">Mobile Number + OTP</p>
                      <p className="text-xs text-slate-500">Receive a 6-digit code via SMS</p>
                    </div>
                    {method === 'phone' && <Check size={16} className="text-[#00d4ff] ml-auto" />}
                  </div>
                </div>

                {method === 'phone' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                    <GlassInput
                      label="Philippine Mobile Number"
                      placeholder="09XXXXXXXXX"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      icon={Phone}
                      disabled={otpSent}
                    />
                    {!otpSent ? (
                      <NeonButton onClick={sendOtp} loading={loading} className="w-full">Send OTP via SMS</NeonButton>
                    ) : (
                      <>
                        <p className="text-xs text-[#00d4ff] text-center">OTP sent to {identifier}</p>
                        <GlassInput
                          label="6-Digit OTP"
                          placeholder="000000"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          maxLength={6}
                        />
                        <NeonButton onClick={verifyOtp} loading={loading} className="w-full">Verify OTP</NeonButton>
                        <button
                          onClick={() => { setOtpSent(false); setOtp('') }}
                          className="w-full text-xs text-slate-400 hover:text-white text-center py-1"
                        >
                          Resend OTP
                        </button>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Email method */}
                <div
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${
                    method === 'email' ? 'border-[rgba(0,212,255,0.5)] bg-[rgba(0,212,255,0.05)]' : 'border-[rgba(255,255,255,0.08)]'
                  }`}
                  onClick={() => switchMethod('email')}
                >
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-[#f97316]" />
                    <div>
                      <p className="text-sm font-medium text-white">Email Address + OTP</p>
                      <p className="text-xs text-slate-500">Receive a 6-digit code via email</p>
                    </div>
                    {method === 'email' && <Check size={16} className="text-[#00d4ff] ml-auto" />}
                  </div>
                </div>

                {method === 'email' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                    <GlassInput
                      label="Email Address"
                      placeholder="you@example.com"
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      icon={Mail}
                      disabled={otpSent}
                    />
                    {!otpSent ? (
                      <NeonButton onClick={sendOtp} loading={loading} className="w-full">Send OTP via Email</NeonButton>
                    ) : (
                      <>
                        <p className="text-xs text-[#00d4ff] text-center">OTP sent to {identifier}</p>
                        <GlassInput
                          label="6-Digit OTP"
                          placeholder="000000"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          maxLength={6}
                        />
                        <NeonButton onClick={verifyOtp} loading={loading} className="w-full">Verify OTP</NeonButton>
                        <button
                          onClick={() => { setOtpSent(false); setOtp('') }}
                          className="w-full text-xs text-slate-400 hover:text-white text-center py-1"
                        >
                          Resend OTP
                        </button>
                      </>
                    )}
                  </motion.div>
                )}

                {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
              </GlassCard>
            </motion.div>
          )}

          {/* ── STEP 1 — Profile form ── */}
          {step === 1 && (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              <GlassCard>
                <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Personal Information</p>
                <div className="space-y-3">
                  <GlassInput label="Full Name *" placeholder="Juan Dela Cruz" value={form.name}
                    onChange={(e) => f('name')(e.target.value)} />
                  {method === 'phone' ? (
                    <GlassInput label="Contact Number" value={identifier} disabled />
                  ) : (
                    <>
                      <GlassInput label="Philippine Mobile Number *" placeholder="09XXXXXXXXX"
                        value={contact} onChange={(e) => setContact(e.target.value)} icon={Phone} />
                      <GlassInput label="Email" value={identifier} disabled />
                    </>
                  )}
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
                </div>
              </GlassCard>

              {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
              <NeonButton onClick={submitProfile} className="w-full" size="lg">Review Profile →</NeonButton>
            </motion.div>
          )}

          {/* ── STEP 2 — Confirm ── */}
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
                  <Row label="Verified via" value={identifier} />
                  <Row label="Contact" value={method === 'phone' ? identifier : contact} />
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
