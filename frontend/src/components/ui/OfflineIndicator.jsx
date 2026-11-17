import { WifiOff, Lock, Satellite, Sparkles } from 'lucide-react'

export function FeatureIcons() {
  return (
    <div className="flex items-center gap-3 text-slate-500">
      <span title="Offline-first" className="flex items-center gap-1 text-[10px]">
        <WifiOff size={11} /> Offline-First
      </span>
      <span title="AI assistant" className="flex items-center gap-1 text-[10px]">
        <Sparkles size={11} /> AI Assistant
      </span>
      <span title="GPS enabled" className="flex items-center gap-1 text-[10px]">
        <Satellite size={11} /> GPS
      </span>
      <span title="Secure comms" className="flex items-center gap-1 text-[10px]">
        <Lock size={11} /> Encrypted
      </span>
    </div>
  )
}
