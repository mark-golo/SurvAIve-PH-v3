export function GlassCard({ children, className = '', glow = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`
        glass rounded-2xl p-4
        ${glow ? 'glass-bright' : ''}
        ${onClick ? 'cursor-pointer hover:border-[rgba(0,212,255,0.3)] transition-all duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
