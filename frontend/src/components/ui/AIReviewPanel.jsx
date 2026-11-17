import { useState } from 'react'
import { CheckCircle, XCircle, Edit3, AlertTriangle, Clock } from 'lucide-react'
import { reviewAIPriority } from '../../lib/api'

const PRIORITY_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', LOW: '#22c55e' }
const SERVICE_LABEL  = { mdrrmo: 'MDRRMO / Disaster', hospital: 'Medical', bfp: 'Fire', pnp: 'Crime/Security', pcg: 'Maritime' }

function getPriorityLabel(score) {
  const s = Number(score) || 50
  if (s >= 80) return 'CRITICAL'
  if (s >= 60) return 'HIGH'
  if (s >= 40) return 'MODERATE'
  return 'LOW'
}

function confidenceLabel(val) {
  if (!val) return null
  if (val >= 70) return 'High'
  if (val >= 40) return 'Medium'
  return 'Low'
}

const REVIEW_STYLES = {
  confirmed: { color: '#22c55e', label: 'AI Confirmed',      icon: CheckCircle },
  corrected: { color: '#3b82f6', label: 'Priority Corrected', icon: Edit3       },
  rejected:  { color: '#ef4444', label: 'Assessment Rejected', icon: XCircle    },
  unreviewed:{ color: '#f59e0b', label: 'Unreviewed',          icon: Clock      },
}

const PRIORITY_TIERS = [
  { label: 'CRITICAL',  score: 80 },
  { label: 'HIGH',      score: 65 },
  { label: 'MODERATE',  score: 50 },
  { label: 'LOW',       score: 30 },
]

/**
 * AIReviewPanel — compact human validation widget for an AI-assessed SOS report.
 * Blueprint §3.6, §3.8: Confirm / Correct / Reject AI-generated classification.
 *
 * Props:
 *   report       — sos_reports row
 *   reviewerName — current user's display name
 *   onReviewed   — callback(updatedFields) after a successful review
 */
