import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, CheckCircle, Clock, ChevronRight, X } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { GlassCard } from '../../components/ui/GlassCard'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

const SEVERITY_COLORS = {
  EMERGENCY:  { border: 'border-[rgba(239,68,68,0.4)]',   badge: 'bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.4)]'   },
  MONITORING: { border: 'border-[rgba(245,158,11,0.4)]',  badge: 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.4)]'  },
  STABLE:     { border: 'border-[rgba(34,197,94,0.3)]',   badge: 'bg-[rgba(34,197,94,0.15)] text-[#22c55e] border-[rgba(34,197,94,0.4)]'    },
}

export function MunicipalityList() {
  const { scope } = useAuthStore()
  const [selected, setSelected] = useState(null)
  const [sosData, setSosData] = useState([])

  const prov = scope?.province
  useEffect(() => {
    if (!prov) return
    api.get(`/sos?province=${encodeURIComponent(prov)}`)
      .then(rows => setSosData(rows))
      .catch(() => {})
  }, [prov])

  const liveMunicipalities = useMemo(() => {
    const map = {}
    sosData.forEach(r => {
      const name = r.municipality ?? 'Unknown'
      if (!map[name]) map[name] = { id: name, name, total: 0, critical: 0, rescued: 0, verified: 0, guest: 0, lastSync: 'live', lgu: '' }
      map[name].total++
      if (r.priority === 'CRITICAL') map[name].critical++
      if (r.rescue_status === 'rescued') map[name].rescued++
      if (r.is_verified) map[name].verified++; else map[name].guest++
    })
    return Object.values(map).map(m => ({
      ...m,
      severity: m.critical > 0 ? 'EMERGENCY' : m.total > 0 ? 'MONITORING' : 'STABLE',
    }))
  }, [sosData])

  const sorted = [...liveMunicipalities].sort((a, b) => b.critical - a.critical || b.total - a.total)

  return (
    <SuperAdminLayout title="Municipalities">
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((m, i) => {
            const sc = SEVERITY_COLORS[m.severity] ?? SEVERITY_COLORS.STABLE
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <div onClick={() => setSelected(m)}
                  className={`glass rounded-2xl p-4 cursor-pointer border transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,212,255,0.1)] ${sc.border}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-white">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.lgu}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${sc.badge}`}>{m.severity}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Metric label="SOS"      value={m.total}    color="#00d4ff" />
                    <Metric label="Critical" value={m.critical} color="#ef4444" />
                    <Metric label="Rescued"  value={m.rescued}  color="#22c55e" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock size={9} />
                      {m.lastSync}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-[#00d4ff]">✓ {m.verified} verified</span>
                      <span className="text-[9px] text-[#f59e0b]">⚠ {m.guest} guest</span>
                    </div>
                    <ChevronRight size={13} className="text-slate-600" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm glass border-l border-[rgba(255,255,255,0.1)] overflow-y-auto"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white">{selected.name}</h2>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4">{selected.lgu} · Read-only view</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Chip label="Total SOS"   value={selected.total}    color="#00d4ff" />
                <Chip label="Critical"    value={selected.critical} color="#ef4444" />
                <Chip label="Rescued"     value={selected.rescued}  color="#22c55e" />
                <Chip label="Verified"    value={selected.verified} color="#8b5cf6" />
              </div>

              <GlassCard className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Barangay Breakdown</p>
                <p className="text-xs text-slate-500">No barangay data</p>
              </GlassCard>

              <button onClick={() => alert('Escalate to NDRRMC – would flag this municipality for national attention')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[rgba(239,68,68,0.8)] to-[rgba(220,38,38,0.9)] text-white text-sm font-bold
                           shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all">
                Escalate to National (NDRRMC)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SuperAdminLayout>
  )
}

function Metric({ label, value, color }) {
  return (
    <div className="text-center">
      <p className="font-black text-lg" style={{ color }}>{value}</p>
      <p className="text-[9px] text-slate-500 uppercase">{label}</p>
    </div>
  )
}

function Chip({ label, value, color }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
