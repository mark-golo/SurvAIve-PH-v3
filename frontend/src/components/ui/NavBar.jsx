import { useNavigate, useLocation } from 'react-router-dom'

export function MobileNavBar({ items }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-[rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
        {items.map(({ icon: Icon, label, path }) => {
          const active = pathname === path || pathname.startsWith(path + '/')
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[52px] ${
                active
                  ? 'text-[#00d4ff] bg-[rgba(0,212,255,0.1)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function TopBar({ title, subtitle, rightSlot, leftSlot, onBack }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 glass border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        {leftSlot}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-100 text-sm truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        {rightSlot}
      </div>
    </header>
  )
}
