import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'

const OPTIONS = [
  { value: 'light', Icon: Sun,  label: 'Light Theme' },
  { value: 'dark',  Icon: Moon, label: 'Dark Theme'  },
]

export function ThemeToggle({ theme, onChange }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div
      className="flex items-center rounded-full p-1 gap-0.5"
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, Icon, label }) => {
        const active = theme === value
        return (
          <div key={value} className="relative">
            <button
              type="button"
              onClick={() => onChange(value)}
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(null)}
              aria-label={label}
              aria-pressed={active}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
              style={active
                ? { background: 'rgba(255,255,255,0.18)', color: '#ffffff' }
                : { color: 'rgba(148,163,184,0.5)' }
              }
            >
              <Icon size={13} strokeWidth={2} />
            </button>
            {hovered === value && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap pointer-events-none z-50"
                style={{ background: 'rgba(15,23,42,0.92)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {label}
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
                  style={{ borderTopColor: 'rgba(15,23,42,0.92)' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
