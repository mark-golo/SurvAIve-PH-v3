import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { List, Map, Radio, Settings, RefreshCw, SortAsc } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { PriorityCard } from '../../components/ui/PriorityCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { db } from '../../lib/db'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

const NAV = [
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Relay',    path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

export function VictimQueue() {
  const { scope } = useAuthStore()
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')

  const muni = scope?.municipality
  useEffect(() => { refresh() }, [])
  const refresh = async () => {
    setLoading(true)
    try {
      const url = muni
        ? `/sos?assigned_to=me&municipality=${encodeURIComponent(muni)}`
        : '/sos?assigned_to=me'
      const res = await api.get(url)
      setQueue(res)
    } catch { setQueue([]) }
    setLoading(false)
  }

  const filtered = filter === 'all' ? queue : queue.filter(r => r.priority === filter.toUpperCase())

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar
        title="Victim Queue"
        subtitle={`${queue.filter(r => r.priority === 'CRITICAL').length} critical · ${queue.length} total`}
        onBack
        rightSlot={
          <NeonButton size="sm" variant="ghost" onClick={refresh} loading={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </NeonButton>
        }
      />

      {/* Filter chips */}
      <div className="px-4 py-2 flex gap-2">
        {['all', 'critical', 'high', 'moderate'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all capitalize ${
              filter === f
                ? 'bg-[rgba(0,212,255,0.15)] border-[rgba(0,212,255,0.5)] text-[#00d4ff]'
                : 'glass border-[rgba(255,255,255,0.08)] text-slate-400'
            }`}>{f}</button>
        ))}
      </div>

      <main className="flex-1 px-4 pb-4 space-y-2">
        <AnimatePresence>
          {filtered.map((report, i) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <PriorityCard
                report={report}
                navigateTo={`/responder/rescue/${report.id}`}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-slate-500 text-sm">No victims in this filter</p>
          </div>
        )}
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
