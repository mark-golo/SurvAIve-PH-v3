import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Delete, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput } from '../../components/ui/GlassInput'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { getNetworkOnline } from '../../lib/capacitor'
import {
  getOrCreateDeviceKey,
  hashDeviceKey,
  hashPIN,
  verifyLocally,
  storeLocalCredentials,
  loadLocalCredentials,
  createOfflineToken,
} from '../../lib/deviceAuth'

export function ProfileLogin() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const [victimId, setVictimId] = useState('')
  const [pin, setPin]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [savedId, setSavedId]   = useState(null) // pre-fill from local creds

  // Pre-fill Victim ID from previously stored credentials
  useEffect(() => {
    const creds = loadLocalCredentials()
    if (creds?.victimId) {
      setVictimId(creds.victimId)
      setSavedId(creds.victimId)
    }
  }, [])

  // ── PIN pad ───────────────────────────────────────────────────────────────────
  const tapDigit = (d) => { if (pin.length < 6) setPin(p => p + d) }
  const tapBack  = () => setPin(p => p.slice(0, -1))

  // ── Sign in ───────────────────────────────────────────────────────────────────
  const signIn = async () => {
    setError(''); setLoading(true)
    try {
      const cleanId = victimId.trim().toUpperCase()
      if (!cleanId.startsWith('VCT-') || cleanId.length < 8) {
        setError('Enter a valid Victim ID (e.g. VCT-AB3KZ9PQ).')
        setLoading(false); return
      }
      if (pin.length < 6) {
        setError('Enter your 6-digit PIN.')
        setLoading(false); return
      }

      const deviceKey     = await getOrCreateDeviceKey()
      const deviceKeyHash = await hashDeviceKey(deviceKey)

      // ── 1. Try offline verification first (works without network) ─────────────
      const localCreds = loadLocalCredentials()
      if (localCreds?.victimId === cleanId) {
        const ok = await verifyLocally(cleanId, pin, deviceKey)
        if (ok) {
          // Offline success — create a local session token
          const user = { ...localCreds.user, victim_id: cleanId }
          const token = createOfflineToken(user)
          storeLocalCredentials(cleanId, localCreds.pinHash, localCreds.salt, deviceKey, user)
          login(token, user)

          // Best-effort: sync victim to Supabase so SOS name/user_id link works.
          // This runs in background — we don't await it; navigation proceeds immediately.
          if (getNetworkOnline()) {
            api.post('/auth/victim-login', { victim_id: cleanId, pin, device_key_hash: deviceKeyHash })
              .catch(() => {}) // fire-and-forget
          }

          navigate('/home')
          return
        }
        // Wrong PIN or device key — fall through to online check only if online
        if (!getNetworkOnline()) {
          setError('Wrong PIN or device not recognised.')
          setLoading(false); return
        }
      }

      // ── 2. Online verification via API (Supabase or local PHP) ───────────────
      const res = await api.post('/auth/victim-login', {
        victim_id:       cleanId,
        pin,
        device_key_hash: deviceKeyHash,
      })

      const user = res.user ?? {}

      // Compute local PIN hash for future offline use
      // If the server returns pin_salt we can store it; otherwise generate one.
      const salt    = res.pin_salt ?? null
      const pinHash = salt ? await hashPIN(pin, salt) : null
      if (pinHash && salt) {
        storeLocalCredentials(cleanId, pinHash, salt, deviceKey, user)
      } else {
        // Store without PBKDF2 hash — offline login will require online re-auth
        storeLocalCredentials(cleanId, '', '', deviceKey, user)
      }

      login(res.token, { ...user, victim_id: cleanId })
      navigate('/home')

    } catch (e) {
      setError(e.error ?? e.message ?? 'Sign in failed. Check your Victim ID and PIN.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              <Shield size={18} className="text-[#00d4ff]" />
              Sign In
            </h2>
            <p className="text-xs text-slate-500">Victim ID + PIN</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Victim ID input */}
          <GlassCard>
            <div className="space-y-3">
              <GlassInput
                label="Victim ID"
                placeholder="VCT-XXXXXXXX"
                value={victimId}
                onChange={(e) => setVictimId(e.target.value.toUpperCase())}
                className="font-mono tracking-widest"
              />
              {savedId && savedId === victimId && (
                <p className="text-[10px] text-[#00d4ff] text-center">
                  ✓ Saved from this device
                </p>
              )}
            </div>
          </GlassCard>

          {/* PIN pad */}
          <GlassCard className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-300">Enter PIN</p>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  i < pin.length
                    ? 'bg-[#00d4ff] border-[#00d4ff]'
                    : 'bg-transparent border-slate-600'
                }`} />
              ))}
            </div>

            {/* Keypad */}
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
                        : 'glass border border-[rgba(255,255,255,0.08)] text-white hover:bg-[rgba(0,212,255,0.08)] hover:border-[rgba(0,212,255,0.25)]'
                    }`}>
                    {isBack ? <Delete size={18} className="mx-auto" /> : d}
                  </button>
                )
              })}
            </div>

            {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}

            <NeonButton
              onClick={signIn}
              loading={loading}
              disabled={!victimId.trim() || pin.length < 6}
              className="w-full"
              size="lg">
              Sign In
            </NeonButton>
          </GlassCard>

          {/* Help panel */}
          <div className="glass rounded-2xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <button
              onClick={() => setShowHelp(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs text-slate-400 hover:text-white transition-colors">
              <span className="flex items-center gap-2"><HelpCircle size={14} /> Help</span>
              {showHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHelp && (
              <div className="px-4 pb-4 space-y-2 text-[11px] text-slate-500">
                <p><span className="text-slate-300 font-semibold">Victim ID</span> — shown at the end of registration (format: VCT-XXXXXXXX). Save it; you need it to sign in.</p>
                <p><span className="text-slate-300 font-semibold">PIN</span> — the 6-digit number you set during sign-up.</p>
                <p><span className="text-slate-300 font-semibold">No internet needed</span> — once you sign in once, future logins work offline on this device.</p>
                <p><span className="text-slate-300 font-semibold">New device?</span> — sign in online first to register this device.</p>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-slate-500">
            Don't have an account?{' '}
            <button onClick={() => navigate('/signup')} className="text-[#8b5cf6] font-semibold tracking-wide hover:underline">
              SIGN UP
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
