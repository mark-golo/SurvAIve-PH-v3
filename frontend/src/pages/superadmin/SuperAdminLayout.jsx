import { useNavigate, useLocation } from 'react-router-dom'
import { Globe, BarChart2, AlertOctagon, Building2, UserCog, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/auth'

const NAV = [
  { icon: Globe,        label: 'Provincial Map',    path: '/superadmin'                    },
  { icon: Building2,    label: 'Municipalities',    path: '/superadmin/municipalities'     },
  { icon: BarChart2,    label: 'Analytics',         path: '/superadmin/analytics'          },
  { icon: AlertOctagon, label: 'Escalations',       path: '/superadmin/escalations'        },
  { icon: UserCog,      label: 'Staff Management',  path: '/superadmin/staff'              },
]

export function SuperAdminLayout({ children, title }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-mesh flex">
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 glass border-r border-[rgba(255,255,255,0.08)] flex flex-col
        transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[rgba(139,92,246,0.4)] to-[rgba(0,212,255,0.3)] flex items-center justify-center">
              <span className="text-[10px] font-black text-[#8b5cf6]">SP</span>
            </div>
            <div>
              <p className="text-xs font-black text-white">SurvAIve PH</p>
              <p className="text-[9px] text-slate-500">DOST Provincial</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 truncate">{user?.name ?? 'DOST Director'}</p>
          <p className="text-[10px] text-slate-600">{user?.province ?? 'Surigao del Norte'} Province</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ icon: Icon, label, path }) => {
            const active = pathname === path
            return (
              <button key={path} onClick={() => { navigate(path); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-[rgba(139,92,246,0.12)] text-[#8b5cf6] border border-[rgba(139,92,246,0.2)]'
                    : 'text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                }`}>
                <Icon size={16} />
                {label}
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-[rgba(255,255,255,0.08)]">
          <button onClick={() => { logout(); navigate('/') }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-white">
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass border-b border-[rgba(255,255,255,0.08)] px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(v => !v)} className="lg:hidden text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <h1 className="font-bold text-white text-sm">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.15)] border border-[rgba(139,92,246,0.3)] text-[#8b5cf6]">
              Provincial
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
