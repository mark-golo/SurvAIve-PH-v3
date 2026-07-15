import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, User, MapPin, Radio, List, Map, Settings, Home } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { NeonButton } from '../../components/ui/NeonButton'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Radio,    label: 'Relay',    path: '/responder/relay'    },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

export function ResponderSettings() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRelay, setAutoRelay] = useState(true)
  const [offlineForce, setOfflineForce] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) { setLoading(false); return }
      supabase
        .from('responders')
        .select('*')
        .eq('contact_number', contact)
        .single()
        .then(({ data }) => { if (data) setProfile(data) })
        .finally(() => setLoading(false))
    })
  }, [])

  const name = profile?.name || user?.name || 'Responder'
  const status = profile?.status ?? 'active'

  if (loading) return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar title="Responder Settings" onBack />
      <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">Loading…</div>
      <MobileNavBar items={NAV} />
    </div>
  )

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-20">
      <TopBar title="Responder Settings" onBack />

      <main className="flex-1 p-4 space-y-4">
        {/* Profile */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(0,212,255,0.2)] to-[rgba(139,92,246,0.2)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
              <User size={22} className="text-[#00d4ff]" />
            </div>
            <div>
              <p className="font-bold text-white">{name}</p>
              <p className="text-xs text-slate-500">
                Field Responder ·{' '}
                <span className={status === 'active' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                  {status}
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-0 pt-3 border-t border-[rgba(255,255,255,0.06)]">
            <InfoRow label="Contact"       value={profile?.contact_number} />
            <InfoRow label="Team ID"       value={profile?.team_id} />
            <InfoRow label="Unit Name"     value={profile?.unit_name} />
            <InfoRow label="Assigned Zone" value={profile?.assigned_zone} icon={MapPin} />
            <InfoRow label="Barangay"      value={profile?.assigned_barangay ?? profile?.barangay} />
            <InfoRow label="Municipality"  value={profile?.municipality} />
            <InfoRow label="Province"      value={profile?.province} />
          </div>
        </GlassCard>

        {/* Network Settings */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Network Settings</p>
          <div className="space-y-3">
            <ToggleRow label="Auto-Relay Mode"    sub="Background mesh forwarding"  on={autoRelay}    onToggle={() => setAutoRelay(v => !v)} />
            <ToggleRow label="Force Offline Mode" sub="Disable all network requests" on={offlineForce} onToggle={() => setOfflineForce(v => !v)} />
          </div>
        </GlassCard>

        <NeonButton variant="ghost" onClick={() => { logout(); navigate('/') }} className="w-full">
          <LogOut size={14} className="mr-2" />
          Sign Out
        </NeonButton>
      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={11} className="text-slate-500" />}
        <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xs text-white font-medium">{value || '—'}</p>
    </div>
  )
}

function ToggleRow({ label, sub, on, onToggle }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
      </div>
      <button onClick={onToggle} className={`w-11 h-6 rounded-full transition-all relative ${on ? 'bg-[#00d4ff]' : 'bg-slate-700'}`}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? '22px' : '2px' }} />
      </button>
    </div>
  )
}
