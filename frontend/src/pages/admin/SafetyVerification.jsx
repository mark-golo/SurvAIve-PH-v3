import { useState } from 'react'
import { CheckCircle, AlertTriangle, Download, Filter, Users } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassCard } from '../../components/ui/GlassCard'

const REPORTED = [
  { id: 1, name: 'Rosa Villanueva', barangay: 'Caub',      status: 'trapped',  accounted: false },
  { id: 2, name: 'Maria Santos',    barangay: 'Del Carmen Poblacion', status: 'trapped',  accounted: false },
  { id: 3, name: 'Juan Dela Cruz',  barangay: 'Bitoon',    status: 'injured',  accounted: false },
  { id: 5, name: 'Ana Reyes',       barangay: 'Esperanza', status: 'rescued',  accounted: true  },
]

const NO_REPORT = [
  { id: 4, name: 'Pedro Ramos',     barangay: 'Domoyog',   contact: '+63920000004', vulnerability: '' },
  { id: 6, name: 'Liza Mendoza',    barangay: 'San Jose',     contact: '+63920000006', vulnerability: 'Elderly' },
  { id: 7, name: 'Roberto Cruz',    barangay: 'Cancohoy',  contact: '+63920000007', vulnerability: 'PWD' },
]

export function SafetyVerification() {
  const [reported, setReported] = useState(REPORTED)
  const [noReport, setNoReport] = useState(NO_REPORT)

  const total = reported.length + noReport.length
  const accounted = reported.filter(r => r.accounted).length + noReport.filter(r => r.accounted).length

  const markAccounted = (id, fromNoReport = false) => {
    if (fromNoReport) {
      setNoReport(d => d.map(r => r.id === id ? { ...r, accounted: true } : r))
    } else {
      setReported(d => d.map(r => r.id === id ? { ...r, accounted: true } : r))
    }
  }

  return (
    <AdminLayout title="Safety Verification">
      <div className="p-4 space-y-4">
        {/* Summary */}
        <GlassCard glow>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">Welfare Check Summary</p>
            <NeonButton size="sm" variant="ghost" onClick={() => alert('Export welfare check list as PDF')}>
              <Download size={12} className="mr-1.5" />
              Export
            </NeonButton>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-3 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#00d4ff] transition-all"
                style={{ width: `${(accounted / total) * 100}%` }} />
            </div>
            <span className="text-sm font-bold text-[#00d4ff]">{accounted}/{total}</span>
          </div>
          <p className="text-xs text-slate-400">
            <span className="text-[#22c55e] font-semibold">{accounted}</span> of{' '}
            <span className="text-white font-semibold">{total}</span> registered residents accounted for
          </p>
        </GlassCard>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left – SOS sent */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-[#ef4444]" />
              <p className="text-xs font-semibold text-white uppercase tracking-wider">SOS Reported ({reported.length})</p>
            </div>
            <div className="space-y-2">
              {reported.map(r => (
                <div key={r.id} className={`glass rounded-xl p-3 border transition-all ${
                  r.accounted ? 'border-[rgba(34,197,94,0.3)] opacity-60' : 'border-[rgba(239,68,68,0.3)]'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.barangay} · {r.status}</p>
                    </div>
                    {r.accounted ? (
                      <span className="text-xs text-[#22c55e] flex items-center gap-1"><CheckCircle size={12} />Accounted</span>
                    ) : (
                      <NeonButton size="sm" variant="green" onClick={() => markAccounted(r.id)}>
                        <CheckCircle size={11} className="mr-1" />
                        Confirm
                      </NeonButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right – No report (status unknown) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-[#f59e0b]" />
              <p className="text-xs font-semibold text-white uppercase tracking-wider">No Report – Need Welfare Check ({noReport.length})</p>
            </div>
            <div className="space-y-2">
              {noReport.map(r => (
                <div key={r.id} className={`glass rounded-xl p-3 border transition-all ${
                  r.accounted ? 'border-[rgba(34,197,94,0.3)] opacity-60' : 'border-[rgba(245,158,11,0.3)]'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.barangay} · {r.contact}</p>
                      {r.vulnerability && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] mt-1 inline-block">
                          {r.vulnerability}
                        </span>
                      )}
                    </div>
                    {r.accounted ? (
                      <span className="text-xs text-[#22c55e] flex items-center gap-1"><CheckCircle size={12} />Done</span>
                    ) : (
                      <NeonButton size="sm" variant="green" onClick={() => markAccounted(r.id, true)}>
                        <CheckCircle size={11} className="mr-1" />
                        Accounted
                      </NeonButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
