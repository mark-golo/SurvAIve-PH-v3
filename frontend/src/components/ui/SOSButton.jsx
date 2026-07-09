import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

export function SOSButton({ onTrigger, disabled = false }) {
  const [pressing, setPressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [triggered, setTriggered] = useState(false)
  const intervalRef = useRef(null)
  const HOLD_MS = 3000

  const startPress = () => {
    if (disabled || triggered) return
    setPressing(true)
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / HOLD_MS) * 100, 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(intervalRef.current)
        setPressing(false)
        setTriggered(true)
        onTrigger?.()
      }
    }, 30)
  }

  const cancelPress = () => {
    clearInterval(intervalRef.current)
    setPressing(false)
    setProgress(0)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const circumference = 2 * Math.PI * 56
  const dashOffset = circumference * (1 - progress / 100)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Outer pulse rings */}
        {!triggered && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-[rgba(239,68,68,0.2)] animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[-8px] rounded-full border border-[rgba(239,68,68,0.1)] animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
          </>
        )}

        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="4" />
          {pressing && (
            <circle
              cx="64" cy="64" r="56" fill="none"
              stroke="#ef4444" strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.03s linear' }}
            />
          )}
        </svg>

        <motion.button
          onMouseDown={startPress}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          disabled={disabled}
          className={`
            relative w-32 h-32 rounded-full font-black text-2xl tracking-widest
            flex flex-col items-center justify-center gap-1
            select-none cursor-pointer transition-all duration-200
            ${triggered
              ? 'bg-gradient-to-br from-[#ef4444] to-[#dc2626] shadow-[0_0_60px_rgba(239,68,68,0.8)] text-white'
              : 'bg-gradient-to-br from-[rgba(239,68,68,0.8)] to-[rgba(220,38,38,0.9)] shadow-[0_0_30px_rgba(239,68,68,0.5)] text-white sos-pulse'
            }
          `}
          whileTap={{ scale: 0.95 }}
          animate={triggered ? { scale: [1, 1.15, 1] } : {}}
        >
          <AlertTriangle size={28} className={triggered ? 'animate-bounce' : ''} />
          <span className="text-base font-black">SOS</span>
          {pressing && (
            <span className="text-[10px] font-medium opacity-80">
              {Math.round((progress / 100) * 3)}s…
            </span>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {pressing && (
          <motion.p
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs text-slate-400 text-center"
          >
            Hold for 3 seconds to send SOS
          </motion.p>
        )}
        {triggered && (
          <motion.p
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="text-sm font-semibold text-[#ef4444] text-center"
          >
            SOS Signal Sent!
          </motion.p>
        )}
        {!pressing && !triggered && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs text-slate-500 text-center"
          >
            Hold 3s to trigger emergency SOS
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
