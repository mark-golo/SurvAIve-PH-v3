import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Phone, Lock, ArrowLeft } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput } from '../../components/ui/GlassInput'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'

export function ProfileLogin() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const signIn = async () => {
    setError(''); setLoading(true)
    try {
      const cleaned = identifier.replace(/\D/g, '')
      if (cleaned.length < 10) { setError('Enter a valid Philippine mobile number (09XXXXXXXXX)'); setLoading(false); return }
      const res = await api.post('/auth/login', { contact_number: cleaned, password, role: 'victim' })
      login(res.token, res.user)
      navigate('/home')
    } catch (e) {
      setError(e.error ?? e.message ?? 'Incorrect phone number or password.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-white">Sign In</h2>
            <p className="text-xs text-slate-500">Enter your mobile number and password</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="space-y-4">
            <GlassInput
              label="Philippine Mobile Number"
              placeholder="09XXXXXXXXX"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              icon={Phone}
            />
            <GlassInput
              label="Password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={Lock}
            />
            {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
            <NeonButton onClick={signIn} loading={loading} className="w-full" size="lg">
              Sign In
            </NeonButton>
          </GlassCard>
        </motion.div>

        <p className="text-center text-[11px] text-slate-500 mt-4">
          Don't have an account?{' '}
          <button onClick={() => navigate('/signup')} className="text-[#8b5cf6] font-semibold tracking-wide hover:underline">
            SIGN UP
          </button>
        </p>
      </div>
    </div>
  )
}
