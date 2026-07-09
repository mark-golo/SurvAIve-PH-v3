const configs = {
  CRITICAL:  { bg: 'bg-[rgba(239,68,68,0.15)]',  border: 'border-[rgba(239,68,68,0.5)]',   text: 'text-[#ef4444]',  dot: 'bg-[#ef4444]'  },
  HIGH:      { bg: 'bg-[rgba(249,115,22,0.15)]', border: 'border-[rgba(249,115,22,0.5)]',  text: 'text-[#f97316]',  dot: 'bg-[#f97316]'  },
  MODERATE:  { bg: 'bg-[rgba(245,158,11,0.15)]', border: 'border-[rgba(245,158,11,0.5)]',  text: 'text-[#f59e0b]',  dot: 'bg-[#f59e0b]'  },
  SAFE:      { bg: 'bg-[rgba(34,197,94,0.15)]',  border: 'border-[rgba(34,197,94,0.5)]',   text: 'text-[#22c55e]',  dot: 'bg-[#22c55e]'  },
  VERIFIED:  { bg: 'bg-[rgba(0,212,255,0.15)]',  border: 'border-[rgba(0,212,255,0.5)]',   text: 'text-[#00d4ff]',  dot: 'bg-[#00d4ff]'  },
  GUEST:     { bg: 'bg-[rgba(245,158,11,0.15)]', border: 'border-[rgba(245,158,11,0.5)]',  text: 'text-[#f59e0b]',  dot: 'bg-[#f59e0b]'  },
  ONLINE:    { bg: 'bg-[rgba(34,197,94,0.15)]',  border: 'border-[rgba(34,197,94,0.5)]',   text: 'text-[#22c55e]',  dot: 'bg-[#22c55e]'  },
  OFFLINE:   { bg: 'bg-[rgba(107,114,128,0.15)]',border: 'border-[rgba(107,114,128,0.5)]', text: 'text-[#9ca3af]',  dot: 'bg-[#9ca3af]'  },
  ACTIVE:    { bg: 'bg-[rgba(34,197,94,0.15)]',  border: 'border-[rgba(34,197,94,0.5)]',   text: 'text-[#22c55e]',  dot: 'bg-[#22c55e]'  },
  STANDBY:   { bg: 'bg-[rgba(0,212,255,0.15)]',  border: 'border-[rgba(0,212,255,0.5)]',   text: 'text-[#00d4ff]',  dot: 'bg-[#00d4ff]'  },
  EMERGENCY: { bg: 'bg-[rgba(239,68,68,0.15)]',  border: 'border-[rgba(239,68,68,0.5)]',   text: 'text-[#ef4444]',  dot: 'bg-[#ef4444]'  },
  STABLE:    { bg: 'bg-[rgba(34,197,94,0.15)]',  border: 'border-[rgba(34,197,94,0.5)]',   text: 'text-[#22c55e]',  dot: 'bg-[#22c55e]'  },
}

export function StatusBadge({ status, pulse = false, className = '' }) {
  const cfg = configs[status?.toUpperCase()] ?? configs.OFFLINE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  )
}
