import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, RefreshCw, Wifi, Signal, Clock, ArrowUpDown, Home, Map, Settings, MessageSquare } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { mesh } from '../../lib/mesh'

const NAV = [
  { icon: Home, label: 'Home', path: '/home' },
  { icon: MessageSquare, label: 'SOS', path: '/sos' },
  { icon: Map, label: 'Map', path: '/map' },
  { icon: Radio, label: 'Mesh', path: '/mesh' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

function SignalBars({ level }) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={`w-1.5 rounded-sm transition-all ${
          i <= level ? 'bg-[#22c55e]' : 'bg-slate-700'
        }`} style={{ height: `${i * 25}%` }} />
      ))}
    </div>
  )
}

export function MeshStatus() {
  const [peers, setPeers] = useState(mesh.getPeers())
  const [stats, setStats] = useState(mesh.getStats())
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const refresh = async () => {
    setRefreshing(true)
    await new Promise(r => setTimeout(r, 800))
    setPeers(mesh.refresh())
    setStats(mesh.getStats())
    setLastRefresh(new Date())
    setRefreshing(false)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(mesh.getStats())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar title="Mesh Network Status" subtitle="Peer-to-peer emergency relay" onBack />

      <main className="flex-1 p-4 space-y-4">
        {/* Overall status */}
        <GlassCard glow={peers.length > 0} className="text-center py-5">
          <motion.div
            animate={peers.length > 0 ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 ${
              peers.length > 0
                ? 'bg-[rgba(34,197,94,0.2)] border-2 border-[rgba(34,197,94,0.4)] shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                : 'bg-[rgba(107,114,128,0.2)] border-2 border-[rgba(107,114,128,0.3)]'
            }`}
          >
            <Radio size={28} className={peers.length > 0 ? 'text-[#22c55e]' : 'text-slate-500'} />
          </motion.div>
          <p className={`font-bold text-lg ${peers.length > 0 ? 'text-[#22c55e]' : 'text-slate-400'}`}>
            {peers.length > 0 ? `Mesh Connected` : 'No Peers Found'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {peers.length > 0
              ? `${peers.length} device(s) in range · Relay active`
              : 'Broadcasting beacon… waiting for nearby devices'}
          </p>
        </GlassCard>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-lg font-black text-[#00d4ff]">{stats.peersConnected}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Peers</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-lg font-black text-[#8b5cf6]">{stats.messagesForwarded}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Forwarded</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-lg font-black text-[#22c55e]">{stats.dataRelayed}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Data</p>
          </div>
        </div>

        {/* Peer list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Connected Peers</p>
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Clock size={10} />
              {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {peers.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="glass rounded-xl p-4 text-center"
                >
                  <p className="text-sm text-slate-500">No devices in range</p>
                  <p className="text-xs text-slate-600 mt-1">Ensure Bluetooth and Wi-Fi are enabled</p>
                </motion.div>
              ) : (
                peers.map((peer, i) => (
                  <motion.div
                    key={peer.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="glass rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center shrink-0">
                      <Wifi size={16} className="text-[#00d4ff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{peer.id}</p>
                      <p className="text-xs text-slate-500">{peer.forwarded} messages relayed · {peer.lastSeen}</p>
                    </div>
                    <SignalBars level={peer.signal} />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Last sync */}
        <div className="glass rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpDown size={14} className="text-slate-400" />
            <div>
              <p className="text-xs font-medium text-white">Last Sync</p>
              <p className="text-xs text-slate-500">{stats.lastSync}</p>
            </div>
          </div>
          <NeonButton size="sm" variant="ghost" onClick={refresh} loading={refreshing}>
            <RefreshCw size={12} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </NeonButton>
        </div>

        {/* Info card */}
        <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.15)]">
          <p className="text-[11px] text-[#00d4ff] font-semibold mb-1">How Mesh Works</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Each phone acts as a relay node. Your SOS hops from device to device until it reaches a responder or internet connection — even without cellular signal.
          </p>
        </div>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
