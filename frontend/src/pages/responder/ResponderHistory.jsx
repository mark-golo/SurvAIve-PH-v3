import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, WifiOff, Home, List, Map, Radio, Settings, RefreshCw } from 'lucide-react'
import { MobileNavBar, TopBar } from '../../components/ui/NavBar'
import { PriorityCard } from '../../components/ui/PriorityCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { getResponderTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import { supabase } from '../../lib/supabase'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Mesh',     path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

function priorityLabel(score) {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MODERATE'
  return 'LOW'
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ResponderHistory() {
  const navigate   = useNavigate()
  const [isLight]  = useState(() => getResponderTheme() === 'light')
  const [isOnline] = useState(getNetworkOnline)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter]   = useState('all')
  const [reloadKey, setReloadKey] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) { setReports([]); return }

      const { data: responderRow } = await supabase
        .from('responders')
        .select('id')
        .eq('contact_number', contact)
        .single()

      if (!responderRow?.id) { setReports([]); return }

      const { data, error } = await supabase
        .from('sos_reports')
        .select('*')
        .eq('assigned_responder_id', responderRow.id)
        .eq('rescue_status', 'rescued')
        .order('confirmed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error) {
        const enriched = (data ?? []).map(r => ({
          ...r,
          priority: priorityLabel(r.ai_priority_score ?? 50),
          time_ago: fmtDate(r.confirmed_at ?? r.created_at),
        }))
        setReports(enriched)
      }
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOnline) load()
  }, [isOnline, reloadKey])

  useEffect(() => {
    if (!isOnline) return
    const poll = setInterval(() => setReloadKey(k => k + 1), 30_000)
    return () => clearInterval(poll)
  }, [isOnline])

  const filtered = filter === 'all'
    ? reports
    : reports.filter(r => r.priority === filter.toUpperCase())

  return (
    <div className={`min-h-screen bg-mesh flex flex-col pb-nav${isLight ? ' light-theme' : ''}`}>
      <TopBar
        title="Victim Queue"
        subtitle={`${reports.length} total`}
        onBack
        rightSlot={
          <NeonButton size="sm" variant="ghost" onClick={load} loading={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </NeonButton>
        }
      />

      {/* Section switcher */}
      <div className="flex gap-1 px-4 pt-3 pb-0 shrink-0">
        <button
          onClick={() => navigate('/responder/queue')}
          className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all text-slate-400 border border-transparent hover:text-white"
        >
          Response Tracking
        </button>
        <button
          className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)]"
        >
          Incident History
        </button>
      </div>

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
        {!isOnline ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
            <WifiOff size={28} className="mb-3" />
            <p className="text-sm">Incident history requires an internet connection.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-[#00d4ff] border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
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
                <Clock size={28} className="text-slate-500 mb-3" />
                <p className="text-slate-500 text-sm">No completed rescues in this filter</p>
              </div>
            )}
          </>
        )}
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
