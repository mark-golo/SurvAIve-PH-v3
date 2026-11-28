import { LogOut, X } from 'lucide-react'
import { NeonButton } from './NeonButton'

const REMINDERS = {
  victim:          'Stay safe, stay alert, and follow official emergency advisories.',
  responder:       'Stay safe and ensure your response updates are recorded.',
  response_agency: 'Check pending reports and response updates before logging out.',
  admin:           'Ensure critical information and pending tasks are updated.',
}

export function LogoutConfirmDialog({ role, onConfirm, onCancel }) {
  const reminder = REMINDERS[role] ?? REMINDERS.victim
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="glass rounded-2xl border border-[rgba(255,255,255,0.08)] p-6 max-w-sm w-full space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + close */}
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)]">
            <LogOut size={18} className="text-[#ef4444]" />
          </div>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        <div>
          <p className="text-base font-bold text-white">Are you sure you want to log out?</p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">{reminder}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <NeonButton variant="red" onClick={onConfirm} className="w-full">
            Logout
          </NeonButton>
          <NeonButton variant="ghost" onClick={onCancel} className="w-full">
            Cancel
          </NeonButton>
        </div>
      </div>
    </div>
  )
}
