import { useState } from 'react'
import { Sun } from 'lucide-react'

import { GlassCard } from '../../components/ui/GlassCard'
import { SuperAdminLayout } from './SuperAdminLayout'
import { getSuperAdminTheme } from '../../lib/victimTheme'

function ToggleRow({ icon: Icon, label, description, enabled, onToggle, color = '#8b5cf6' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={15} style={{ color }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          {description && <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 ${
          enabled
            ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.4)] text-[#8b5cf6]'
            : 'text-slate-500 border-[rgba(255,255,255,0.12)] hover:text-slate-300'
        }`}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

export function SuperAdminSettings() {
  const [theme, setThemeState] = useState(() => getSuperAdminTheme())

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    window.__setSuperAdminTheme?.(next)
  }

  return (
    <SuperAdminLayout title="Settings">
      <div className="p-4 max-w-2xl mx-auto space-y-6">

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Appearance</p>
          <ToggleRow
            icon={Sun}
            label="Light Mode"
            description="Switch to a brighter, easier-to-read interface"
            enabled={theme === 'light'}
            onToggle={toggleTheme}
            color="#f59e0b"
          />
        </GlassCard>

        {/* ── Info footer ─────────────────────────────────────────────────── */}
        <p className="text-[10px] text-slate-600 text-center">
          Appearance settings are saved locally per device.
        </p>

      </div>
    </SuperAdminLayout>
  )
}
