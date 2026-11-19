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
      style={{ background: '#f1f5f9', border: '1px solid rgba(0,0,0,0.12)' }}
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
                ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }
                : { color: '#94a3b8' }
              }
            >
              <Icon size={13} strokeWidth={2} />
            </button>
            {hovered === value && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap pointer-events-none z-50"
                style={{ background: '#ffffff', color: '#000000', border: '1px solid #000000' }}
              >
                {label}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
