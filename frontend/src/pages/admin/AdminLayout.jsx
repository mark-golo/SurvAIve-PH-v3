import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, BookUser, ShieldCheck, BarChart2, Radio, UserCog, MapPin, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/auth'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Command Center',    path: '/admin'              },
  { icon: Users,           label: 'Victim Table',      path: '/admin/victims'      },
  { icon: BookUser,        label: 'Constituents',      path: '/admin/constituents' },
  { icon: ShieldCheck,     label: 'Safety Check',      path: '/admin/safety'       },
  { icon: BarChart2,       label: 'Analytics',         path: '/admin/analytics'    },
  { icon: Radio,           label: 'Responders',        path: '/admin/responders'   },
  { icon: UserCog,         label: 'Staff',             path: '/admin/staff'               },
  { icon: MapPin,          label: 'Evacuation Centers', path: '/admin/evacuation-centers'  },
]

export function AdminLayout({ children, title }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-mesh flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 glass border-r border-[rgba(255,255,255,0.08)]
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[rgba(0,212,255,0.3)] to-[rgba(139,92,246,0.3)] flex items-center justify-center">
              <span className="text-[10px] font-black text-[#00d4ff]">SP</span>
            </div>
            <div>
              <p className="text-xs font-black text-white">SurvAIve PH</p>
              <p className="text-[9px] text-slate-500">DRRM Admin</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 truncate">{user?.name ?? 'Admin'}</p>
          <p className="text-[10px] text-slate-600 truncate">{user?.municipality ?? 'Municipality'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
            const active = pathname === path
            return (
              <button key={path} onClick={() => { navigate(path); setSidebarOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-[rgba(0,212,255,0.12)] text-[#00d4ff] border border-[rgba(0,212,255,0.2)]'
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
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-white transition-all">
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass border-b border-[rgba(255,255,255,0.08)] px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(v => !v)}
            className="lg:hidden text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <h1 className="font-bold text-white text-sm">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-xs text-slate-500 hidden sm:block">Live</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
