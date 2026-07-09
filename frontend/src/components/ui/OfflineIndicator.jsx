import { Wifi, WifiOff, Radio, Lock, Satellite } from 'lucide-react'

export function OfflineIndicator({ meshConnected = false, peerCount = 0, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-[rgba(255,255,255,0.08)] ${className}`}>
      {meshConnected ? (
        <>
          <Radio size={12} className="text-[#22c55e] animate-pulse" />
          <span className="text-[11px] font-medium text-[#22c55e]">Mesh ({peerCount})</span>
        </>
      ) : (
        <>
          <WifiOff size={12} className="text-[#9ca3af]" />
          <span className="text-[11px] font-medium text-[#9ca3af]">Offline</span>
        </>
      )}
    </div>
  )
}

export function FeatureIcons() {
  return (
    <div className="flex items-center gap-3 text-slate-500">
      <span title="Offline-first" className="flex items-center gap-1 text-[10px]">
        <WifiOff size={11} /> Offline-First
      </span>
      <span title="Mesh networking" className="flex items-center gap-1 text-[10px]">
        <Radio size={11} /> Mesh Network
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
