import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Phone, Lock, Eye, EyeOff, Shield, ChevronRight,
         Radio, Building2, Globe, MapPin } from 'lucide-react'
import { GlassInput, GlassSelect } from '../components/ui/GlassInput'
import { NeonButton } from '../components/ui/NeonButton'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'
import { PROVINCES, getMunicipalities } from '../lib/philippineLocations'

const ROLES = [
  {
    key:   'responder',
    label: 'Field Responder',
    sub:   'Rescue operations · Field deployment · Victim queue',
    icon:  Radio,
    color: '#22c55e',
    bg:    'rgba(34,197,94,0.1)',
    border:'rgba(34,197,94,0.25)',
    glow:  'rgba(34,197,94,0.15)',
    needsMunicipality: true,
  },
  {
    key:   'admin',
    label: 'Admin — Municipality Level',
    sub:   'DRRM command · Victim registry · Resource coordination',
    icon:  Building2,
    color: '#8b5cf6',
    bg:    'rgba(139,92,246,0.1)',
    border:'rgba(139,92,246,0.25)',
    glow:  'rgba(139,92,246,0.15)',
    needsMunicipality: true,
  },
  {
    key:   'superadmin',
    label: 'Super Admin — Provincial Level',
    sub:   'Provincial oversight · Escalation feed · Analytics',
    icon:  Globe,
    color: '#f97316',
    bg:    'rgba(249,115,22,0.1)',
    border:'rgba(249,115,22,0.25)',
    glow:  'rgba(249,115,22,0.15)',
    needsMunicipality: false,
  },
]

const ROLE_PATHS = {
  responder:  '/responder',
  admin:      '/admin',
  superadmin: '/superadmin',
  victim:     '/home',
}

const slide = (dir) => ({
  initial:   { opacity: 0, x: dir * 40 },
  animate:   { opacity: 1, x: 0 },
  exit:      { opacity: 0, x: dir * -40 },
  transition:{ duration: 0.28, ease: 'easeInOut' },
})

