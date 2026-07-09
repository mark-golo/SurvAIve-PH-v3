import { MapPin, Clock, Users, ChevronRight } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { useNavigate } from 'react-router-dom'

const priorityBorder = {
  CRITICAL: 'border-l-4 border-l-[#ef4444]',
  HIGH:     'border-l-4 border-l-[#f97316]',
  MODERATE: 'border-l-4 border-l-[#f59e0b]',
  LOW:      'border-l-4 border-l-[#22c55e]',
}

export function PriorityCard({ report, navigateTo, showAssignee = false }) {
  const navigate = useNavigate()
  const priority = report.priority ?? 'MODERATE'
  const borderCls = priorityBorder[priority] ?? priorityBorder.MODERATE

  return (
    <div
      onClick={() => navigateTo && navigate(navigateTo)}
      className={`glass rounded-2xl p-4 flex items-start gap-3 cursor-pointer
        hover:border-[rgba(0,212,255,0.2)] transition-all duration-200 ${borderCls}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={priority} />
          {report.is_verified ? (
            <span className="text-[10px] text-[#00d4ff] font-medium">✓ Verified</span>
          ) : (
            <span className="text-[10px] text-[#f59e0b] font-medium">Guest</span>
          )}
        </div>
        <p className="font-semibold text-sm text-slate-200 truncate">{report.name ?? 'Anonymous'}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">
          Status: <span className="text-slate-300">{report.status}</span>
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <MapPin size={10} /> {report.barangay ?? '—'}
          </span>
          <span className="flex items-center gap-1">
            <Users size={10} /> {report.people_count ?? 1}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} /> {report.time_ago ?? 'just now'}
          </span>
        </div>
        {report.notes && (
          <p className="text-xs text-slate-500 mt-1.5 truncate italic">"{report.notes}"</p>
        )}
      </div>
      <ChevronRight size={16} className="text-slate-500 mt-1 shrink-0" />
    </div>
  )
}