export function AIReviewPanel({ report, reviewerName, onReviewed }) {
  const currentStatus = report.ai_review_status || 'unreviewed'
  const priorityLabel = getPriorityLabel(report.ai_priority_score)
  const priorityColor = PRIORITY_COLOR[priorityLabel]
  const confLabel     = confidenceLabel(report.ai_confidence)
  const serviceLabel  = SERVICE_LABEL[report.ai_classification] ?? report.ai_classification ?? '—'

  const [mode, setMode]       = useState(null)   // null | 'override' | 'reject'
  const [overrideTier, setOverrideTier] = useState(PRIORITY_TIERS[0].label)
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [offlineWarn, setOfflineWarn] = useState(false)

  const reviewStyle = REVIEW_STYLES[currentStatus] ?? REVIEW_STYLES.unreviewed
  const StatusIcon  = reviewStyle.icon

  async function submit(status, submitNote) {
    setSaving(true)
    setOfflineWarn(false)
    try {
      const result = await reviewAIPriority(report.id, status, submitNote, reviewerName)
      if (result.offline) setOfflineWarn(true)
      const fields = {
        ai_review_status: status,
        ai_review_note:   submitNote || null,
        ai_reviewed_by:   reviewerName,
        ai_reviewed_at:   new Date().toISOString(),
      }
      onReviewed?.(fields)
      setMode(null)
      setNote('')
    } catch (e) {
      console.error('[AIReviewPanel] review failed:', e?.message)
    } finally {
      setSaving(false)
    }
  }

  const isReviewed = currentStatus !== 'unreviewed'

  return (
    <div className="glass rounded-2xl p-4 border border-[rgba(255,255,255,0.08)] space-y-3">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain16 />
        <p className="text-xs font-bold text-slate-200 tracking-wide">AI Emergency Assessment</p>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ color: reviewStyle.color, background: `${reviewStyle.color}22` }}>
          <StatusIcon size={10} className="inline mr-1" />
          {reviewStyle.label}
        </span>
      </div>

      {/* AI output row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-bright rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Priority</p>
          <p className="text-sm font-black" style={{ color: priorityColor }}>{priorityLabel}</p>
          <p className="text-[10px] text-slate-500">Score {report.ai_priority_score ?? 50}</p>
        </div>
        <div className="glass-bright rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Category</p>
          <p className="text-xs font-semibold text-slate-200 leading-tight">{serviceLabel}</p>
        </div>
        <div className="glass-bright rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Confidence</p>
          <p className="text-xs font-semibold text-slate-200">{confLabel ?? '—'}</p>
          {report.ai_confidence != null && (
            <p className="text-[10px] text-slate-500">{report.ai_confidence}%</p>
          )}
        </div>
      </div>

      {/* Reviewed-by info */}
      {isReviewed && report.ai_reviewed_by && (
        <p className="text-[10px] text-slate-400">
          Reviewed by <span className="text-slate-200 font-medium">{report.ai_reviewed_by}</span>
          {report.ai_review_note && <> — "{report.ai_review_note}"</>}
        </p>
      )}

      {/* Offline warning */}
      {offlineWarn && (
        <p className="text-[10px] text-amber-400 flex items-center gap-1">
          <AlertTriangle size={10} /> Saved offline — will sync when connectivity returns.
        </p>
      )}

      {/* Action buttons — only shown when not yet reviewed */}
      {!isReviewed && mode === null && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => submit('confirmed', null)}
            disabled={saving}
            className="flex-1 text-xs font-semibold py-1.5 px-3 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
          >
            <CheckCircle size={11} className="inline mr-1" />Confirm AI
          </button>
          <button
            onClick={() => setMode('override')}
            className="flex-1 text-xs font-semibold py-1.5 px-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
          >
            <Edit3 size={11} className="inline mr-1" />Override
          </button>
          <button
            onClick={() => setMode('reject')}
            className="flex-1 text-xs font-semibold py-1.5 px-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <XCircle size={11} className="inline mr-1" />Reject
          </button>
        </div>
      )}

      {/* Override form */}
      {mode === 'override' && (
        <div className="space-y-2">
          <select
            value={overrideTier}
            onChange={e => setOverrideTier(e.target.value)}
            className="w-full text-xs rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] px-3 py-2 text-slate-200"
          >
            {PRIORITY_TIERS.map(t => (
              <option key={t.label} value={t.label}>{t.label} (score ~{t.score})</option>
            ))}
          </select>
          <textarea
            placeholder="Reason for override (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="w-full text-xs rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] px-3 py-2 text-slate-200 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => submit('corrected', `Priority overridden to ${overrideTier}${note ? ': ' + note : ''}`)}
              disabled={saving}
              className="flex-1 text-xs font-semibold py-1.5 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-40">
              {saving ? 'Saving…' : 'Save Override'}
            </button>
            <button onClick={() => setMode(null)}
              className="text-xs py-1.5 px-3 rounded-xl bg-[rgba(255,255,255,0.06)] text-slate-400 hover:bg-[rgba(255,255,255,0.1)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reject form */}
      {mode === 'reject' && (
        <div className="space-y-2">
          <textarea
            placeholder="Reason for rejecting AI assessment"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="w-full text-xs rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] px-3 py-2 text-slate-200 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => submit('rejected', note || 'Assessment rejected')}
              disabled={saving}
              className="flex-1 text-xs font-semibold py-1.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40">
              {saving ? 'Saving…' : 'Confirm Rejection'}
            </button>
            <button onClick={() => setMode(null)}
              className="text-xs py-1.5 px-3 rounded-xl bg-[rgba(255,255,255,0.06)] text-slate-400 hover:bg-[rgba(255,255,255,0.1)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-600 leading-tight">
        AI-generated assessment. Human verification required before operational decisions.
      </p>
    </div>
  )
}

function Brain16() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 shrink-0">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
      <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
      <path d="M6 18a4 4 0 0 1-1.967-.516"/>
      <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
    </svg>
  )
}
