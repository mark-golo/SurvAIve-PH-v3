import { useState } from 'react'
import { Shield, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { tierColor, tierLabel, formatMsShort, explainDelay } from '../../lib/ai/erdiEngine'

const TIER_ICONS = {
  CRITICAL_DELAY: AlertTriangle,
  DELAYED:        AlertTriangle,
  MINOR_DELAY:    Clock,
  ON_TRACK:       CheckCircle,
}

function StageRow({ label, elapsed, baseline, overMs, ratio }) {
  if (elapsed === null) return null
  const isOver    = ratio > 1.0
  const color     = ratio > 2.5 ? '#ef4444' : ratio > 1.5 ? '#f97316' : ratio > 1.0 ? '#f59e0b' : '#22c55e'
  const pct       = Math.min(100, Math.round((elapsed / (baseline || 1)) * 100))

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-[rgba(255,255,255,0.6)]">{label}</span>
        <span className="text-[11px]" style={{ color }}>
          {formatMsShort(elapsed)}
          {isOver && overMs > 0 && <span className="opacity-70"> (+{formatMsShort(overMs)})</span>}
        </span>
      </div>
      <div className="h-1 rounded-full bg-[rgba(255,255,255,0.1)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-[10px] text-[rgba(255,255,255,0.4)] mt-0.5">
        Baseline: {formatMsShort(baseline)}
      </div>
    </div>
  )
}

function ConfidenceDot({ level }) {
  const color = level === 'high' ? '#22c55e' : level === 'medium' ? '#f59e0b' : '#9ca3af'
  return (
    <span className="inline-flex items-center gap-1 text-[10px]" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
      {level.charAt(0).toUpperCase() + level.slice(1)} confidence
    </span>
  )
}

/**
 * ERDIPanel — Emergency Response Delay Intelligence display card.
 *
 * Props:
 *   assessment — result of erdiEngine.assessDelay(...)
 *   role       — 'victim' | 'responder' | 'admin'
 *   className  — optional extra classes for the outer GlassCard
 */
const FACTOR_TYPE_STYLES = {
  observed: { symbol: '●', color: 'rgba(34,197,94,0.7)',   title: 'Observed — live system data' },
  reported: { symbol: '!', color: 'rgba(251,191,36,0.8)',  title: 'Reported — from user or external source' },
  inferred: { symbol: '~', color: 'rgba(148,163,184,0.6)', title: 'Inferred — derived from available context' },
}

export function ERDIPanel({ assessment, role = 'victim', className = '' }) {
  const [expanded, setExpanded] = useState(false)

  if (!assessment) return null

  const { tier, factors, stages, recommendations, potentialImpact, confidence, staleDataWarning, assessedAt } = assessment
  const color   = tierColor(tier)
  const label   = tierLabel(tier)
  const TierIcon = TIER_ICONS[tier] ?? Clock
  const rec     = recommendations?.[role]

  const timeStr = assessedAt
    ? assessedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <GlassCard className={`border border-[rgba(255,255,255,0.08)] ${className}`}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Shield size={14} className="shrink-0" style={{ color }} />
        <span className="text-xs font-semibold text-[rgba(255,255,255,0.8)] flex-1">
          Response Delay Intelligence
        </span>
        {/* Tier badge */}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
          style={{ color, borderColor: color + '55', backgroundColor: color + '18' }}
        >
          <TierIcon size={10} />
          {label}
        </span>
        {expanded ? <ChevronUp size={14} className="text-[rgba(255,255,255,0.4)] shrink-0" /> : <ChevronDown size={14} className="text-[rgba(255,255,255,0.4)] shrink-0" />}
      </button>

      {/* Collapsed summary line */}
      {!expanded && factors.length > 0 && (
        <p className="text-[11px] text-[rgba(255,255,255,0.45)] mt-1.5 leading-snug line-clamp-1">
          {factors[0]?.label ?? factors[0]}
        </p>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Narrative explanation (§5.1, §8) — only for non-ON_TRACK tiers */}
          {tier !== 'ON_TRACK' && (() => {
            const narrative = explainDelay(assessment, role)
            return narrative ? (
              <p className="text-xs text-[rgba(255,255,255,0.65)] italic leading-relaxed pb-3 border-b border-[rgba(255,255,255,0.06)]">
                {narrative}
              </p>
            ) : null
          })()}
          {/* Stage timeline */}
          <div>
            <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">Response Stages</p>
            {Object.entries(stages).map(([key, s]) =>
              s.elapsed !== null ? (
                <StageRow key={key} {...s} />
              ) : null
            )}
            {Object.values(stages).every(s => s.elapsed === null) && (
              <p className="text-[11px] text-[rgba(255,255,255,0.4)]">No stage transitions recorded yet.</p>
            )}
          </div>

          {/* Potential impact (§7) */}
          {potentialImpact && (
            <p className="text-[11px] text-[rgba(245,158,11,0.75)] italic leading-snug">
              {potentialImpact}
            </p>
          )}

          {/* Contributing factors */}
          {factors.length > 0 && (
            <div>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1.5">Contributing Factors</p>
              <ul className="space-y-1">
                {factors.map((f, i) => {
                  const label = typeof f === 'string' ? f : f.label
                  const ftype = typeof f === 'string' ? null : f.type
                  const style = ftype ? FACTOR_TYPE_STYLES[ftype] : null
                  return (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-[rgba(255,255,255,0.65)]">
                      {style ? (
                        <span
                          className="mt-0.5 shrink-0 text-[9px] font-bold leading-none"
                          style={{ color: style.color }}
                          title={style.title}
                        >
                          {style.symbol}
                        </span>
                      ) : (
                        <span className="mt-0.5 shrink-0 w-1 h-1 rounded-full bg-[rgba(255,255,255,0.3)]" />
                      )}
                      {label}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Recommended action */}
          {rec && (
            <div className="rounded-xl p-2.5" style={{ backgroundColor: color + '12', borderLeft: `2px solid ${color}55` }}>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Recommended Action</p>
              <p className="text-[11px] text-[rgba(255,255,255,0.75)] leading-snug">{rec}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-[rgba(255,255,255,0.06)]">
            <ConfidenceDot level={confidence} />
            {timeStr && (
              <span className="text-[10px] text-[rgba(255,255,255,0.3)]">Updated {timeStr}</span>
            )}
          </div>

          {staleDataWarning && (
            <div className="flex items-start gap-1.5 text-[10px] text-[rgba(245,158,11,0.7)]">
              <Info size={10} className="mt-0.5 shrink-0" />
              <span>Some inputs may be outdated. Verify with field personnel before acting on this analysis.</span>
            </div>
          )}

          {/* Standard disclaimer — matches existing AI disclaimer pattern */}
          <p className="text-[10px] text-[rgba(255,255,255,0.3)] italic">
            AI suggestion — verify with field personnel before taking action.
          </p>
        </div>
      )}
    </GlassCard>
  )
}
