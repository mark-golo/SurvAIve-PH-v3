import { Sun, Monitor, Moon } from 'lucide-react'

const OPTIONS = [
  { value: 'light',  Icon: Sun,     label: 'Light'  },
  { value: 'system', Icon: Monitor, label: 'System' },
  { value: 'dark',   Icon: Moon,    label: 'Dark'   },
]

export function ThemeToggle({ theme, onChange }) {
  return (
    <div
      className="flex items-center rounded-full p-0.5 gap-0.5"
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, Icon, label }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-label={label}
            aria-pressed={active}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
            style={active
              ? { background: 'rgba(255,255,255,0.18)', color: '#ffffff' }
              : { color: 'rgba(148,163,184,0.7)' }
            }
          >
            <Icon size={13} strokeWidth={2} />
          </button>
        )
      })}
    </div>
  )
}
