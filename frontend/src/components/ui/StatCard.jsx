export function StatCard({ label, value, sub, icon: Icon, color = '#00d4ff', className = '' }) {
  return (
    <div className={`glass rounded-2xl p-4 flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={16} style={{ color }} className="opacity-70" />}
      </div>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}
