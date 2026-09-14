import { useState } from 'react'
import { Bell, Volume2, Eye, Settings2, Zap, VolumeX, Sun } from 'lucide-react'

import { GlassCard } from '../../components/ui/GlassCard'
import { useAlertStore } from '../../store/alertStore'
import { getAdminTheme } from '../../lib/victimTheme'

function ToggleRow({ icon: Icon, label, description, enabled, onToggle, color = '#ef4444' }) {
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
            ? 'bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.4)] text-[#ef4444]'
            : 'text-slate-500 border-[rgba(255,255,255,0.12)] hover:text-slate-300'
        }`}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

export function AdminSettings() {
  const {
    soundEnabled,        toggleSound,
    visualEnabled,       toggleVisual,
    notificationEnabled, toggleNotification,
    volume,              setVolume,
  } = useAlertStore()

  const handleTest   = () => window.__triggerTestAlert?.()
  const handleMute   = () => window.__muteCurrentAlert?.()

  const [theme, setThemeState] = useState(() => getAdminTheme())
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    window.__setAdminTheme?.(next)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">

        {/* ── Emergency Alert Settings ────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-[#ef4444]" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Emergency Alert Settings</h2>
          </div>

          <GlassCard>
            <ToggleRow
              icon={Volume2}
              label="Emergency Sound"
              description="Play an audio alarm when a new SOS is received"
              enabled={soundEnabled}
              onToggle={toggleSound}
            />
            <ToggleRow
              icon={Eye}
              label="Visual SOS Alert"
              description="Red screen pulse overlay when a new SOS arrives"
              enabled={visualEnabled}
              onToggle={toggleVisual}
            />
            <ToggleRow
              icon={Bell}
              label="Notification Alert"
              description="Show a notification card in the top-right corner"
              enabled={notificationEnabled}
              onToggle={toggleNotification}
            />
          </GlassCard>
        </div>

        {/* ── Volume Control ──────────────────────────────────────────────── */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <Volume2 size={14} className={soundEnabled ? 'text-[#ef4444]' : 'text-slate-600'} />
            <p className="text-xs font-semibold text-white">Alert Volume</p>
            <span className="ml-auto text-xs font-bold text-slate-400">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            disabled={!soundEnabled}
            onChange={e => setVolume(+e.target.value)}
            className={`w-full h-1.5 rounded-full appearance-none cursor-pointer transition-opacity ${
              soundEnabled ? 'opacity-100' : 'opacity-30 cursor-not-allowed'
            }`}
            style={{
              background: `linear-gradient(to right, #ef4444 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
            }}
          />
          {!soundEnabled && (
            <p className="text-[10px] text-slate-600 mt-2">Enable Emergency Sound to adjust volume</p>
          )}
        </GlassCard>

        {/* ── Test & Mute Controls ────────────────────────────────────────── */}
        <GlassCard>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Alert Controls</p>

          <div className="space-y-3">
            {/* Test Alert */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)]">
                  <Zap size={14} className="text-[#ef4444]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Test Emergency Alert</p>
                  <p className="text-[10px] text-slate-500">Simulate the full visual and audio alert without creating an SOS record</p>
                </div>
              </div>
              <button
                onClick={handleTest}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white hover:opacity-90 transition-all"
              >
                Test Alert
              </button>
            </div>

            <div className="h-px bg-[rgba(255,255,255,0.05)]" />

            {/* Mute Current Alert */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[rgba(107,114,128,0.12)] border border-[rgba(107,114,128,0.2)]">
                  <VolumeX size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Mute Current Alert</p>
                  <p className="text-[10px] text-slate-500">Stop active audio and visual pulse immediately</p>
                </div>
              </div>
              <button
                onClick={handleMute}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-[rgba(255,255,255,0.1)] hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all"
              >
                Mute Alert
              </button>
            </div>
          </div>
        </GlassCard>

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
          Alert settings are saved locally per device. The SOS alert system is active on all admin pages.
        </p>

      </div>
  )
}
