export function GlassInput({ label, error, icon: Icon, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <div className="relative">
        {Icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Icon size={16} />
          </span>
        )}
        <input
          className={`
            w-full glass rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500
            border border-[rgba(255,255,255,0.08)] focus:border-[rgba(0,212,255,0.4)]
            focus:outline-none focus:ring-1 focus:ring-[rgba(0,212,255,0.2)]
            transition-all duration-200
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-[rgba(239,68,68,0.5)] focus:border-[rgba(239,68,68,0.7)]' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
}

export function GlassSelect({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <select
        className={`
          w-full glass rounded-xl px-4 py-3 text-sm text-slate-200
          border border-[rgba(255,255,255,0.08)] focus:border-[rgba(0,212,255,0.4)]
          focus:outline-none bg-[rgba(15,23,42,0.8)] cursor-pointer
          transition-all duration-200
          ${error ? 'border-[rgba(239,68,68,0.5)]' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
}

export function GlassTextarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <textarea
        className={`
          w-full glass rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500
          border border-[rgba(255,255,255,0.08)] focus:border-[rgba(0,212,255,0.4)]
          focus:outline-none focus:ring-1 focus:ring-[rgba(0,212,255,0.2)]
          resize-none transition-all duration-200
          ${error ? 'border-[rgba(239,68,68,0.5)]' : ''}
          ${className}
        `}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
}
