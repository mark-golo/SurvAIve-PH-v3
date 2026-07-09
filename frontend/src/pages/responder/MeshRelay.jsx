import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Radio, Wifi, ArrowUpDown, Battery, AlertTriangle, List, Map, Settings } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { mesh } from '../../lib/mesh'

const NAV = [
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Relay',    path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

export function MeshRelay() {
  const [relayOn, setRelayOn] = useState(true)
  const [peers, setPeers] = useState(mesh.getPeers())
  const [stats, setStats] = useState(mesh.getStats())

  useEffect(() => {
    const interval = setInterval(() => setStats(mesh.getStats()), 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar title="Mesh Relay Node" subtitle="Responder relay status" onBack />

      <main className="flex-1 p-4 space-y-4">
        {/* Node visualization */}
        <GlassCard className="text-center py-6">
          <div className="relative inline-flex items-center justify-center">
            {/* Concentric rings */}
            {relayOn && [1, 2, 3].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-[rgba(34,197,94,0.3)]"
                style={{ width: `${60 + i * 36}px`, height: `${60 + i * 36}px` }}
                animate={{ opacity: [0.6, 0.1, 0.6], scale: [1, 1.05, 1] }}
                transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
              />
            ))}
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
              relayOn
                ? 'bg-[rgba(34,197,94,0.2)] border-2 border-[rgba(34,197,94,0.5)] shadow-[0_0_30px_rgba(34,197,94,0.4)]'
                : 'bg-[rgba(107,114,128,0.2)] border-2 border-[rgba(107,114,128,0.3)]'
            }`}>
              <Radio size={28} className={relayOn ? 'text-[#22c55e]' : 'text-slate-500'} />
            </div>
          </div>

          <div className="mt-6">
            <p className={`text-lg font-bold ${relayOn ? 'text-[#22c55e]' : 'text-slate-400'}`}>
              {relayOn ? 'Active Relay Mode' : 'Relay Off'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {relayOn ? 'Forwarding emergency messages from nearby devices' : 'Not relaying mesh traffic'}
            </p>
          </div>

          <div className="mt-4">
            <NeonButton
              variant={relayOn ? 'ghost' : 'green'}
              onClick={() => setRelayOn(v => !v)}
              size="sm"
            >
              {relayOn ? 'Disable Relay' : 'Enable Relay'}
            </NeonButton>
          </div>
        </GlassCard>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-[#22c55e]">{stats.peersConnected}</p>
            <p className="text-[10px] text-slate-500 uppercase mt-0.5">Peers Connected</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-[#00d4ff]">{stats.messagesForwarded}</p>
            <p className="text-[10px] text-slate-500 uppercase mt-0.5">Messages Forwarded</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-[#8b5cf6]">{stats.dataRelayed}</p>
            <p className="text-[10px] text-slate-500 uppercase mt-0.5">Data Relayed</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-[#f59e0b]">{stats.lastSync}</p>
            <p className="text-[10px] text-slate-500 uppercase mt-0.5">Last Sync</p>
          </div>
        </div>

        {/* Peer list */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Connected Peers</p>
          {peers.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No peers in range</p>
          ) : (
            <div className="space-y-2">
              {peers.map(peer => (
                <div key={peer.id} className="flex items-center gap-3 py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                  <Wifi size={14} className="text-[#00d4ff] shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white">{peer.id}</p>
                    <p className="text-[10px] text-slate-500">{peer.forwarded} relayed · {peer.lastSeen}</p>
                  </div>
                  <div className="flex gap-0.5 items-end h-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`w-1.5 rounded-sm ${i <= peer.signal ? 'bg-[#22c55e]' : 'bg-slate-700'}`}
                        style={{ height: `${i * 25}%` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Battery warning */}
        {relayOn && (
          <div className="glass rounded-xl p-3 border border-[rgba(245,158,11,0.3)] flex items-start gap-2">
            <Battery size={14} className="text-[#f59e0b] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">
              Active relay mode increases battery consumption. Consider charging your device or enabling Battery Saver mode.
            </p>
          </div>
        )}
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
