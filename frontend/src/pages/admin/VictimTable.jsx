import { useState, useEffect } from 'react'
import { Search, Filter, MapPin, UserCheck, Flag, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput } from '../../components/ui/GlassInput'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

const DEMO = [
  { id: 1, name: 'Rosa Villanueva',  status: 'trapped', barangay: 'Caub',      timestamp: '14:32', priority: 'CRITICAL', score: 95, verified: true,  rescue: 'pending'   },
  { id: 2, name: 'Maria Santos',     status: 'trapped', barangay: 'Del Carmen Poblacion', timestamp: '14:28', priority: 'CRITICAL', score: 92, verified: true,  rescue: 'pending'   },
  { id: 3, name: 'Juan Dela Cruz',   status: 'injured', barangay: 'Bitoon',    timestamp: '14:20', priority: 'HIGH',     score: 78, verified: true,  rescue: 'en_route'  },
  { id: 4, name: 'Guest User',       status: 'injured', barangay: 'Cancohoy',  timestamp: '14:17', priority: 'HIGH',     score: 68, verified: false, rescue: 'pending'   },
  { id: 5, name: 'Anonymous',        status: 'missing', barangay: 'Caub',      timestamp: '14:10', priority: 'MODERATE', score: 55, verified: false, rescue: 'pending'   },
  { id: 6, name: 'Group',            status: 'safe',    barangay: 'Domoyog',   timestamp: '14:05', priority: 'SAFE',     score: 20, verified: false, rescue: 'pending'   },
]

const RESCUE_LABEL = { pending: 'Pending', en_route: 'En Route', on_scene: 'On Scene', rescued: 'Rescued', cannot_reach: 'Cannot Reach' }

export function VictimTable() {
  const { scope } = useAuthStore()
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('score')
  const [loading, setLoading] = useState(true)

  const muni = scope?.municipality
  useEffect(() => {
    api.get(muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos')
      .then(rows => setData(rows.map(r => ({
        id: r.id,
        name: r.name ?? 'Guest',
        status: r.status,
        barangay: r.barangay,
        timestamp: r.time_ago,
        score: r.ai_priority_score,
        priority: r.priority,
        verified: !!r.is_verified,
        rescue: r.rescue_status,
      }))))
      .catch(() => setData(DEMO))
      .finally(() => setLoading(false))
  }, [])

  const displayed = data
    .filter(r => {
      if (search) return r.name.toLowerCase().includes(search.toLowerCase()) || r.barangay.toLowerCase().includes(search.toLowerCase())
      if (filter === 'critical') return r.priority === 'CRITICAL'
      if (filter === 'verified') return r.verified
      if (filter === 'guest')    return !r.verified
      return true
    })
    .sort((a, b) => sortBy === 'score' ? b.score - a.score : a.timestamp.localeCompare(b.timestamp))

  const markRescued = async (id) => {
    try { await api.put(`/sos/${id}`, { rescue_status: 'rescued' }) } catch {}
    setData(d => d.map(r => r.id === id ? { ...r, rescue: 'rescued' } : r))
  }

  const flagSuspicious = (id) => {
    setData(d => d.map(r => r.id === id ? { ...r, flagged: true, score: Math.max(0, r.score - 20) } : r))
  }

  if (loading) return (
    <AdminLayout title="Victim Reports">
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading reports…</div>
    </AdminLayout>
  )

  return (
    <AdminLayout title="Victim Reports">
      <div className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <GlassInput
              placeholder="Search name or barangay…"
              icon={Search}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'critical', 'verified', 'guest'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${
                  filter === f
                    ? 'bg-[rgba(0,212,255,0.15)] border-[rgba(0,212,255,0.5)] text-[#00d4ff]'
                    : 'glass border-[rgba(255,255,255,0.08)] text-slate-400'
                }`}>{f}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  {['Name', 'Status', 'Barangay', 'Time', 'AI Score', 'Verified', 'Rescue', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, i) => (
                  <tr key={r.id}
                    className={`border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${
                      r.flagged ? 'opacity-50' : ''
                    }`}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{r.name}</p>
                      {r.flagged && <span className="text-[10px] text-[#ef4444]">⚑ Flagged</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.priority} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.barangay}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.timestamp}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-black ${
                        r.score >= 80 ? 'text-[#ef4444]' : r.score >= 60 ? 'text-[#f97316]' : r.score >= 40 ? 'text-[#f59e0b]' : 'text-[#22c55e]'
                      }`}>{r.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.verified
                        ? <span className="text-[11px] text-[#00d4ff] font-medium">✓ Yes</span>
                        : <span className="text-[11px] text-[#f59e0b] font-medium">Guest</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        r.rescue === 'rescued'  ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)] text-[#22c55e]' :
                        r.rescue === 'en_route' ? 'bg-[rgba(0,212,255,0.1)] border-[rgba(0,212,255,0.3)] text-[#00d4ff]' :
                        'bg-[rgba(107,114,128,0.1)] border-[rgba(107,114,128,0.3)] text-[#9ca3af]'
                      }`}>{RESCUE_LABEL[r.rescue]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => markRescued(r.id)} title="Mark Rescued"
                          className="p-1.5 rounded-lg hover:bg-[rgba(34,197,94,0.2)] text-slate-500 hover:text-[#22c55e] transition-all">
                          <UserCheck size={13} />
                        </button>
                        <button onClick={() => flagSuspicious(r.id)} title="Flag Suspicious"
                          className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.2)] text-slate-500 hover:text-[#ef4444] transition-all">
                          <Flag size={13} />
                        </button>
                        <button title="View on Map"
                          className="p-1.5 rounded-lg hover:bg-[rgba(0,212,255,0.2)] text-slate-500 hover:text-[#00d4ff] transition-all">
                          <MapPin size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-600 text-right">{displayed.length} records</p>
      </div>
    </AdminLayout>
  )
}
