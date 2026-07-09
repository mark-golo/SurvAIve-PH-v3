import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, UserX, ChevronRight, Radio, Wifi, Lock, Satellite, AlertTriangle, Shield } from 'lucide-react'
import { FeatureIcons } from '../../components/ui/OfflineIndicator'

export function LandingAuth() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-5 relative overflow-hidden">
      {/* Animated ambient orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 rounded-full bg-[radial-gradient(ellipse,rgba(0,212,255,0.12),transparent_70%)] blur-xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 rounded-full bg-[radial-gradient(ellipse,rgba(139,92,246,0.12),transparent_70%)] blur-xl pointer-events-none" />
      <div className="absolute top-[40%] right-[5%] w-48 h-48 rounded-full bg-[radial-gradient(ellipse,rgba(239,68,68,0.08),transparent_70%)] blur-xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4
                       bg-gradient-to-br from-[rgba(0,212,255,0.2)] to-[rgba(139,92,246,0.2)]
                       border border-[rgba(0,212,255,0.3)] shadow-[0_0_30px_rgba(0,212,255,0.2)]"
          >
            <AlertTriangle size={36} className="text-[#00d4ff]" />
          </motion.div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">
            Surv<span className="text-[#00d4ff]">AI</span>ve PH
          </h1>
          <p className="text-sm text-slate-400">AI-Powered Emergency Response</p>
          <div className="flex justify-center mt-3">
            <FeatureIcons />
          </div>
        </div>

        {/* Entry cards */}
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => navigate('/login')}
            className="glass-bright rounded-2xl p-5 cursor-pointer group
                       hover:border-[rgba(0,212,255,0.5)] transition-all duration-300
                       hover:shadow-[0_0_30px_rgba(0,212,255,0.2)]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(0,212,255,0.2)] to-[rgba(14,165,233,0.2)]
                              border border-[rgba(0,212,255,0.3)] flex items-center justify-center shrink-0">
                <User size={22} className="text-[#00d4ff]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Sign In with Profile</p>
                <p className="text-xs text-slate-400 mt-0.5">Verified account · Full features · Priority rescue</p>
              </div>
              <ChevronRight size={18} className="text-slate-500 group-hover:text-[#00d4ff] transition-colors" />
            </div>
            <div className="mt-3 flex gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] text-[#00d4ff]">
                ✓ Verified
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] text-[#22c55e]">
                High Trust Score
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            onClick={() => navigate('/guest')}
            className="glass rounded-2xl p-5 cursor-pointer group
                       hover:border-[rgba(245,158,11,0.4)] transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[rgba(245,158,11,0.1)]
                              border border-[rgba(245,158,11,0.2)] flex items-center justify-center shrink-0">
                <UserX size={22} className="text-[#f59e0b]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Continue as Guest</p>
                <p className="text-xs text-slate-400 mt-0.5">Send SOS anonymously · No registration needed</p>
              </div>
              <ChevronRight size={18} className="text-slate-500 group-hover:text-[#f59e0b] transition-colors" />
            </div>
            <div className="mt-3 flex gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] text-[#f59e0b]">
                ⚠ Unverified
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(107,114,128,0.1)] border border-[rgba(107,114,128,0.2)] text-[#9ca3af]">
                Lower Priority
              </span>
            </div>
          </motion.div>
        </div>

        {/* Difference tooltip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 glass rounded-xl p-3"
        >
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            <Shield size={10} className="inline mr-1 text-slate-400" />
            <span className="text-slate-400 font-medium">Profiled users</span> get higher AI rescue priority and help DRRM confirm your safety.{' '}
            <span className="text-slate-400 font-medium">Guest SOS</span> works offline but has lower trust score.
          </p>
        </motion.div>

        <p className="text-center text-[10px] text-slate-600 mt-6">
          SurvAIve PH · AI-Powered Mesh Emergency Response<br />
          Works offline via Bluetooth &amp; Wi-Fi Direct mesh
        </p>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/staff-login')}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
          >
            Responder / DRRM Officer / DOST? Staff Login →
          </button>
        </div>
      </motion.div>
    </div>
  )
}
