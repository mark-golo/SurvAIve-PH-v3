import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ArrowLeft, Check, Lock, UserPlus } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput, GlassSelect, GlassTextarea } from '../../components/ui/GlassInput'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { PROVINCES, getMunicipalities, getBarangays } from '../../lib/philippineLocations'

const STEPS = ['verify', 'profile', 'confirm']
const VULN_OPTIONS = ['Elderly (60+)', 'Person with Disability (PWD)', 'Infant (0-2 years old)', 'Pregnant', 'None']
const RELATIONSHIP_OPTIONS = ['Parent', 'Spouse', 'Sibling', 'Child', 'Neighbor', 'Other']

export function VictimSignup() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const [step, setStep] = useState(0)
  const [phone, setPhone] = useState('')
  const [contact, setContact] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [alreadyExists, setAlreadyExists] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const [form, setForm] = useState({
    name: '', province: '', municipality: '', barangay: '', sitio: '',
    household_count: 1, vulnerabilities: [], medical_conditions: '',
    emergency_contact_name: '', emergency_contact_number: '',
    emergency_contact_relationship: 'Parent',
    password: '', confirmPassword: '',
  })

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: typeof v === 'function' ? v(p[k]) : v }))

  const municipalities = getMunicipalities(form.province)
  const barangays = getBarangays(form.municipality)

  const toggleVuln = (v) => {
    setForm(p => {
      if (v === 'None') return { ...p, vulnerabilities: ['None'] }
      const without = p.vulnerabilities.filter(x => x !== 'None')
      return { ...p, vulnerabilities: without.includes(v) ? without.filter(x => x !== v) : [...without, v] }
    })
  }

  const sendOtp = async () => {
    setError(''); setAlreadyExists(false); setLoading(true)
    try {
      const cleaned = phone.replace(/\D/g, '')
      if (cleaned.length < 10) { setError('Enter a valid Philippine mobile number (09XXXXXXXXX)'); setLoading(false); return }
      await api.post('/auth/otp', { action: 'send', method: 'phone', contact: cleaned })
      setOtpSent(true)
      setCountdown(60)
    } catch (e) {
      const msg = (typeof e.error === 'string' && e.error) || (typeof e.message === 'string' && e.message) || 'Failed to send OTP. Please try again.'
      setError(msg)
    }
    setLoading(false)
  }

  const verifyOtp = async () => {
    setError(''); setLoading(true)
    try {
      const cleaned = phone.replace(/\D/g, '')
      const res = await api.post('/auth/otp', { action: 'verify', method: 'phone', contact: cleaned, otp })
      if (res.existing_user) {
        setError('This mobile number already has an account.')
        setAlreadyExists(true)
        setLoading(false)
        return
      }
      setContact(cleaned)
      setStep(1)
    } catch (e) {
      const msg = (typeof e.error === 'string' && e.error) || (typeof e.message === 'string' && e.message) || 'Invalid OTP. Please try again.'
      setError(msg)
    }
    setLoading(false)
  }

  const submitProfile = () => {
    if (!form.name || !form.province || !form.municipality || !form.barangay) {
      setError('Please fill all required fields (*)'); return
    }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    setError(''); setStep(2)
  }

  const confirmRegister = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.post('/auth/register', {
        ...form,
        contact_number: contact,
        password: form.password,
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
            onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/')}
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

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-[#8b5cf6]' : 'bg-slate-700'
            }`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── STEP 0 — OTP Verify ── */}
          {step === 0 && (
            <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GlassCard className="space-y-4">
                <p className="text-sm text-slate-300 font-medium">Enter your mobile number to get started</p>

                <GlassInput
                  label="Philippine Mobile Number"
                  placeholder="09XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  icon={Phone}
                  disabled={otpSent}
                />

                {!otpSent ? (
                  <NeonButton onClick={sendOtp} loading={loading} className="w-full"
                    style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }}>
                    Send OTP via SMS
                  </NeonButton>
                ) : (
                  <>
                    <p className="text-xs text-[#8b5cf6] text-center">OTP sent to {phone}</p>
                    <GlassInput
                      label="6-Digit OTP"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                    />
                    <NeonButton onClick={verifyOtp} loading={loading} className="w-full"
                      style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }}>
                      Verify OTP
                    </NeonButton>
                    <button
                      onClick={() => { setOtpSent(false); setOtp(''); setCountdown(0) }}
                      disabled={countdown > 0}
                      className={`w-full text-xs text-center py-1 transition-colors ${
                        countdown > 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                    </button>
                  </>
                )}

                {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}

                {alreadyExists && (
                  <p className="text-xs text-slate-400 text-center">
                    <button onClick={() => navigate('/login')} className="text-[#00d4ff] hover:underline">
                      Sign in instead →
                    </button>
                  </p>
                )}

                <p className="text-xs text-slate-500 text-center">
                  Already have an account?{' '}
                  <button onClick={() => navigate('/login')} className="text-[#00d4ff] hover:underline">
                    Sign In
                  </button>
                </p>
              </GlassCard>
            </motion.div>
          )}

          {/* ── STEP 1 — Profile + Password ── */}
          {step === 1 && (
            <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              <GlassCard>
                <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-3">Personal Information</p>
                <div className="space-y-3">
                  <GlassInput label="Full Name *" placeholder="Juan Dela Cruz" value={form.name}
                    onChange={(e) => f('name')(e.target.value)} />
                  <GlassInput label="Contact Number" value={contact} disabled icon={Phone} />
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
                <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-3">Household Information</p>
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

              <GlassCard>
                <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-3">Create Password</p>
                <div className="space-y-3">
                  <GlassInput label="Password *" type="password" placeholder="Minimum 8 characters"
                    value={form.password} onChange={(e) => f('password')(e.target.value)} icon={Lock} />
                  <GlassInput label="Confirm Password *" type="password" placeholder="Re-enter password"
                    value={form.confirmPassword} onChange={(e) => f('confirmPassword')(e.target.value)} icon={Lock} />
                  <p className="text-[11px] text-slate-500">
                    You'll use this password to sign in without needing an OTP code each time.
                  </p>
                </div>
              </GlassCard>

              {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
              <NeonButton onClick={submitProfile} className="w-full" size="lg"
                style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }}>
                Review Profile →
              </NeonButton>
            </motion.div>
          )}

          {/* ── STEP 2 — Confirm ── */}
          {step === 2 && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              <GlassCard>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider">Review Your Profile</p>
                  <button onClick={() => setStep(1)} className="text-[11px] text-slate-400 hover:text-white">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Name" value={form.name} />
                  <Row label="Contact" value={contact} />
                  <Row label="Location" value={[form.province, form.municipality, form.barangay, form.sitio].filter(Boolean).join(', ')} />
                  <Row label="Household" value={`${form.household_count} member(s)`} />
                  <Row label="Vulnerabilities" value={form.vulnerabilities.join(', ') || 'None'} />
                  <Row label="Emergency Contact" value={`${form.emergency_contact_name} (${form.emergency_contact_relationship})`} />
                  <Row label="Password" value="••••••••" />
                </div>
              </GlassCard>
              {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
              <NeonButton onClick={confirmRegister} loading={loading} className="w-full" size="lg"
                style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }}>
                <Check size={16} className="mr-2" />
                Confirm &amp; Create Account
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