export function StaffLogin() {
  const navigate = useNavigate()
  const { login }  = useAuthStore()
  const [step, setStep]             = useState(0)
  const [direction, setDirection]   = useState(1)
  const [selectedRole, setSelected] = useState(null)

  // Location scope
  const [province, setProvince]       = useState('')
  const [municipality, setMunicipality] = useState('')
  const municipalities = province ? getMunicipalities(province) : []

  // Credentials
  const [contact, setContact]   = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const pickRole = (r) => {
    setSelected(r)
    setProvince('')
    setMunicipality('')
    setDirection(1)
    setStep(1)
  }

  const goBack = () => {
    if (step === 0) { navigate('/'); return }
    setDirection(-1)
    setStep(0)
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!contact || !password) { setError('Please fill in all fields'); return }
    if (!province) { setError('Please select your province'); return }
    if (selectedRole?.needsMunicipality && !municipality) {
      setError('Please select your municipality'); return
    }
    setError(''); setLoading(true)
    try {
      const res = await api.post('/auth/login', {
        contact_number: contact.replace(/\D/g, ''),
        password,
      })
      const scope = {
        province,
        municipality: selectedRole?.needsMunicipality ? municipality : null,
      }
      login(res.token, res.user, scope)
      navigate(ROLE_PATHS[res.user.role] ?? '/')
    } catch (err) {
      setError(err?.error ?? 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 rounded-full
                      bg-[radial-gradient(ellipse,rgba(139,92,246,0.12),transparent_70%)]
                      blur-xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 rounded-full
                      bg-[radial-gradient(ellipse,rgba(249,115,22,0.10),transparent_70%)]
                      blur-xl pointer-events-none" />

      <div className="w-full max-w-sm overflow-hidden">
        {/* Back button */}
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          {step === 0 ? 'Back' : 'Change Role'}
        </button>

        <AnimatePresence mode="wait" initial={false}>
          {/* ── Step 0: Role Selection ── */}
          {step === 0 && (
            <motion.div key="role-select" {...slide(direction)}>
              <div className="text-center mb-7">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4
                                bg-gradient-to-br from-[rgba(139,92,246,0.2)] to-[rgba(249,115,22,0.2)]
                                border border-[rgba(139,92,246,0.3)]
                                shadow-[0_0_24px_rgba(139,92,246,0.2)]">
                  <Shield size={28} className="text-[#8b5cf6]" />
                </div>
                <h1 className="text-2xl font-black text-white mb-1">
                  Surv<span className="text-[#00d4ff]">AI</span>ve PH
                </h1>
                <p className="text-sm text-slate-400">Select Your Role to Continue</p>
              </div>

              <div className="space-y-3">
                {ROLES.map((r) => {
                  const Icon = r.icon
                  return (
                    <motion.button
                      key={r.key}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => pickRole(r)}
                      className="w-full glass-bright rounded-2xl p-4 flex items-center gap-4
                                 cursor-pointer text-left transition-all duration-300 group
                                 border border-[rgba(255,255,255,0.08)]"
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = r.border
                        e.currentTarget.style.boxShadow = `0 0 20px ${r.glow}`
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                        e.currentTarget.style.boxShadow = ''
                      }}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                           style={{ background: r.bg, border: `1px solid ${r.border}` }}>
                        <Icon size={22} style={{ color: r.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white">{r.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{r.sub}</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-500 group-hover:text-white transition-colors shrink-0" />
                    </motion.button>
                  )
                })}
              </div>

              <p className="text-center text-[10px] text-slate-600 mt-6">
                SurvAIve PH · Authorized Personnel Only
              </p>
            </motion.div>
          )}

          {/* ── Step 1: Location + Credentials ── */}
          {step === 1 && selectedRole && (
            <motion.div key="credentials" {...slide(direction)}>
              {/* Role chip header */}
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                     style={{ background: selectedRole.bg, border: `1px solid ${selectedRole.border}`,
                              boxShadow: `0 0 20px ${selectedRole.glow}` }}>
                  <selectedRole.icon size={24} style={{ color: selectedRole.color }} />
                </div>
                <h2 className="text-xl font-black text-white mb-1">Sign In</h2>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1
                                 rounded-full border"
                      style={{ color: selectedRole.color, background: selectedRole.bg,
                               borderColor: selectedRole.border }}>
                  <selectedRole.icon size={11} />
                  {selectedRole.label}
                </span>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="glass-bright rounded-2xl p-5 space-y-4">

                  {/* Location Section */}
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                      <MapPin size={11} />
                      {selectedRole.needsMunicipality ? 'Your Jurisdiction' : 'Your Province'}
                    </p>
                    <div className="space-y-3">
                      <GlassSelect
                        value={province}
                        onChange={e => { setProvince(e.target.value); setMunicipality('') }}
                      >
                        <option value="">Select Province</option>
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </GlassSelect>

                      {selectedRole.needsMunicipality && (
                        <GlassSelect
                          value={municipality}
                          onChange={e => setMunicipality(e.target.value)}
                          disabled={!province}
                        >
                          <option value="">Select Municipality</option>
                          {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                        </GlassSelect>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/5" />

                  {/* Credentials */}
                  <GlassInput
                    label="Contact Number"
                    placeholder="09XXXXXXXXX"
                    icon={Phone}
                    value={contact}
                    onChange={e => setContact(e.target.value)}
                    inputMode="tel"
                  />
                  <div className="relative">
                    <GlassInput
                      label="Password"
                      placeholder="Enter your password"
                      icon={Lock}
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-[34px] text-slate-400 hover:text-white transition-colors"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {error && (
                    <p className="text-[#ef4444] text-xs bg-[rgba(239,68,68,0.1)]
                                  border border-[rgba(239,68,68,0.2)] rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                </div>

                <NeonButton type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </NeonButton>
              </form>

              <div className="mt-4 glass rounded-xl p-3">
                <p className="text-[11px] text-slate-500 text-center">
                  Contact your supervisor if you don't have credentials.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
