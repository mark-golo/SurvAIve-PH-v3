import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, CheckCircle, WifiOff, AlertOctagon, Send, ChevronLeft } from 'lucide-react'
import { TopBar } from '../../components/ui/NavBar'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import api from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/api'

// ── Star picker ───────────────────────────────────────────────────────────────
function StarPicker({ value, onChange, disabled }) {
  return (
    <div className="flex gap-2">
      {[1,2,3,4,5].map(n => (
        <button key={n} disabled={disabled} onClick={() => onChange(n)}
          className="transition-transform active:scale-90">
          <Star
            size={32}
            className={`transition-colors ${n <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`}
          />
        </button>
      ))}
    </div>
  )
}

const RATING_LABEL = r => (['','Poor','Fair','Good','Very Good','Excellent'])[r] ?? ''

// ── Component ─────────────────────────────────────────────────────────────────
export function RescueFeedback() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const [isOnline]= useState(getNetworkOnline)

  const [report,       setReport]       = useState(null)
  const [existing,     setExisting]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [done,         setDone]         = useState(false)
  const [error,        setError]        = useState(null)

  // Responder feedback state
  const [respRating,   setRespRating]   = useState(0)
  const [respComment,  setRespComment]  = useState('')
  // Agency feedback state
  const [agcRating,    setAgcRating]    = useState(0)
  const [agcComment,   setAgcComment]   = useState('')
  // Anonymous preference
  const [anonymous,    setAnonymous]    = useState(false)

  useEffect(() => {
    if (!isOnline) { setLoading(false); return }
    async function load() {
      try {
        const all = await api.get('/sos/mine')
        const r = Array.isArray(all) ? all.find(x => String(x.id) === String(id)) : null
        setReport(r ?? null)

        // Check existing feedback to prevent duplicates
        if (r && user?.id) {
          const { data } = await supabase
            .from('response_feedback')
            .select('id,target_type,target_id')
            .eq('sos_id', id)
            .eq('victim_id', user.id)
          setExisting(data ?? [])
        }
      } catch (err) {
        console.error('[RescueFeedback] load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOnline, id, user?.id])

  const responderAlreadyRated = existing.some(e => e.target_type === 'responder')
  const agencyAlreadyRated    = existing.some(e => e.target_type === 'agency')
  const canSubmit = (!responderAlreadyRated && respRating > 0) || (!agencyAlreadyRated && agcRating > 0)

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const entries = []

    if (!responderAlreadyRated && respRating > 0 && report.assigned_responder_id) {
      entries.push({ target_type: 'responder', target_id: String(report.assigned_responder_id), rating: respRating, comments: respComment.trim() || null })
    }
    if (!agencyAlreadyRated && agcRating > 0) {
      // Use first service_type as the agency identifier (target_id = service_type label)
      const agencyType = Array.isArray(report.service_type) ? report.service_type[0] : report.service_type
      if (agencyType) {
        entries.push({ target_type: 'agency', target_id: agencyType, rating: agcRating, comments: agcComment.trim() || null })
      }
    }

    if (entries.length === 0) { setSubmitting(false); return }

    try {
      for (const entry of entries) {
        const { data, error: err } = await supabase
          .from('response_feedback')
          .insert({
            sos_id:              id,
            victim_id:           user.id,
            target_type:         entry.target_type,
            target_id:           entry.target_id,
            rating:              entry.rating,
            comments:            entry.comments,
            display_anonymously: anonymous,
          })
          .select('id')
          .single()
        if (err) throw err
        if (data?.id) {
          logActivity('POST', 'response_feedback', 'response_feedback', data.id, {
            sos_id: id, target_type: entry.target_type, rating: entry.rating,
          })
        }
      }
      setDone(true)
    } catch (err) {
      console.error('[RescueFeedback] submit failed:', err)
      setError('Failed to submit feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOnline) {
    return (
      <div className={`h-screen flex flex-col bg-mesh${isLight ? ' light-theme' : ''}`}>
        <TopBar title="Rate Your Response" onBack />
        <div className="flex flex-col items-center gap-3 mt-16 text-slate-500 p-4">
          <WifiOff size={28} />
          <p className="text-sm text-center">Feedback submission requires an internet connection.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`h-screen flex flex-col bg-mesh${isLight ? ' light-theme' : ''}`}>
        <TopBar title="Rate Your Response" onBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#00d4ff] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (!report || report.rescue_status !== 'rescued') {
    return (
      <div className={`h-screen flex flex-col bg-mesh${isLight ? ' light-theme' : ''}`}>
        <TopBar title="Rate Your Response" onBack />
        <div className="flex flex-col items-center gap-3 mt-16 text-slate-500 p-4">
          <AlertOctagon size={28} />
          <p className="text-sm text-center">
            {!report ? 'SOS report not found.' : 'Feedback is only available after rescue is completed.'}
          </p>
          <button onClick={() => navigate(`/sos/${id}`)} className="text-xs text-[#00d4ff] underline">Back to Tracking</button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className={`h-screen flex flex-col bg-mesh${isLight ? ' light-theme' : ''}`}>
        <TopBar title="Thank You" onBack />
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12 }}>
            <CheckCircle size={64} className="text-green-400" />
          </motion.div>
          <h2 className="text-xl font-black text-white text-center">Feedback Submitted</h2>
          <p className="text-sm text-slate-400 text-center">
            Thank you for rating your response. Your feedback helps improve emergency services.
          </p>
          <button onClick={() => navigate(`/sos/${id}`)}
            className="px-6 py-3 rounded-2xl bg-[rgba(0,212,255,0.15)] border border-[rgba(0,212,255,0.3)] text-[#00d4ff] text-sm font-semibold">
            Back to Tracking
          </button>
          <button onClick={() => navigate('/sos/history')} className="text-xs text-slate-500 underline">
            View All Reports
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen flex flex-col bg-mesh overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Rate Your Response" onBack />

      <main className="flex-1 overflow-y-auto p-4 pb-8 space-y-4">
        <p className="text-xs text-slate-500 text-center">SOS #{report.id} · Your feedback is anonymous to the public by default.</p>

        {/* Responder rating */}
        {report.assigned_responder_id ? (
          <div className={`glass rounded-2xl p-4 space-y-3 border ${responderAlreadyRated ? 'border-green-500/20 opacity-60' : 'border-[rgba(255,255,255,0.06)]'}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Rate the Responder</p>
              {responderAlreadyRated && <span className="text-[10px] text-green-400 font-semibold">Already Rated</span>}
            </div>
            {!responderAlreadyRated ? (
              <>
                <StarPicker value={respRating} onChange={setRespRating} disabled={false} />
                {respRating > 0 && <p className="text-xs text-amber-400 font-medium">{RATING_LABEL(respRating)}</p>}
                <textarea
                  value={respComment} onChange={e => setRespComment(e.target.value)}
                  placeholder="Optional comment about the responder…"
                  rows={2}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 resize-none"
                />
              </>
            ) : (
              <p className="text-xs text-slate-500">You have already rated this responder.</p>
            )}
          </div>
        ) : (
          <div className="glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)] opacity-50">
            <p className="text-sm text-slate-500">No responder was assigned to this incident.</p>
          </div>
        )}

        {/* Agency rating */}
        {Array.isArray(report.service_type) && report.service_type.length > 0 ? (
          <div className={`glass rounded-2xl p-4 space-y-3 border ${agencyAlreadyRated ? 'border-green-500/20 opacity-60' : 'border-[rgba(255,255,255,0.06)]'}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">
                Rate the Agency
                <span className="ml-2 text-xs text-slate-500 font-normal uppercase">({report.service_type.join(', ')})</span>
              </p>
              {agencyAlreadyRated && <span className="text-[10px] text-green-400 font-semibold">Already Rated</span>}
            </div>
            {!agencyAlreadyRated ? (
              <>
                <StarPicker value={agcRating} onChange={setAgcRating} disabled={false} />
                {agcRating > 0 && <p className="text-xs text-amber-400 font-medium">{RATING_LABEL(agcRating)}</p>}
                <textarea
                  value={agcComment} onChange={e => setAgcComment(e.target.value)}
                  placeholder="Optional comment about the agency's response…"
                  rows={2}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 resize-none"
                />
              </>
            ) : (
              <p className="text-xs text-slate-500">You have already rated this agency.</p>
            )}
          </div>
        ) : null}

        {/* Anonymous toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div className={`w-10 h-6 rounded-full transition-colors ${anonymous ? 'bg-[#00d4ff]' : 'bg-slate-700'} relative`}
            onClick={() => setAnonymous(a => !a)}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${anonymous ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-xs text-slate-400">Submit anonymously (hides your name from public view)</span>
        </label>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm transition-all ${
            canSubmit && !submitting
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 border border-amber-500/40 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
          }`}>
          {submitting
            ? <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            : <><Send size={15} /> Submit Feedback</>
          }
        </button>

        <button onClick={() => navigate(`/sos/${id}`)} className="w-full text-xs text-slate-500 underline text-center py-2">
          Skip for now
        </button>
      </main>
    </div>
  )
}
